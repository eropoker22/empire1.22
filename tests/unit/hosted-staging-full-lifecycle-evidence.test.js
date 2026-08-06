import { describe, expect, it } from "vitest";
import {
  canonicalHash,
  membershipRanking,
  parseJsonValue,
  playerRanking,
  safeHash
} from "../../tools/seed/hosted-staging-full-lifecycle-evidence.mjs";

describe("hosted staging full lifecycle evidence", () => {
  it("hashes equivalent JSON values independently of object key order", () => {
    expect(canonicalHash({ b: 2, a: { d: 4, c: 3 } }))
      .toBe(canonicalHash({ a: { c: 3, d: 4 }, b: 2 }));
    expect(canonicalHash(null)).toBeNull();
    expect(safeHash("server-secret-id")).toMatch(/^[0-9a-f]{16}$/);
  });

  it("normalizes snapshot and membership player rankings to the same shape", () => {
    const snapshot = playerRanking({
      ranking: [{
        subjectType: "player",
        subjectId: "player-a",
        rank: 1,
        score: 42,
        scoreBreakdown: { territory: 12, cash: 30 }
      }]
    });
    const membership = membershipRanking([{
      player_id: "player-a",
      final_rank: 1,
      final_score: 42,
      final_score_breakdown: JSON.stringify({ cash: 30, territory: 12 })
    }]);

    expect(canonicalHash(snapshot)).toBe(canonicalHash(membership));
    expect(parseJsonValue("not-json")).toBeNull();
  });
});
