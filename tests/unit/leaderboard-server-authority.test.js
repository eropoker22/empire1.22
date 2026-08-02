import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("page-assets/js/app/features/leaderboard.js", "utf8");
const playerProfileSource = readFileSync("page-assets/js/app/ui/runtimePopupBinders.js", "utf8");

describe("leaderboard server authority", () => {
  it("never maps mock opponents in server-authoritative mode", () => {
    expect(source).toContain("getServerLeaderboardView");
    expect(source).toContain("if (executionMode === GAMEPLAY_EXECUTION_MODES.serverAuthoritative)");
    expect(source).toContain("if (executionMode !== GAMEPLAY_EXECUTION_MODES.localDemo) return []");
    expect(source).not.toContain("DEMO POŘADÍ");
  });

  it("uses score and rank supplied by the server projection", () => {
    expect(source).toContain("entry?.score === null || entry?.score === undefined");
    expect(source).toContain("currentRank: normalizeNumber(entry?.rank)");
    expect(source).toContain("Math.max(0, Number(player.empireScore))");
    expect(source).not.toContain("MOCK_PLAYERS");
    expect(source).toContain('import("../dev-fixtures/leaderboardDemoData.js")');
    expect(source).toContain("Tato statistika se připravuje.");
  });

  it("keeps server capability differences out of the visible renderer schema", () => {
    expect(source).toContain('const AUTHORITATIVE_LEADERBOARD_TABS = new Set(["overall", "influence", "districts", "alliance"]);');
    expect(source).toContain('<span>Wanted</span>');
    expect(source).toContain('["Clean", formatOptionalMoney(player.cleanMoney)]');
    expect(source).toContain('["Aktivita", formatOptionalActivity(player.lastActiveMinutes)]');
    expect(source).not.toContain('serverMode ? "Aktivní" : "Online / aktivní"');
    expect(source).not.toContain('? "Stav" : "Wanted"');
    expect(source).not.toContain("SERVER SNAPSHOT");
  });

  it("reuses leaderboard score for the player profile", () => {
    expect(playerProfileSource).toContain('import { getCurrentPlayerId, getLeaderboardPlayers } from "../features/leaderboard.js";');
    expect(playerProfileSource).toContain("const leaderboardPlayers = getLeaderboardPlayers();");
    expect(playerProfileSource).toContain("const empireScore = currentLeaderboardEntry?.empireScore ?? null;");
  });
});
