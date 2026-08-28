import type { ResolvedGameModeConfig } from "../contracts/game-mode-config";

type ConflictConfig = NonNullable<ResolvedGameModeConfig["balance"]["conflict"]>;

export const validateConflictConfig = (conflict: ConflictConfig): void => {
  if (conflict.spyCooldownTicks < 0) {
    throw new Error("Conflict config requires a non-negative spyCooldownTicks.");
  }
  if ((conflict.spyAuthorizationTtlTicks ?? 0) < 0) {
    throw new Error("Conflict config requires a non-negative spyAuthorizationTtlTicks.");
  }
  if ((conflict.spySlotCooldownTicks ?? 0) < 0) {
    throw new Error("Conflict config requires a non-negative spySlotCooldownTicks.");
  }
  if ((conflict.spyCaptureCooldownTicks ?? 0) < 0) {
    throw new Error("Conflict config requires a non-negative spyCaptureCooldownTicks.");
  }
  const defenseCapacity = conflict.defenseCapacity;
  if (defenseCapacity) {
    if (defenseCapacity.baseCapacityPoints <= 0) {
      throw new Error("Conflict defense capacity requires positive baseCapacityPoints.");
    }
    for (const itemId of ["vest", "barricades", "cameras", "defense-tower", "alarm"] as const) {
      if (!Number.isFinite(defenseCapacity.itemWeights[itemId]) || defenseCapacity.itemWeights[itemId] <= 0) {
        throw new Error(`Conflict defense capacity requires a positive weight for ${itemId}.`);
      }
    }
  }

  for (const [key, value] of [
    ["attackCooldownTicks", conflict.attackCooldownTicks],
    ["robCooldownTicks", conflict.robCooldownTicks ?? 0],
    ["heistCooldownTicks", conflict.heistCooldownTicks ?? 0],
    ["occupyCooldownTicks", conflict.occupyCooldownTicks ?? 0],
    ["minAttackDurationTicks", conflict.minAttackDurationTicks ?? 0],
    ["attackHeatGain", conflict.attackHeatGain ?? 0],
    ["occupyHeatGain", conflict.occupyHeatGain ?? 0],
    ["occupyInfluenceCost", conflict.occupyInfluenceCost ?? 0],
    ["occupyRepeatInfluenceCost", conflict.occupyRepeatInfluenceCost ?? 0],
    ["trapAttackLosses", conflict.trapAttackLosses]
  ] as const) {
    if (value < 0) {
      throw new Error(`Conflict config requires a non-negative ${key}.`);
    }
  }

  for (const [key, value] of [
    ["occupyFailureChancePct", conflict.occupyFailureChancePct ?? 0],
    ["occupyPopulationRefundPct", conflict.occupyPopulationRefundPct ?? 0]
  ] as const) {
    if (value < 0 || value > 100) {
      throw new Error(`Conflict config requires ${key} between 0 and 100.`);
    }
  }

  if (conflict.reportsLimit <= 0) {
    throw new Error("Conflict config requires a positive reportsLimit.");
  }
  for (const [key, value] of [
    ["spyBaseSuccessChance", conflict.spyBaseSuccessChance],
    ["spyTrapRevealChance", conflict.spyTrapRevealChance]
  ] as const) {
    if (value < 0 || value > 1) {
      throw new Error(`Conflict config requires ${key} between 0 and 1.`);
    }
  }
};
