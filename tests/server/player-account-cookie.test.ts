import { describe, expect, it } from "vitest";
import {
  createInMemoryGameplaySessionService,
  createUnavailableGameplaySessionService
} from "../../apps/server/src/auth/gameplay-session-service";
import { readPlayerAccountCookie } from "../../apps/server/src/player-entry/player-account-cookie";
import { createPlayerEntryNetlifyBoundary } from "../../apps/server/src/player-entry/player-entry-netlify";
import type {
  AuthenticatedAccount,
  PostgresPlayerEntryRepository
} from "../../apps/server/src/player-entry/postgres-player-entry-repository";
import { createJsonResponse } from "../../apps/server/src/netlify/netlify-json-response";

describe("player entry HTTP hardening", () => {
  it("treats malformed account cookie encoding as an unauthenticated request", () => {
    expect(readPlayerAccountCookie({
      cookie: "empire_account_session=%E0%A4%A"
    })).toBeNull();
  });

  it("adds baseline security headers to Netlify JSON responses", () => {
    const response = createJsonResponse(200, { accepted: true });

    expect(response.headers).toMatchObject({
      "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=()",
      "referrer-policy": "strict-origin-when-cross-origin",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY"
    });
  });

  it("revokes gameplay sessions before revoking the account session", async () => {
    const calls: string[] = [];
    const gameplaySessions = createInMemoryGameplaySessionService({ productionReady: true });
    gameplaySessions.revokeAccountSessions = async () => {
      calls.push("gameplay");
      return 1;
    };
    const handler = createPlayerEntryNetlifyBoundary({
      environment: productionEnvironment,
      repository: createRepository(() => calls.push("account")),
      gameplaySessionService: gameplaySessions
    });

    const response = await handler(deleteSessionRequest());

    expect(response?.statusCode).toBe(200);
    expect(calls).toEqual(["gameplay", "account"]);
    expect(response?.headers["set-cookie"]).toContain("Max-Age=0");
  });

  it("keeps the account session retryable when gameplay revocation fails", async () => {
    const calls: string[] = [];
    const gameplaySessions = createInMemoryGameplaySessionService({ productionReady: true });
    gameplaySessions.revokeAccountSessions = async () => {
      calls.push("gameplay");
      throw new Error("database connection failed");
    };
    const handler = createPlayerEntryNetlifyBoundary({
      environment: productionEnvironment,
      repository: createRepository(() => calls.push("account")),
      gameplaySessionService: gameplaySessions
    });

    const response = await handler(deleteSessionRequest());
    const body = JSON.parse(response?.body ?? "null");

    expect(response?.statusCode).toBe(503);
    expect(calls).toEqual(["gameplay"]);
    expect(body.errors).toEqual([{
      code: "PLAYER_ENTRY_UNAVAILABLE",
      message: "Player entry operace se nezdařila."
    }]);
  });

  it("rejects production logout when gameplay revocation is unavailable", async () => {
    const calls: string[] = [];
    const handler = createPlayerEntryNetlifyBoundary({
      environment: productionEnvironment,
      repository: createRepository(() => calls.push("account")),
      gameplaySessionService: createUnavailableGameplaySessionService()
    });

    const response = await handler(deleteSessionRequest());
    const body = JSON.parse(response?.body ?? "null");

    expect(response?.statusCode).toBe(503);
    expect(calls).toEqual([]);
    expect(body.errors[0]?.code).toBe("PLAYER_ENTRY_UNAVAILABLE");
  });
});

const productionEnvironment = {
  NODE_ENV: "production",
  EMPIRE_ALLOWED_ORIGINS: "https://empire.test"
};

const account: AuthenticatedAccount = {
  accountId: "account:logout-test",
  sessionId: "account-session:logout-test",
  username: "logout-test",
  displayName: "Logout Test",
  gangName: "Logout Crew",
  expiresAt: "2099-01-01T00:00:00.000Z"
};

const createRepository = (onRevoke: () => void): PostgresPlayerEntryRepository => ({
  isSchemaCurrent: async () => true,
  authenticate: async () => account,
  revokeSession: async () => {
    onRevoke();
    return true;
  }
} as unknown as PostgresPlayerEntryRepository);

const deleteSessionRequest = () => ({
  httpMethod: "DELETE",
  path: "/api/account/session",
  body: null,
  headers: {
    cookie: "empire_account_session=account-token",
    origin: productionEnvironment.EMPIRE_ALLOWED_ORIGINS,
    "content-type": "application/json"
  }
});
