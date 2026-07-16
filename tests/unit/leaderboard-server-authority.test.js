import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("page-assets/js/app/features/leaderboard.js", "utf8");

describe("leaderboard server authority", () => {
  it("never maps mock opponents in server-authoritative mode", () => {
    expect(source).toContain("getServerLeaderboardView");
    expect(source).toContain("if (executionMode === GAMEPLAY_EXECUTION_MODES.serverAuthoritative)");
    expect(source).toContain("if (executionMode !== GAMEPLAY_EXECUTION_MODES.localDemo) return []");
    expect(source).toContain("DEMO POŘADÍ");
  });

  it("uses score and rank supplied by the server projection", () => {
    expect(source).toContain("empireScore: Math.max(0, Number(entry?.score || 0))");
    expect(source).toContain("currentRank: normalizeNumber(entry?.rank)");
    expect(source).toContain("return Math.max(0, Number(player?.empireScore || 0))");
  });
});
