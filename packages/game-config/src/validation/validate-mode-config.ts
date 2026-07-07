import type { ResolvedGameModeConfig } from "../contracts/game-mode-config";

/**
 * Responsibility: Guards resolved mode configs against obviously invalid structural values.
 * Belongs here: basic invariant checks for config assembly.
 * Does not belong here: environment loading or gameplay execution.
 */
export const validateModeConfig = (config: ResolvedGameModeConfig): ResolvedGameModeConfig => {
  if (config.tickRateMs <= 0) {
    throw new Error("Mode config requires a positive tickRateMs.");
  }

  if (config.balance.maxPlayersPerServer <= 0) {
    throw new Error("Mode config requires a positive maxPlayersPerServer.");
  }

  if (config.balance.maxAllianceSize <= 0) {
    throw new Error("Mode config requires a positive maxAllianceSize.");
  }

  if (config.balance.maxAllianceSize > 4) {
    throw new Error("Mode config allows alliances with at most 4 players.");
  }

  const allianceLifecycle = config.balance.allianceLifecycle;
  if (allianceLifecycle) {
    const readiness = allianceLifecycle.readiness;
    for (const [key, value] of [
      ["readyIntervalSeconds", readiness.readyIntervalSeconds],
      ["readyButtonAvailableBeforeDueSeconds", readiness.readyButtonAvailableBeforeDueSeconds],
      ["gracePeriodSeconds", readiness.gracePeriodSeconds],
      ["voteDurationSeconds", readiness.voteDurationSeconds],
      ["voteRetryCooldownSeconds", readiness.voteRetryCooldownSeconds],
      ["exitPendingTimeoutSeconds", allianceLifecycle.exitPendingTimeoutSeconds]
    ] as const) {
      if (value < 0) {
        throw new Error(`Alliance lifecycle config requires a non-negative ${key}.`);
      }
    }

    if (readiness.readyIntervalSeconds <= 0 || readiness.voteDurationSeconds <= 0) {
      throw new Error("Alliance lifecycle config requires positive READY and vote durations.");
    }

    if (readiness.readyButtonAvailableBeforeDueSeconds > readiness.readyIntervalSeconds) {
      throw new Error("Alliance READY button window cannot exceed the READY interval.");
    }

    for (const [key, value] of [
      ["voluntaryLeavePenalty", allianceLifecycle.voluntaryLeavePenalty],
      ["inactiveKickPenalty", allianceLifecycle.inactiveKickPenalty],
      ["disbandPenalty", allianceLifecycle.disbandPenalty],
      ["administrativeRemovalPenalty", allianceLifecycle.administrativeRemovalPenalty]
    ] as const) {
      if ((value.statDebuffSeconds ?? 0) < 0) {
        throw new Error(`Alliance lifecycle config requires a non-negative statDebuffSeconds for ${key}.`);
      }
      if (value.influenceGenerationMultiplier <= 0 || value.actionCooldownMultiplier <= 0) {
        throw new Error(`Alliance lifecycle config requires positive multipliers for ${key}.`);
      }
      for (const [multiplierKey, multiplier] of [
        ["attackMultiplier", value.attackMultiplier],
        ["defenseMultiplier", value.defenseMultiplier],
        ["productionMultiplier", value.productionMultiplier],
        ["incomeMultiplier", value.incomeMultiplier]
      ] as const) {
        if (multiplier !== undefined && multiplier <= 0) {
          throw new Error(`Alliance lifecycle config requires a positive ${multiplierKey} for ${key}.`);
        }
      }
    }
  }

  const elimination = config.balance.elimination;
  if (elimination?.enabled) {
    for (const [key, value] of [
      ["intervalTicks", elimination.intervalTicks],
      ["firstEliminationTick", elimination.firstEliminationTick],
      ["minActivePlayers", elimination.minActivePlayers],
      ["dangerZoneSize", elimination.dangerZoneSize],
      ["defeatedDistrictLockTicks", elimination.defeatedDistrictLockTicks]
    ] as const) {
      if (value < 0) {
        throw new Error(`Elimination config requires a non-negative ${key}.`);
      }
    }

    if (elimination.intervalTicks <= 0) {
      throw new Error("Elimination config requires a positive intervalTicks.");
    }
  }

  const finalLockdown = config.balance.finalLockdown;
  if (finalLockdown?.enabled) {
    for (const [key, value] of [
      ["triggerActivePlayers", finalLockdown.triggerActivePlayers],
      ["activeDurationTicks", finalLockdown.activeDurationTicks],
      ["topRankCount", finalLockdown.topRankCount],
      ["downtownDistrictBonus", finalLockdown.downtownDistrictBonus],
      ["rareBuildingBonus", finalLockdown.rareBuildingBonus],
      ["heatPenaltyStart", finalLockdown.heatPenaltyStart],
      ["heatPenaltyPerPoint", finalLockdown.heatPenaltyPerPoint],
      ["extremeHeatPenaltyStart", finalLockdown.extremeHeatPenaltyStart],
      ["extremeHeatPenaltyPerPoint", finalLockdown.extremeHeatPenaltyPerPoint]
    ] as const) {
      if (value < 0) {
        throw new Error(`Final Lockdown config requires a non-negative ${key}.`);
      }
    }
    if (finalLockdown.triggerActivePlayers <= 0) {
      throw new Error("Final Lockdown config requires a positive triggerActivePlayers.");
    }
    if (finalLockdown.activeDurationTicks <= 0) {
      throw new Error("Final Lockdown config requires a positive activeDurationTicks.");
    }
    if (finalLockdown.topRankCount <= 0) {
      throw new Error("Final Lockdown config requires a positive topRankCount.");
    }
  }

  const victoryThreshold = config.balance.districtControlVictoryThreshold ?? 1;
  if (victoryThreshold <= 0 || victoryThreshold > 1) {
    throw new Error("Mode config requires districtControlVictoryThreshold between 0 and 1.");
  }

  for (const [key, value] of [
    ["minimumVictoryTicks", config.balance.minimumVictoryTicks],
    ["districtControlHoldTicks", config.balance.districtControlHoldTicks],
    ["hardTimeoutTicks", config.balance.hardTimeoutTicks]
  ] as const) {
    if (value !== undefined && value < 0) {
      throw new Error(`Mode config requires a non-negative ${key}.`);
    }
  }

  if (!config.technical.storageKeyPrefix) {
    throw new Error("Mode config requires a storageKeyPrefix.");
  }

  if (config.balance.conflict) {
    if (config.balance.conflict.spyCooldownTicks < 0) {
      throw new Error("Conflict config requires a non-negative spyCooldownTicks.");
    }

    if (config.balance.conflict.attackCooldownTicks < 0) {
      throw new Error("Conflict config requires a non-negative attackCooldownTicks.");
    }

    if ((config.balance.conflict.robCooldownTicks ?? 0) < 0) {
      throw new Error("Conflict config requires a non-negative robCooldownTicks.");
    }

    if ((config.balance.conflict.heistCooldownTicks ?? 0) < 0) {
      throw new Error("Conflict config requires a non-negative heistCooldownTicks.");
    }

    if ((config.balance.conflict.occupyCooldownTicks ?? 0) < 0) {
      throw new Error("Conflict config requires a non-negative occupyCooldownTicks.");
    }

    if ((config.balance.conflict.occupyFailureChancePct ?? 0) < 0 || (config.balance.conflict.occupyFailureChancePct ?? 0) > 100) {
      throw new Error("Conflict config requires occupyFailureChancePct between 0 and 100.");
    }

    if ((config.balance.conflict.minAttackDurationTicks ?? 0) < 0) {
      throw new Error("Conflict config requires a non-negative minAttackDurationTicks.");
    }

    if ((config.balance.conflict.attackHeatGain ?? 0) < 0) {
      throw new Error("Conflict config requires a non-negative attackHeatGain.");
    }

    if ((config.balance.conflict.occupyHeatGain ?? 0) < 0) {
      throw new Error("Conflict config requires a non-negative occupyHeatGain.");
    }

    if ((config.balance.conflict.occupyInfluenceCost ?? 0) < 0) {
      throw new Error("Conflict config requires a non-negative occupyInfluenceCost.");
    }

    if ((config.balance.conflict.occupyPopulationRefundPct ?? 0) < 0 || (config.balance.conflict.occupyPopulationRefundPct ?? 0) > 100) {
      throw new Error("Conflict config requires occupyPopulationRefundPct between 0 and 100.");
    }

    if (config.balance.conflict.trapAttackLosses < 0) {
      throw new Error("Conflict config requires a non-negative trapAttackLosses.");
    }

    if (config.balance.conflict.reportsLimit <= 0) {
      throw new Error("Conflict config requires a positive reportsLimit.");
    }

    for (const [key, value] of [
      ["spyBaseSuccessChance", config.balance.conflict.spyBaseSuccessChance],
      ["spyTrapRevealChance", config.balance.conflict.spyTrapRevealChance]
    ] as const) {
      if (value < 0 || value > 1) {
        throw new Error(`Conflict config requires ${key} between 0 and 1.`);
      }
    }
  }

  for (const craftBuilding of Object.values(config.balance.craftBuildings ?? {})) {
    for (const recipe of Object.values(craftBuilding.recipes)) {
      if (recipe.durationTicks <= 0) {
        throw new Error(`Craft recipe "${recipe.label}" requires a positive durationTicks.`);
      }
    }
  }

  for (const action of Object.values(config.balance.buildingActions ?? {})) {
    if (!action.actionId || !action.buildingType) {
      throw new Error("Building action config requires actionId and buildingType.");
    }

    if (action.durationMs < 0 || action.cooldownMs < 0) {
      throw new Error(`Building action "${action.actionId}" requires non-negative durationMs and cooldownMs.`);
    }
  }

  return config;
};
