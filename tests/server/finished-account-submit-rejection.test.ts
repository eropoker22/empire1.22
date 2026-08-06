import { describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import type {
  HostedMatchResultsView,
  SubmitGameplayCommandRequest
} from "@empire/shared-types";
import { resolveFinishedAccountSubmitRejection } from "../../apps/server/src/netlify/finished-account-submit-rejection";
import { createServerApp } from "../../apps/server/src/app";
import { createGameplaySliceFunctionHandler } from "../../apps/server/src/netlify/gameplay-slice-function";
import type { PostgresPlayerEntryRepository } from "../../apps/server/src/player-entry/postgres-player-entry-repository";

const results = (overrides: Partial<HostedMatchResultsView> = {}): HostedMatchResultsView => ({
  serverInstanceId: "instance:finished",
  serverDisplayName: "Finished Free",
  server: {
    serverInstanceId: "instance:finished",
    status: "ended",
    currentTick: 12_345,
    stateVersion: 47
  },
  finalLockdown: {
    status: "resolved",
    currentPlayerRank: 9,
    leaderboardTop3: []
  },
  currentPlayerStatus: "defeated",
  completedAt: "2026-08-06T12:00:00.000Z",
  completionReason: "final_lockdown_score",
  winner: null,
  top3: [],
  currentPlayerId: "player:member",
  currentAccountPlacement: 9,
  currentAccountFinalScore: 1_234,
  currentAccountScoreBreakdown: { finalScore: 1_234 },
  ...overrides
});

const request = (playerId = "player:member"): SubmitGameplayCommandRequest => ({
  command: {
    id: "command:finished",
    type: "activate-player-boost",
    mode: "free",
    playerId,
    serverInstanceId: "instance:finished",
    issuedAt: "2026-08-06T12:00:01.000Z",
    payload: { boostId: "ghost-network" },
    clientRequestId: null
  },
  focusDistrictId: "district:finished-result-read-only",
  expectedStateVersion: 47
});

describe("account-scoped finished match submit rejection", () => {
  it("returns GAME_FINISHED with the persisted version and never creates gameplay authority", async () => {
    const getMatchResults = vi.fn(async () => results());

    const response = await resolveFinishedAccountSubmitRejection({
      accountId: "account:member",
      request: request(),
      repository: { getMatchResults }
    });

    expect(getMatchResults).toHaveBeenCalledWith("account:member", "instance:finished");
    expect(response).toMatchObject({
      accepted: false,
      readModel: null,
      errors: [{ code: "GAME_FINISHED" }],
      metadata: { serverTick: 12_345, stateVersion: 47 }
    });
  });

  it("derives the member player from persisted account results and rejects a forged playerId", async () => {
    const response = await resolveFinishedAccountSubmitRejection({
      accountId: "account:member",
      request: request("player:forged"),
      repository: { getMatchResults: async () => results() }
    });

    expect(response).toMatchObject({
      accepted: false,
      errors: [{ code: "PLAYER_IDENTITY_MISMATCH" }],
      metadata: { stateVersion: 47 }
    });
  });

  it("does not replace normal gameplay session validation without an ended member result", async () => {
    await expect(resolveFinishedAccountSubmitRejection({
      accountId: "account:member",
      request: request(),
      repository: { getMatchResults: async () => null }
    })).resolves.toBeNull();
    await expect(resolveFinishedAccountSubmitRejection({
      accountId: "account:member",
      request: request(),
      repository: {
        getMatchResults: async () => results({
          server: { ...results().server, status: "running" }
        })
      }
    })).resolves.toBeNull();
  });

  it("exposes only the terminal rejection through the public submit boundary after account login", async () => {
    const getMatchResults = vi.fn(async () => results());
    const server = createServerApp({
      accountIdentityProvider: {
        productionReady: true,
        resolve: async () => ({ accountId: "account:member", provider: "production" })
      }
    });
    const submit = vi.spyOn(server.commandIngress, "submit");
    const handler = createGameplaySliceFunctionHandler({
      cryptoProvider: () => webcrypto,
      environment: { NODE_ENV: "test" },
      server,
      playerEntryRepository: { getMatchResults } as unknown as PostgresPlayerEntryRepository
    });

    const response = await handler({
      httpMethod: "POST",
      path: "/api/gameplay-slice/submit",
      headers: {},
      body: JSON.stringify(request())
    });
    const payload = JSON.parse(response.body ?? "null");

    expect(response.statusCode).toBe(200);
    expect(payload).toMatchObject({
      accepted: false,
      readModel: null,
      errors: [{ code: "GAME_FINISHED" }],
      metadata: { serverTick: 12_345, stateVersion: 47 }
    });
    expect(getMatchResults).toHaveBeenCalledTimes(1);
    expect(submit).not.toHaveBeenCalled();
  });

  it("does not let a snapshot token stand in for the authenticated account membership", async () => {
    const getMatchResults = vi.fn(async () => results());
    const server = createServerApp({
      accountIdentityProvider: {
        productionReady: true,
        resolve: async () => null
      }
    });
    const handler = createGameplaySliceFunctionHandler({
      cryptoProvider: () => webcrypto,
      environment: { NODE_ENV: "test" },
      server,
      playerEntryRepository: { getMatchResults } as unknown as PostgresPlayerEntryRepository
    });

    const response = await handler({
      httpMethod: "POST",
      path: "/api/gameplay-slice/submit",
      headers: {},
      body: JSON.stringify({ ...request(), snapshotToken: "not-account-authority" })
    });
    const payload = JSON.parse(response.body ?? "null");

    expect(payload).toMatchObject({
      accepted: false,
      readModel: null,
      errors: [{ code: "SESSION_REQUIRED" }]
    });
    expect(getMatchResults).not.toHaveBeenCalled();
  });
});
