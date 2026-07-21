import { describe, expect, it } from "vitest";
import { createInMemoryGameplaySessionService } from "../../apps/server/src/auth/gameplay-session-service";
import { createPlayerEntryNetlifyBoundary } from "../../apps/server/src/player-entry/player-entry-netlify";
import type {
  AuthenticatedAccount,
  PostgresPlayerEntryRepository
} from "../../apps/server/src/player-entry/postgres-player-entry-repository";

const account: AuthenticatedAccount = {
  accountId: "account:result-reader",
  sessionId: "session:result-reader",
  username: "result-reader",
  displayName: "Result Reader",
  gangName: "Result Crew",
  expiresAt: "2099-01-01T00:00:00.000Z"
};

describe("account-scoped hosted match results", () => {
  it("returns a durable result only through an authenticated membership lookup", async () => {
    const repository = {
      isSchemaCurrent: async () => true,
      authenticate: async () => account,
      getMatchResults: async (accountId: string, serverInstanceId: string) => ({
        serverInstanceId,
        serverDisplayName: "Free Alpha",
        completedAt: "2026-07-21T20:00:00.000Z",
        completionReason: "final_lockdown_score",
        winner: null,
        top3: [],
        currentPlayerId: "player:reader",
        currentAccountPlacement: accountId === account.accountId ? 4 : null,
        currentAccountFinalScore: 4200,
        currentAccountScoreBreakdown: { finalScore: 4200 }
      })
    } as unknown as PostgresPlayerEntryRepository;
    const handler = createPlayerEntryNetlifyBoundary({
      environment: { NODE_ENV: "production" },
      repository,
      gameplaySessionService: createInMemoryGameplaySessionService({ productionReady: true })
    });

    const response = await handler({
      httpMethod: "GET",
      path: "/api/lobby/servers/instance%3Aalpha/results",
      body: null,
      headers: { cookie: "empire_account_session=account-token" }
    });
    const payload = JSON.parse(response?.body ?? "null");

    expect(response?.statusCode).toBe(200);
    expect(payload.data).toMatchObject({ serverInstanceId: "instance:alpha", currentAccountPlacement: 4 });
  });

  it("does not reveal results to an unauthenticated request", async () => {
    const repository = {
      isSchemaCurrent: async () => true,
      authenticate: async () => null
    } as unknown as PostgresPlayerEntryRepository;
    const handler = createPlayerEntryNetlifyBoundary({
      environment: { NODE_ENV: "production" },
      repository,
      gameplaySessionService: createInMemoryGameplaySessionService({ productionReady: true })
    });

    const response = await handler({
      httpMethod: "GET",
      path: "/api/lobby/servers/instance%3Aalpha/results",
      body: null
    });

    expect(response?.statusCode).toBe(401);
    expect(JSON.parse(response?.body ?? "null").errors[0]?.code).toBe("ACCOUNT_SESSION_REQUIRED");
  });
});
