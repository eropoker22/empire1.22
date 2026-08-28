import { describe, expect, it, vi } from "vitest";
import { createInMemoryGameplaySessionService } from "../../apps/server/src/auth/gameplay-session-service";
import { resolveAccountRegistrationPolicy } from "../../apps/server/src/player-entry/account-registration-policy";
import { createPlayerEntryNetlifyBoundary } from "../../apps/server/src/player-entry/player-entry-netlify";
import type { AuthThrottleService } from "../../apps/server/src/player-entry/postgres-auth-throttle";
import type { PostgresPlayerEntryRepository } from "../../apps/server/src/player-entry/postgres-player-entry-repository";

const environment = {
  NODE_ENV: "production",
  EMPIRE_RELEASE_ENVIRONMENT: "staging",
  EMPIRE_ALLOWED_ORIGINS: "https://empire.test",
  EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED: "true",
  EMPIRE_ACCOUNT_TERMS_VERSION: "closed-alpha-internal-v1"
};
const ready = { persistenceReady: true, authSecurityReady: true };
const now = new Date("2026-08-05T10:00:00.000Z");

describe("account registration policy", () => {
  it("opens public registration only with persistence, auth security, terms and the registration flag", () => {
    expect(resolveAccountRegistrationPolicy(environment, ready, now)).toEqual({
      registrationEnabled: true,
      mode: "open",
      expiresAt: null,
      passwordMinimumLength: 12,
      minimumAgeYears: 16,
      termsAcceptanceRequired: true,
      termsVersion: "closed-alpha-internal-v1"
    });
    expect(resolveAccountRegistrationPolicy(
      { ...environment, EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED: "false" },
      ready,
      now
    ).registrationEnabled).toBe(false);
    expect(resolveAccountRegistrationPolicy(environment, { ...ready, persistenceReady: false }, now).registrationEnabled).toBe(false);
    expect(resolveAccountRegistrationPolicy(environment, { ...ready, authSecurityReady: false }, now).registrationEnabled).toBe(false);
    expect(resolveAccountRegistrationPolicy(
      { ...environment, EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED: undefined },
      ready,
      now
    ).registrationEnabled).toBe(false);
    expect(resolveAccountRegistrationPolicy(
      { ...environment, EMPIRE_ACCOUNT_TERMS_VERSION: undefined },
      ready,
      now
    )).toMatchObject({ registrationEnabled: false, termsVersion: null });
  });

  it("keeps bounded registration explicit and isolated from permanent-open mode", () => {
    expect(resolveAccountRegistrationPolicy({
      ...environment,
      EMPIRE_CLOSED_ALPHA_REGISTRATION_EXPIRES_AT: "2026-08-05T12:00:00.000Z"
    }, ready, now)).toMatchObject({
      registrationEnabled: true,
      mode: "open",
      expiresAt: "2026-08-05T12:00:00.000Z"
    });
    for (const expiresAt of [
      "2026-08-05T09:59:59.000Z",
      "2026-08-07T10:00:00.000Z",
      "Wed, 05 Aug 2026 12:00:00 GMT"
    ]) {
      expect(resolveAccountRegistrationPolicy({
        ...environment,
        EMPIRE_CLOSED_ALPHA_REGISTRATION_EXPIRES_AT: expiresAt
      }, ready, now)).toMatchObject({ registrationEnabled: false, mode: "closed", expiresAt: null });
    }
  });

  it("serves only the public registration fields", async () => {
    const response = await createHandler()({ httpMethod: "GET", path: "/api/account/registration-policy", body: null });
    const payload = JSON.parse(response?.body ?? "null");

    expect(response?.statusCode).toBe(200);
    expect(payload.data).toEqual({
      registrationEnabled: true,
      mode: "open",
      expiresAt: null,
      passwordMinimumLength: 12,
      minimumAgeYears: 16,
      termsAcceptanceRequired: true,
      termsVersion: "closed-alpha-internal-v1"
    });
    expect(JSON.stringify(payload)).not.toMatch(/invite|secret|pepper|database/iu);
  });

  it("creates an account without an invite and sends both password fields to the repository", async () => {
    const repository = createRepository();
    const response = await createHandler(repository)(registerRequest());

    expect(response?.statusCode).toBe(201);
    expect(repository.registerAccount).toHaveBeenCalledWith({
      username: "AlphaBoss",
      gangName: "Alpha Gang",
      dateOfBirth: "1990-04-12",
      password: "long-secure-password",
      passwordConfirmation: "long-secure-password",
      termsAccepted: true,
      termsVersion: "closed-alpha-internal-v1"
    });
    expect(response?.headers["set-cookie"]).toContain("HttpOnly");
    expect(response?.headers["set-cookie"]).toContain("Secure");
  });

  it("rejects mismatched passwords before creating an account", async () => {
    const repository = createRepository();
    const response = await createHandler(repository)(registerRequest({ passwordConfirmation: "different-password" }));

    expect(response?.statusCode).toBe(400);
    expect(JSON.parse(response?.body ?? "null").errors[0]?.code).toBe("ACCOUNT_PASSWORD_CONFIRMATION_MISMATCH");
    expect(repository.registerAccount).not.toHaveBeenCalled();
  });

  it("rejects account creation server-side when the owner kill-switch is closed", async () => {
    const repository = createRepository();
    const response = await createHandler(repository, {
      EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED: "false"
    })(registerRequest());

    expect(response?.statusCode).toBe(403);
    expect(JSON.parse(response?.body ?? "null").errors[0]?.code).toBe("ACCOUNT_REGISTRATION_CLOSED");
    expect(repository.registerAccount).not.toHaveBeenCalled();
  });

  it("rejects legacy invite fields instead of silently trusting them", async () => {
    const repository = createRepository();
    const response = await createHandler(repository)(registerRequest({ inviteCode: "legacy" }));

    expect(response?.statusCode).toBe(400);
    expect(JSON.parse(response?.body ?? "null").errors[0]?.code).toBe("ACCOUNT_REGISTRATION_PAYLOAD_INVALID");
    expect(repository.registerAccount).not.toHaveBeenCalled();
  });
});

const createHandler = (
  repository = createRepository(),
  environmentOverrides: Record<string, string | undefined> = {}
) => createPlayerEntryNetlifyBoundary({
  environment: {
    ...environment,
    ...environmentOverrides
  },
  repository,
  authThrottle: { consume: async () => ({ allowed: true, retryAfterSeconds: 0, reason: null }) } satisfies AuthThrottleService,
  gameplaySessionService: createInMemoryGameplaySessionService({ productionReady: true })
});

const createRepository = () => ({
  isSchemaCurrent: vi.fn(async () => true),
  registerAccount: vi.fn(async () => ({
    token: "account-token",
    session: {
      accountId: "account:alpha",
      sessionId: "session:alpha",
      username: "AlphaBoss",
      displayName: "AlphaBoss",
      gangName: "Alpha Gang",
      expiresAt: "2099-01-01T00:00:00.000Z"
    }
  }))
}) as unknown as PostgresPlayerEntryRepository;

const registerRequest = (overrides: Record<string, unknown> = {}) => ({
  httpMethod: "POST",
  path: "/api/account/register",
  body: {
    username: "AlphaBoss",
    gangName: "Alpha Gang",
    dateOfBirth: "1990-04-12",
    password: "long-secure-password",
    passwordConfirmation: "long-secure-password",
    termsAccepted: true,
    termsVersion: "closed-alpha-internal-v1",
    ...overrides
  },
  headers: { origin: environment.EMPIRE_ALLOWED_ORIGINS, "content-type": "application/json", "x-forwarded-for": "203.0.113.1" }
});
