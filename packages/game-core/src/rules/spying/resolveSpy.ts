import type { DefenseWeaponId } from "@empire/shared-types";
import { clamp, deterministicUnitInterval } from "../../utils/math";

export interface ResolveSpyInput {
  worldSeed: string;
  playerId: string;
  targetDistrictId: string;
  tick: number;
  defenseLoadout: Partial<Record<DefenseWeaponId, number>>;
  targetSecurity: number;
  hasActiveTrap: boolean;
  spyBaseSuccessChance: number;
  spyTrapRevealChance: number;
  cameraStrengthBonusPct?: number;
  alarmStrengthBonusPct?: number;
  infoQualityPct?: number;
}

export interface ResolveSpyResult {
  result: SpyOutcome;
  detectedDefense: Partial<Record<DefenseWeaponId, number>>;
  trapDetected: boolean;
  occupyUnlocked: boolean;
  revealedType: boolean;
  revealedDefense: boolean;
  heatGained: number;
}

export type SpyOutcome = "success" | "partial" | "failed" | "critical_failed";

export const LEGACY_SPY_CRITICAL_HEAT_GAIN = 7;

/**
 * Responsibility: Pure deterministic spy outcome helper.
 * Belongs here: success/reveal rolls derived from authoritative inputs.
 * Does not belong here: state persistence, transport, or client rendering.
 */
export const resolveSpy = (input: ResolveSpyInput): ResolveSpyResult => {
  const cameraCount = input.defenseLoadout.cameras ?? 0;
  const alarmCount = input.defenseLoadout.alarm ?? 0;
  const infoQualityPct = Math.max(0, Number(input.infoQualityPct ?? 0));
  const targetSecurity = Math.max(0, Number(input.targetSecurity ?? 0));
  const cameraEffectiveness = 1 + Math.max(0, Number(input.cameraStrengthBonusPct || 0)) / 100;
  const alarmEffectiveness = 1 + Math.max(0, Number(input.alarmStrengthBonusPct || 0)) / 100;
  const securityPenalty = Math.min(0.42, targetSecurity / 250);
  const cameraPenalty = Math.min(0.2, cameraCount * 0.04 * cameraEffectiveness);
  const alarmPenalty = Math.min(0.18, alarmCount * 0.08 * alarmEffectiveness);
  const qualityBonus = Math.min(0.3, infoQualityPct * 0.0025);
  const successChance = clamp(
    input.spyBaseSuccessChance - securityPenalty - cameraPenalty - alarmPenalty + qualityBonus,
    0.08,
    0.95
  );
  const successRoll = deterministicUnitInterval(
    `${input.worldSeed}:spy:success:${input.playerId}:${input.targetDistrictId}:${input.tick}`
  );
  const initialResult = resolveSpyOutcomeFromRolls({
    roll: successRoll,
    failureRoll: deterministicUnitInterval(
      `${input.worldSeed}:spy:failure:${input.playerId}:${input.targetDistrictId}:${input.tick}`
    ),
    successChance,
    targetSecurity,
    cameraCount,
    alarmCount,
    infoQualityPct
  });
  const result = improveSpyOutcomeByQuality(initialResult, infoQualityPct, deterministicUnitInterval(
    `${input.worldSeed}:spy:quality:${input.playerId}:${input.targetDistrictId}:${input.tick}`
  ));
  const trapRevealRoll = deterministicUnitInterval(
    `${input.worldSeed}:spy:trap:${input.playerId}:${input.targetDistrictId}:${input.tick}`
  );
  const trapDetected =
    result === "success" && input.hasActiveTrap && trapRevealRoll <= input.spyTrapRevealChance;

  return {
    result,
    detectedDefense: result === "success" ? filterDefenseLoadout(input.defenseLoadout) : {},
    trapDetected,
    occupyUnlocked: result === "success",
    revealedType: result === "success" || result === "partial",
    revealedDefense: result === "success",
    heatGained: result === "critical_failed" ? LEGACY_SPY_CRITICAL_HEAT_GAIN : 0
  };
};

const resolveSpyOutcomeFromRolls = (input: {
  roll: number;
  failureRoll: number;
  successChance: number;
  targetSecurity: number;
  cameraCount: number;
  alarmCount: number;
  infoQualityPct: number;
}): SpyOutcome => {
  if (input.roll < input.successChance) {
    return "success";
  }

  const partialWindow = clamp(
    0.18
      + input.infoQualityPct * 0.002
      - input.targetSecurity / 900
      - input.cameraCount * 0.012
      - input.alarmCount * 0.018,
    0.08,
    0.34
  );
  if (input.roll < Math.min(0.97, input.successChance + partialWindow)) {
    return "partial";
  }

  const criticalChance = clamp(
    0.08
      + input.targetSecurity / 360
      + input.cameraCount * 0.025
      + input.alarmCount * 0.045
      - input.infoQualityPct * 0.001,
    0.04,
    0.42
  );

  return input.failureRoll < criticalChance ? "critical_failed" : "failed";
};

const improveSpyOutcomeByQuality = (
  outcome: SpyOutcome,
  infoQualityPct: number,
  qualityRoll: number
): SpyOutcome => {
  if (infoQualityPct < 30 || outcome === "success") {
    return outcome;
  }

  const improveChance = clamp((infoQualityPct - 20) / 140, 0, 0.55);
  if (qualityRoll >= improveChance) {
    return outcome;
  }

  if (outcome === "critical_failed") {
    return "failed";
  }
  if (outcome === "failed") {
    return "partial";
  }
  if (outcome === "partial") {
    return "success";
  }
  return outcome;
};

const filterDefenseLoadout = (
  loadout: Partial<Record<DefenseWeaponId, number>>
): Partial<Record<DefenseWeaponId, number>> =>
  Object.fromEntries(
    Object.entries(loadout).filter(([, amount]) => Math.max(0, Number(amount ?? 0)) > 0)
  ) as Partial<Record<DefenseWeaponId, number>>;
