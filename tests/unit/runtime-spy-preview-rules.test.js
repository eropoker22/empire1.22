import { describe, expect, it } from "vitest";
import {
  LEGACY_SPY_CRITICAL_HEAT_GAIN,
  LEGACY_SPY_MISSION_SPY_COUNT,
  SPY_OUTCOMES,
  applySpyIntelOutcome,
  calculateSpySuccessChance,
  createCapturedSpyMission,
  getSpyHeatGainForOutcome,
  improveSpyOutcomeByQuality,
  resolveSpyOutcome,
  resolveSpyScenario
} from "../../packages/game-core/src/legacy-page/spy-preview-rules.js";
import { SPY_CAPTURE_COOLDOWN_MS } from "../../page-assets/js/app/runtime/combatData.js";

describe("legacy spy preview rules", () => {
  it("always sends exactly one spy per mission", () => {
    expect(LEGACY_SPY_MISSION_SPY_COUNT).toBe(1);
  });

  it("resolves probabilistic outcomes without using the district id pattern", () => {
    expect(resolveSpyScenario({ targetDistrictId: 3 }, { roll: 0.1, qualityRoll: 1 })).toBe("Úspěch");
    expect(resolveSpyScenario({ targetDistrictId: 3 }, { roll: 0.82, failureRoll: 1, qualityRoll: 1 })).toBe("Částečný úspěch");
    expect(resolveSpyScenario({ targetDistrictId: 3 }, { roll: 0.98, failureRoll: 1, qualityRoll: 1 })).toBe("Neúspěch");
    expect(resolveSpyScenario({ targetDistrictId: 3 }, { roll: 0.98, failureRoll: 0, qualityRoll: 1 })).toBe("Kritický neúspěch");
  });

  it("success unlocks occupy by adding the target to occupiable intel", () => {
    const intel = applySpyIntelOutcome({
      occupiableDistrictIds: [],
      revealedTypeDistrictIds: [],
      revealedDefenseDistrictIds: []
    }, 12, SPY_OUTCOMES.success);

    expect(intel.occupiableDistrictIds).toContain(12);
    expect(intel.revealedTypeDistrictIds).toContain(12);
    expect(intel.revealedDefenseDistrictIds).toContain(12);
  });

  it("partial reveals type intel but does not unlock occupy", () => {
    const intel = applySpyIntelOutcome({
      occupiableDistrictIds: [],
      revealedTypeDistrictIds: [],
      revealedDefenseDistrictIds: []
    }, 12, SPY_OUTCOMES.partial);

    expect(intel.occupiableDistrictIds).not.toContain(12);
    expect(intel.revealedTypeDistrictIds).toContain(12);
    expect(intel.revealedDefenseDistrictIds).not.toContain(12);
  });

  it("failed missions return the spy only after the capture cooldown", () => {
    const captured = createCapturedSpyMission(
      { id: "spy-mission:test", targetDistrictId: 4 },
      { now: 10_000, cooldownMs: SPY_CAPTURE_COOLDOWN_MS }
    );

    expect(captured.status).toBe("captured");
    expect(Date.parse(captured.cooldownUntil) - Date.parse(captured.capturedAt)).toBe(SPY_CAPTURE_COOLDOWN_MS);
  });

  it("critical failure adds heat", () => {
    expect(getSpyHeatGainForOutcome(SPY_OUTCOMES.failed)).toBe(0);
    expect(getSpyHeatGainForOutcome(SPY_OUTCOMES.criticalFailed)).toBe(LEGACY_SPY_CRITICAL_HEAT_GAIN);
  });

  it("Ghost Serum info quality improves chance or outcome quality", () => {
    const baseChance = calculateSpySuccessChance({ targetSecurity: 30, cameraCount: 1, alarmCount: 1, infoQualityPct: 0 });
    const boostedChance = calculateSpySuccessChance({ targetSecurity: 30, cameraCount: 1, alarmCount: 1, infoQualityPct: 30 });

    expect(boostedChance).toBeGreaterThan(baseChance);
    expect(improveSpyOutcomeByQuality(SPY_OUTCOMES.failed, 80, { qualityRoll: 0 })).toBe(SPY_OUTCOMES.partial);
  });

  it("success chance is clamped to 8-95 percent", () => {
    expect(calculateSpySuccessChance({ targetSecurity: 999, cameraCount: 99, alarmCount: 99, infoQualityPct: 0 })).toBe(0.08);
    expect(calculateSpySuccessChance({ targetSecurity: 0, cameraCount: 0, alarmCount: 0, infoQualityPct: 999 })).toBe(0.95);
  });

  it("can force full success for the dev-only override", () => {
    expect(resolveSpyOutcome({ targetDistrictId: 3 }, {
      devOnlyFullSuccessChance: 0.99,
      roll: 0.98
    })).toBe(SPY_OUTCOMES.success);
  });
});
