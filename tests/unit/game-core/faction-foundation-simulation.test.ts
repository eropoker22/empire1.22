import { describe, expect, it } from "vitest";
import { PLAYER_FACTION_IDS } from "@empire/shared-types";
import { runFreeModePacingMultiSeedAudit } from "../../../tools/debug/src/free-mode-pacing/simulate";

describe("faction balance simulation", () => {
  it("aggregates faction survival stats in a multi-seed pacing audit", () => {
    const report = runFreeModePacingMultiSeedAudit({
      seed: "unit-faction-passive-balance",
      seedCount: 2,
      maxHours: 24,
      botCount: 20,
      districtCount: 60,
      tickStride: 720,
      variantName: "elimination-8h-stop8"
    });

    expect(report.results).toHaveLength(2);
    expect(Object.keys(report.factionStats).sort()).toEqual([...PLAYER_FACTION_IDS].sort());
    expect(report.factionStats.mafian.averageSurvivalTimeHours).toBeGreaterThan(0);
    expect(report.factionStats.kartel.averageAttackCount).toBeGreaterThanOrEqual(0);
    expect(report.behaviorProfileByFaction.hackeri).toContain("under-modeled");
    expect(report.factionAttackRate["motorkarsky-gang"]).toBeGreaterThanOrEqual(0);
    expect(report.factionSpyRate["tajna-organizace"]).toBeGreaterThanOrEqual(0);
    expect(report.factionTop8Rate.mafian).toBeGreaterThanOrEqual(0);
    expect(report.topFactionByControl).toEqual(expect.any(String));
  });
});
