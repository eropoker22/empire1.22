import { describe, expect, it, vi } from "vitest";
import { createInMemoryGameplaySessionService } from "../../apps/server/src/auth/gameplay-session-service";
import { resolveAccountRegistrationPolicy } from "../../apps/server/src/player-entry/account-registration-policy";
import { createPlayerEntryNetlifyBoundary } from "../../apps/server/src/player-entry/player-entry-netlify";
import type { AuthThrottleService } from "../../apps/server/src/player-entry/postgres-auth-throttle";
import type { PostgresPlayerEntryRepository } from "../../apps/server/src/player-entry/postgres-player-entry-repository";

const environment = {
  NODE_ENV: "production",
  EMPIRE_ALLOWED_ORIGINS: "https://empire.test",
  EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED: "true"
};

describe("account registration policy", () => {
  it("opens public registration with persistence and the registration flag", () => {
    expect(resolveAccountRegistrationPolicy(environment, true)).toEqual({
      registrationEnabled: true,
      mode: "open",
      passwordMinimumLength: 12,
      minimumAgeYears: 16
    });
    expect(resolveAccountRegistrationPolicy({ ...environment, EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED: "false" }, true).registrationEnabled).toBe(false);
    expect(resolveAccountRegistrationPolicy(environment, false).registrationEnabled).toBe(false);
  });

  it("serves only the public registration fields", async () => {
    const response = await createHandler()({ httpMethod: "GET", path: "/api/account/registration-policy", body: null });
    const payload = JSON.parse(response?.body ?? "null");

    expect(response?.statusCode).toBe(200);
    expect(payload.data).toEqual({
      registrationEnabled: true,
      mode: "open",
      passwordMinimumLength: 12,
      minimumAgeYears: 16
    });
    expect(JSON.stringify(payload)).not.toContain("invite");
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
      passwordConfirmation: "long-secure-password"
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

  it("rejects legacy invite fields instead of silently trusting them", async () => {
    const repository = createRepository();
    const response = await createHandler(repository)(registerRequest({ inviteCode: "legacy" }));

    expect(response?.statusCode).toBe(400);
    expect(JSON.parse(response?.body ?? "null").errors[0]?.code).toBe("ACCOUNT_REGISTRATION_PAYLOAD_INVALID");
    expect(repository.registerAccount).not.toHaveBeenCalled();
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

const registerRequest = (overrides: Record<string, unknown> = {}) => ({
  httpMethod: "POST",
  path: "/api/account/register",
  body: {
    username: "AlphaBoss",
    gangName: "Alpha Gang",
    dateOfBirth: "1990-04-12",
    password: "long-secure-password",
    passwordConfirmation: "long-secure-password",
    ...overrides
  },
  headers: { origin: environment.EMPIRE_ALLOWED_ORIGINS, "content-type": "application/json", "x-forwarded-for": "203.0.113.1" }
});
