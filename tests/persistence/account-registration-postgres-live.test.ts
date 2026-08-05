import * as crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { createPersistentGameplaySessionService } from "../../apps/server/src/auth/gameplay-session-service";
import { createPlayerEntryNetlifyBoundary } from "../../apps/server/src/player-entry/player-entry-netlify";
import { createPostgresPlayerEntryRepository } from "../../apps/server/src/player-entry/postgres-player-entry-repository";
import { createPostgresGameplayIdentitySessionRepository } from
  "../../apps/server/src/runtime/persistence/postgres/postgres-gameplay-identity-session-repository";
import type { PostgresDatabase } from "../../apps/server/src/runtime/persistence/postgres";
import { createIsolatedPostgresTestSchema } from "./helpers/isolated-postgres-test-schema";
import { resolveLivePostgresSmokeConfig } from "./helpers/postgres-prod-like-smoke-helpers";

const live = resolveLivePostgresSmokeConfig();
const run = live.run ? it : it.skip;
const ORIGIN = "https://registration.staging.test";
const TERMS_VERSION = "closed-alpha-internal-v1";
const environment = {
  NODE_ENV: "production",
  EMPIRE_RELEASE_ENVIRONMENT: "staging",
  EMPIRE_ALLOWED_ORIGINS: ORIGIN,
  EMPIRE_PERSISTENCE_DRIVER: "postgres",
  EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED: "true",
  EMPIRE_CLOSED_ALPHA_REGISTRATION_EXPIRES_AT: new Date(Date.now() + 60 * 60 * 1_000).toISOString(),
  EMPIRE_ACCOUNT_TERMS_VERSION: TERMS_VERSION,
  EMPIRE_AUTH_THROTTLE_PEPPER: "a".repeat(64)
};

