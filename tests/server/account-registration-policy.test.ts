import * as crypto from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createInMemoryGameplaySessionService } from "../../apps/server/src/auth/gameplay-session-service";
import { resolveAccountRegistrationPolicy } from "../../apps/server/src/player-entry/account-registration-policy";
import { createPlayerEntryNetlifyBoundary } from "../../apps/server/src/player-entry/player-entry-netlify";
import type { AuthThrottleService } from "../../apps/server/src/player-entry/postgres-auth-throttle";
import type { PostgresPlayerEntryRepository } from "../../apps/server/src/player-entry/postgres-player-entry-repository";

const invite = "closed-alpha-secret";
const environment = {
  NODE_ENV: "production",
  EMPIRE_ALLOWED_ORIGINS: "https://empire.test",
  EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED: "true",
  EMPIRE_CLOSED_ALPHA_INVITE_CODE_HASH: crypto.createHash("sha256").update(invite).digest("hex")
};

describe("account registration policy", () => {
  it("opens production registration only with persistence, flag and invite hash", () => {
    expect(resolveAccountRegistrationPolicy(environment, true)).toEqual({
      registrationEnabled: true,
      inviteRequired: true,
      mode: "closed_alpha",
      passwordMinimumLength: 12
    });
    expect(resolveAccountRegistrationPolicy({ ...environment, EMPIRE_CLOSED_ALPHA_INVITE_CODE_HASH: "" }, true).registrationEnabled).toBe(false);
    expect(resolveAccountRegistrationPolicy(environment, false).registrationEnabled).toBe(false);
  });

  it("serves only the public policy fields", async () => {
    const handler = createHandler();
    const response = await handler({ httpMethod: "GET", path: "/api/account/registration-policy", body: null });
    const payload = JSON.parse(response?.body ?? "null");

    expect(response?.statusCode).toBe(200);
    expect(payload.data).toEqual({
      registrationEnabled: true,
      inviteRequired: true,
      mode: "closed_alpha",
      passwordMinimumLength: 12
    });
    expect(JSON.stringify(payload)).not.toContain(invite);
    expect(JSON.stringify(payload)).not.toContain(environment.EMPIRE_CLOSED_ALPHA_INVITE_CODE_HASH);
  });

  it("rejects an invalid invite and accepts the valid invite", async () => {
    const repository = createRepository();
    const handler = createHandler(repository);
    const rejected = await handler(registerRequest("wrong"));
    const accepted = await handler(registerRequest(invite));

    expect(rejected?.statusCode).toBe(403);
    expect(JSON.parse(rejected?.body ?? "null").errors[0]?.code).toBe("ACCOUNT_INVITE_REQUIRED");
    expect(accepted?.statusCode).toBe(201);
    expect(repository.registerAccount).toHaveBeenCalledTimes(1);
    expect(accepted?.headers["set-cookie"]).toContain("HttpOnly");
    expect(accepted?.headers["set-cookie"]).toContain("Secure");
  });
});

const createHandler = (repository = createRepository()) => createPlayerEntryNetlifyBoundary({
  environment,
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

const registerRequest = (inviteCode: string) => ({
  httpMethod: "POST",
  path: "/api/account/register",
  body: { username: "AlphaBoss", gangName: "Alpha Gang", password: "long-secure-password", inviteCode },
  headers: { origin: environment.EMPIRE_ALLOWED_ORIGINS, "content-type": "application/json", "x-forwarded-for": "203.0.113.1" }
});
