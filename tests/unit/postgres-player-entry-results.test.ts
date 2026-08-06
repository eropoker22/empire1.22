import { describe, expect, it, vi } from "vitest";
import type { MatchResult } from "@empire/shared-types";
import {
  loadHostedMatchResultsForAccount,
  persistHostedMatchResult
} from "../../apps/server/src/player-entry/postgres-player-entry-results";
import type { PostgresQueryable } from "../../apps/server/src/runtime/persistence/postgres";

const matchResult: MatchResult = {
  id: "match:instance:alpha",
  serverInstanceId: "instance:alpha",
  endedAt: "2026-07-21T20:00:00.000Z",
  winnerPlayerId: "player:one",
  winnerAllianceId: null,
  reason: "final_lockdown_score",
  ranking: [
    { subjectType: "player", subjectId: "player:one", rank: 1, score: 9000,
      scoreBreakdown: { finalScore: 9000, heatPenalty: 0 } },
    { subjectType: "player", subjectId: "player:two", rank: 2, score: 7000,
      scoreBreakdown: { finalScore: 7000, heatPenalty: 500 } }
  ]
};

describe("hosted match results persistence", () => {
  it("persists one immutable result and freezes each membership rank and score", async () => {
    const query = vi.fn(async (sql: string, _values?: readonly unknown[]) => response(
      sql.includes("RETURNING match_result_id")
        ? [{ match_result_id: matchResult.id }]
        : sql.includes("UPDATE empire_server_memberships") ? [{}] : []
    ));

    await persistHostedMatchResult({ query } as PostgresQueryable, "instance:alpha", matchResult,
      "2026-07-21T20:00:01.000Z");

    expect(query).toHaveBeenCalledTimes(3);
    expect(query.mock.calls[0]?.[0]).toContain("empire_hosted_match_results");
    expect(query.mock.calls[0]?.[0]).toContain("ON CONFLICT (server_instance_id) DO NOTHING");
    expect(query.mock.calls[0]?.[0]).not.toContain("DO UPDATE");
    expect(query.mock.calls.slice(1).every(([sql]) => String(sql).includes("final_score_breakdown"))).toBe(true);
    expect(query.mock.calls[1]?.[1]).toEqual(expect.arrayContaining(["player:one", 1, 9000]));
  });

  it("treats the same canonical persisted payload as an idempotent replay without rewriting ranks", async () => {
    const query = vi.fn(async (sql: string) => response(sql.startsWith("SELECT match_result_id")
      ? [{ match_result_id: matchResult.id, payload_matches: true, metadata_matches: true }]
      : []));

    await expect(persistHostedMatchResult({ query } as PostgresQueryable, "instance:alpha", matchResult,
      "2026-07-21T20:00:02.000Z")).resolves.toBeUndefined();

    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[1]?.[0]).toContain("result_payload=$2::jsonb AS payload_matches");
    expect(query.mock.calls.some(([sql]) => String(sql).includes("UPDATE empire_server_memberships"))).toBe(false);
  });

  it("rejects a different canonical payload for the same server without overwriting it", async () => {
    const query = vi.fn(async (sql: string) => response(sql.startsWith("SELECT match_result_id")
      ? [{ match_result_id: matchResult.id, payload_matches: false, metadata_matches: false }]
      : []));
    const database = { query } as PostgresQueryable;

    await expect(persistHostedMatchResult(database, "instance:alpha", matchResult,
      "2026-07-21T20:00:01.000Z")).rejects.toMatchObject({ entryCode: "MATCH_RESULT_CONFLICT" });
    expect(query.mock.calls.every(([sql]) => !String(sql).includes("DO UPDATE"))).toBe(true);
  });

  it("rolls back a newly inserted result when any ranked membership is missing", async () => {
    const query = vi.fn(async (sql: string) => response(sql.includes("RETURNING match_result_id")
      ? [{ match_result_id: matchResult.id }]
      : []));

    await expect(persistHostedMatchResult({ query } as PostgresQueryable, "instance:alpha", matchResult,
      "2026-07-21T20:00:01.000Z")).rejects.toMatchObject({ entryCode: "MATCH_RESULT_MEMBERSHIP_CONFLICT" });
  });

  it("returns only public Top 3 data plus the requesting account score breakdown", async () => {
    const query = vi.fn(async (sql: string) => sql.includes("result.result_payload")
      ? response([{
          result_payload: matchResult,
          completed_at: matchResult.endedAt,
          completion_reason: matchResult.reason,
          display_name: "Free Alpha",
          server_status: "ended",
          root_version: 47,
          tick: 12_345,
          final_lockdown_status: "resolved",
          current_player_status: "defeated",
          player_id: "player:two",
          final_rank: 2,
          final_score: 7000,
          final_score_breakdown: { finalScore: 7000, heatPenalty: 500 }
        }])
      : response([
          { player_id: "player:one", display_name: "Alice", gang_name: "Gold Crew" },
          { player_id: "player:two", display_name: "Bob", gang_name: "Night Crew" }
        ]));

    const view = await loadHostedMatchResultsForAccount({ query } as PostgresQueryable,
      "account:two", "instance:alpha");

    expect(view).toMatchObject({
      serverInstanceId: "instance:alpha",
      server: {
        serverInstanceId: "instance:alpha",
        status: "ended",
        currentTick: 12_345,
        stateVersion: 47
      },
      finalLockdown: {
        status: "resolved",
        currentPlayerRank: 2
      },
      currentPlayerStatus: "defeated",
      currentPlayerId: "player:two",
      currentAccountPlacement: 2,
      currentAccountFinalScore: 7000,
      winner: { playerId: "player:one", gangName: "Gold Crew", rank: 1, score: 9000 }
    });
    expect(view?.top3).toHaveLength(2);
    expect(view?.finalLockdown.leaderboardTop3).toEqual(view?.top3);
    expect(view?.currentAccountScoreBreakdown).toEqual({ finalScore: 7000, heatPenalty: 500 });
    expect(view?.top3[0]).not.toHaveProperty("scoreBreakdown");
    expect(query.mock.calls[0]?.[0]).toContain("snapshot.payload #>> '{state,matchResult,id}'=result.match_result_id");
  });

  it("fails closed when the persisted result has no authoritative terminal snapshot state", async () => {
    const query = vi.fn(async (sql: string) => sql.includes("result.result_payload")
      ? response([{
          result_payload: matchResult,
          completed_at: matchResult.endedAt,
          completion_reason: matchResult.reason,
          display_name: "Free Alpha",
          server_status: "ended",
          root_version: 47,
          tick: 12_345,
          final_lockdown_status: null,
          current_player_status: "defeated",
          player_id: "player:two",
          final_rank: 2,
          final_score: 7000,
          final_score_breakdown: {}
        }])
      : response([]));

    await expect(loadHostedMatchResultsForAccount(
      { query } as PostgresQueryable,
      "account:two",
      "instance:alpha"
    )).resolves.toBeNull();
    expect(query).toHaveBeenCalledTimes(1);
  });
});

const response = (rows: unknown[]) => ({ rows, rowCount: rows.length, command: "SELECT", oid: 0, fields: [] }) as never;