describe("account registration PostgreSQL live", () => {
  run("persists account, terms and sessions across cold starts, logout and kill switch", async () => {
    const fixture = await createFixture("registration_flow");
    try {
      const credentials = uniqueCredentials("flow");
      const registration = await fixture.handler(registerRequest(credentials, "203.0.113.10"));
      expect(registration?.statusCode).toBe(201);
      const setCookie = String(registration?.headers["set-cookie"] ?? "");
      expect(setCookie).toContain("HttpOnly");
      expect(setCookie).toContain("Secure");
      expect(setCookie).toContain("SameSite=Strict");
      expect(setCookie).toContain("Path=/");
      expect(setCookie).not.toContain("Domain=");
      const cookie = cookieHeader(setCookie);
      const registrationBody = payload(registration?.body);
      expect(registrationBody.accepted).toBe(true);
      expect(JSON.stringify(registrationBody)).not.toContain(cookie.split("=")[1]);

      expect(await count(fixture.database, "empire_accounts")).toBe(1);
      expect(await count(fixture.database, "empire_account_sessions")).toBe(1);
      expect(await count(fixture.database, "empire_account_terms_acceptances")).toBe(1);
      expect(await count(fixture.database, "empire_server_memberships")).toBe(0);
      const acceptedTerms = await fixture.database.query<{ terms_version: string }>(
        "SELECT terms_version FROM empire_account_terms_acceptances"
      );
      expect(acceptedTerms.rows).toEqual([{ terms_version: TERMS_VERSION }]);

      const coldStartHandler = createHandler(fixture.database);
      const restored = await coldStartHandler(sessionRequest("GET", cookie));
      expect(restored?.statusCode).toBe(200);
      expect(payload(restored?.body).data).toMatchObject({ username: credentials.username });

      const tampered = await coldStartHandler(sessionRequest("GET", `${cookie}x`));
      expect(tampered?.statusCode).toBe(401);
      expect(payload(tampered?.body).errors[0]?.code).toBe("ACCOUNT_SESSION_INVALID");

      const loggedOut = await coldStartHandler(sessionRequest("DELETE", cookie));
      expect(loggedOut?.statusCode).toBe(200);
      expect(loggedOut?.headers["set-cookie"]).toContain("Max-Age=0");
      expect(payload((await coldStartHandler(sessionRequest("GET", cookie)))?.body).errors[0]?.code)
        .toBe("ACCOUNT_SESSION_INVALID");

      const closedHandler = createHandler(fixture.database, {
        ...environment,
        EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED: "false"
      });
      const policy = await closedHandler({ httpMethod: "GET", path: "/api/account/registration-policy", body: null });
      expect(payload(policy?.body).data.registrationEnabled).toBe(false);
      expect((await closedHandler(registerRequest(uniqueCredentials("closed"), "203.0.113.11")))?.statusCode).toBe(403);
      const login = await closedHandler(loginRequest(credentials, "203.0.113.12"));
      expect(login?.statusCode).toBe(200);
      expect(payload(login?.body).data).toMatchObject({ username: credentials.username });

      const activeCookie = cookieHeader(String(login?.headers["set-cookie"] ?? ""));
      await fixture.database.query(
        "UPDATE empire_account_sessions SET expires_at=clock_timestamp() - interval '1 second' WHERE token_hash IS NOT NULL"
      );
      expect(payload((await createHandler(fixture.database)(sessionRequest("GET", activeCookie)))?.body).errors[0]?.code)
        .toBe("ACCOUNT_SESSION_INVALID");
    } finally {
      await fixture.close();
    }
  }, 90_000);

  run("enforces validation and serializes duplicate normalized usernames", async () => {
    const fixture = await createFixture("registration_validation");
    try {
      const credentials = uniqueCredentials("duplicate");
      const [first, second] = await Promise.all([
        fixture.handler(registerRequest(credentials, "203.0.113.21")),
        fixture.handler(registerRequest(
          { ...credentials, username: credentials.username.toUpperCase() },
          "203.0.113.22"
        ))
      ]);
      expect([first?.statusCode, second?.statusCode].sort()).toEqual([201, 409]);
      const rejected = [first, second].find((response) => response?.statusCode === 409);
      expect(payload(rejected?.body).errors[0]?.code).toBe("ACCOUNT_USERNAME_TAKEN");
      expect(await count(fixture.database, "empire_accounts")).toBe(1);
      expect(await count(fixture.database, "empire_account_sessions")).toBe(1);
      expect(await count(fixture.database, "empire_account_terms_acceptances")).toBe(1);

      const invalidCases = [
        [{ password: "short", passwordConfirmation: "short" }, "ACCOUNT_PASSWORD_TOO_SHORT"],
        [{ passwordConfirmation: "different-password" }, "ACCOUNT_PASSWORD_CONFIRMATION_MISMATCH"],
        [{ dateOfBirth: "2099-01-01" }, "ACCOUNT_DATE_OF_BIRTH_INVALID"],
        [{ dateOfBirth: new Date().getUTCFullYear() + "-01-01" }, "ACCOUNT_AGE_REQUIREMENT_NOT_MET"],
        [{ termsAccepted: false }, "ACCOUNT_TERMS_ACCEPTANCE_REQUIRED"],
        [{ unexpected: "field" }, "ACCOUNT_REGISTRATION_PAYLOAD_INVALID"]
      ] as const;
      let index = 0;
      for (const [override, expectedCode] of invalidCases) {
        index += 1;
        const response = await fixture.handler(registerRequest(
          { ...uniqueCredentials(`invalid${index}`), ...override },
          `198.51.100.${index}`
        ));
        expect(payload(response?.body).errors[0]?.code).toBe(expectedCode);
      }

      await fixture.database.query(`
        CREATE OR REPLACE FUNCTION reject_account_session_insert() RETURNS trigger AS $$
        BEGIN
          RAISE EXCEPTION 'session insert rejected by live rollback probe';
        END;
        $$ LANGUAGE plpgsql;
        CREATE TRIGGER account_session_rollback_probe
          BEFORE INSERT ON empire_account_sessions
          FOR EACH ROW EXECUTE FUNCTION reject_account_session_insert();
      `);
      const beforeAccounts = await count(fixture.database, "empire_accounts");
      const rollback = await fixture.handler(registerRequest(uniqueCredentials("rollback"), "192.0.2.44"));
      expect(rollback?.statusCode).toBe(503);
      expect(await count(fixture.database, "empire_accounts")).toBe(beforeAccounts);
      expect(await count(fixture.database, "empire_account_terms_acceptances")).toBe(1);
    } finally {
      await fixture.close();
    }
  }, 90_000);

  run("persists auth throttling across handler cold starts and releases expired buckets", async () => {
    const fixture = await createFixture("registration_throttle");
    try {
      const credentials = uniqueCredentials("throttle");
      const request = loginRequest(credentials, "203.0.113.90");
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const response = await createHandler(fixture.database)(request);
        expect(response?.statusCode).toBe(401);
        expect(payload(response?.body).errors[0]?.code).toBe("ACCOUNT_LOGIN_INVALID");
      }
      const blocked = await createHandler(fixture.database)(request);
      expect(blocked?.statusCode).toBe(429);
      expect(payload(blocked?.body).errors[0]?.code).toBe("ACCOUNT_RATE_LIMITED");
      const stored = await fixture.database.query<{ bucket_key_hash: string }>(
        "SELECT bucket_key_hash FROM empire_auth_throttle_buckets"
      );
      expect(stored.rows.length).toBeGreaterThan(0);
      expect(stored.rows.every((row) => /^[a-f0-9]{64}$/u.test(row.bucket_key_hash))).toBe(true);

      await fixture.database.query(
        `UPDATE empire_auth_throttle_buckets
         SET window_started_at=clock_timestamp() - interval '1 hour',
             blocked_until=clock_timestamp() - interval '1 second',
             expires_at=clock_timestamp() + interval '1 hour'`
      );
      const released = await createHandler(fixture.database)(request);
      expect(released?.statusCode).toBe(401);
      expect(payload(released?.body).errors[0]?.code).toBe("ACCOUNT_LOGIN_INVALID");
    } finally {
      await fixture.close();
    }
  }, 90_000);
});

