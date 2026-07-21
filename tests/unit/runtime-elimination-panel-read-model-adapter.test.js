import { describe, expect, it } from "vitest";
import {
  createEliminationPanelViewModel,
  createFinalLockdownPanelViewModel
} from "../../page-assets/js/app/runtime/eliminationPanelReadModelAdapter.js";

describe("authoritative elimination panel adapters", () => {
  it("renders an honest unavailable state without demo values", () => {
    const view = createEliminationPanelViewModel(null);

    expect(view.countdownValue).toBe("—");
    expect(view.leaderboard).toEqual([]);
    expect(JSON.stringify(view)).not.toContain("8.47M");
  });

  it("shows the control-server elimination state without starting a local countdown", () => {
    const view = createEliminationPanelViewModel({
      enabled: false,
      activePlayersRemaining: 2
    });

    expect(view.subtitle).toBe("OČISTA JE NA KONTROLNÍM SERVERU VYPNUTÁ");
    expect(view.countdownValue).toBe("VYPNUTO");
    expect(view.leaderboard).toEqual([]);
  });

  it("maps live elimination score, danger zone and countdown from the read model", () => {
    const view = createEliminationPanelViewModel({
      enabled: true,
      eliminationsStopped: false,
      ticksUntilNextElimination: 120,
      activePlayersRemaining: 9,
      currentPlayerScore: 1250,
      currentPlayerRankFromBottom: 2,
      currentPlayerStatus: "safe",
      currentPlayerScoreBreakdown: { controlledDistricts: 1000, heatPenalty: -50 },
      dangerZone: [{
        rankFromBottom: 1,
        playerId: "player:2",
        playerName: "Rival",
        score: 900,
        controlledDistricts: 1,
        isCurrentPlayer: false
      }]
    }, { tickRateMs: 1000, currentTick: 20 });

    expect(view.countdownValue).toBe("2min 00s");
    expect(view.metrics[0].key).toBe("score");
    expect(view.metrics[0].value.replace(/\u00a0/gu, " ")).toBe("1 250");
    expect(view.leaderboard[0]).toMatchObject({ playerId: "player:2", name: "Rival", score: "900" });
    expect(view.scoreBreakdown.find((entry) => entry.label === "Distrikty")?.value.replace(/\u00a0/gu, " "))
      .toBe("1 000");
    expect(view.scoreBreakdown).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Heat postih", negative: true })
    ]));
  });

  it("maps Final Lockdown Top 3 and gaps without synthesizing missing values", () => {
    const view = createFinalLockdownPanelViewModel({
      enabled: true,
      active: true,
      status: "active",
      pausedByQuietHours: false,
      remainingActiveTicks: 60,
      currentPlayerRank: 4,
      currentPlayerFinalScore: 4000,
      scoreGapToTop3: 250,
      scoreGapToFirst: 1200,
      currentPlayerScoreBreakdown: { finalScore: 4000 },
      leaderboardTop3: [{
        rank: 1,
        playerId: "player:1",
        playerName: "Leader",
        score: 5200,
        controlledDistricts: 4,
        isCurrentPlayer: false
      }]
    }, { tickRateMs: 1000 });

    expect(view.countdownValue).toBe("1min 00s");
    expect(view.metrics).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "rank", value: "#4" }),
      expect.objectContaining({ key: "top3", value: "250" })
    ]));
    expect(view.leaderboard).toHaveLength(1);
    expect(view.leaderboard[0]).toMatchObject({ playerId: "player:1", name: "Leader" });
    expect(view.leaderboard[0].score.replace(/\u00a0/gu, " ")).toBe("5 200");
  });
});