const createFixture = async (prefix: string) => {
  const isolated = await createIsolatedPostgresTestSchema(live.databaseUrl!, prefix);
  return {
    database: isolated.database,
    handler: createHandler(isolated.database),
    close: isolated.close
  };
};

const createHandler = (
  database: PostgresDatabase,
  configuredEnvironment: Record<string, string | undefined> = environment
) => createPlayerEntryNetlifyBoundary({
  environment: configuredEnvironment,
  repository: createPostgresPlayerEntryRepository(database),
  gameplaySessionService: createPersistentGameplaySessionService(
    createPostgresGameplayIdentitySessionRepository(database),
    { productionReady: true }
  )
});

const uniqueCredentials = (label: string) => {
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 10);
  return {
    username: `${label}_${suffix}`.slice(0, 32),
    gangName: `Gang ${label} ${suffix}`.slice(0, 40),
    dateOfBirth: "1990-01-01",
    password: `Safe-${suffix}-Password-2026`,
    passwordConfirmation: `Safe-${suffix}-Password-2026`,
    termsAccepted: true,
    termsVersion: TERMS_VERSION
  };
};

const registerRequest = (body: Record<string, unknown>, network: string) => ({
  httpMethod: "POST",
  path: "/api/account/register",
  body,
  headers: requestHeaders(network)
});

const loginRequest = (
  credentials: { username: string; password: string },
  network: string
) => ({
  httpMethod: "POST",
  path: "/api/account/session",
  body: { username: credentials.username, password: credentials.password },
  headers: requestHeaders(network)
});

const sessionRequest = (method: "GET" | "DELETE", cookie: string) => ({
  httpMethod: method,
  path: "/api/account/session",
  body: method === "DELETE" ? {} : null,
  headers: {
    ...(method === "DELETE" ? requestHeaders("203.0.113.40") : {}),
    cookie
  }
});

const requestHeaders = (network: string) => ({
  origin: ORIGIN,
  "content-type": "application/json",
  "x-forwarded-for": network
});

const cookieHeader = (setCookie: string): string => setCookie.split(";")[0] ?? "";
const payload = (body: string | undefined) => JSON.parse(body ?? "null");
const count = async (database: PostgresDatabase, table: string): Promise<number> =>
  Number((await database.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM ${table}`
  )).rows[0]?.count ?? 0);
