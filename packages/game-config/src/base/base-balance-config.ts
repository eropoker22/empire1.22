import type { BalanceConfig } from "../contracts/balance-config";
import { baseBuildingActionsConfig } from "./base-building-actions-config";
import { baseFixedBuildingsConfig } from "./base-fixed-buildings-config";
import { basePoliceConfig } from "./base-police-config";
import { baseCraftBuildingsConfig, baseProductionBuildingsConfig } from "./base-production-craft-config";
import { createDayNightConfig } from "../public/day-night-config";

/**
 * Responsibility: Neutral default balance values shared by all modes.
 * Belongs here: baseline multipliers and caps reused by free and war.
 * Does not belong here: mode-specific overrides or runtime state.
 */
export const baseBalanceConfig: BalanceConfig = {
  incomeMultiplier: 1,
  productionMultiplier: 1,
  cooldownMultiplier: 1,
  maxPlayersPerServer: 100,
  maxAllianceSize: 10,
  buildSlotLimit: 6,
  eventFrequencyMultiplier: 1,
  allianceLifecycle: {
    readiness: {
      readyIntervalSeconds: 6 * 60 * 60,
      readyButtonAvailableBeforeDueSeconds: 2 * 60 * 60,
      gracePeriodSeconds: 2 * 60 * 60,
      voteDurationSeconds: 2 * 60 * 60,
      voteRetryCooldownSeconds: 2 * 60 * 60
    },
    voluntaryLeavePenalty: {
      allianceJoinLockoutSeconds: 12 * 60 * 60,
      allianceCreateLockoutSeconds: 12 * 60 * 60,
      influenceDebuffSeconds: 8 * 60 * 60,
      actionCooldownDebuffSeconds: 6 * 60 * 60,
      formerAllyTruceSeconds: 60 * 60,
      influenceGenerationMultiplier: 0.8,
      actionCooldownMultiplier: 1.15,
      blocksAllianceDefenseSupport: true
    },
    inactiveKickPenalty: {
      allianceJoinLockoutSeconds: 6 * 60 * 60,
      allianceCreateLockoutSeconds: 6 * 60 * 60,
      influenceDebuffSeconds: 0,
      actionCooldownDebuffSeconds: 0,
      formerAllyTruceSeconds: 60 * 60,
      influenceGenerationMultiplier: 1,
      actionCooldownMultiplier: 1,
      blocksAllianceDefenseSupport: true
    },
    disbandPenalty: {
      allianceJoinLockoutSeconds: 30 * 60,
      allianceCreateLockoutSeconds: 30 * 60,
      influenceDebuffSeconds: 0,
      actionCooldownDebuffSeconds: 0,
      formerAllyTruceSeconds: 60 * 60,
      influenceGenerationMultiplier: 1,
      actionCooldownMultiplier: 1,
      blocksAllianceDefenseSupport: false
    },
    administrativeRemovalPenalty: {
      allianceJoinLockoutSeconds: 0,
      allianceCreateLockoutSeconds: 0,
      influenceDebuffSeconds: 0,
      actionCooldownDebuffSeconds: 0,
      formerAllyTruceSeconds: 0,
      influenceGenerationMultiplier: 1,
      actionCooldownMultiplier: 1,
      blocksAllianceDefenseSupport: false
    },
    affectedCooldownActionIds: ["spy", "heist", "attack", "rob"],
    exitPendingTimeoutSeconds: 15 * 60
  },
  policePressureMultiplier: 1,
  raidIntensityMultiplier: 1,
  police: basePoliceConfig,
  expansionSpeedMultiplier: 1,
  dayLengthTicks: 12,
  nightLengthTicks: 12,
  dayNight: createDayNightConfig({
    dayDurationTicks: 12,
    nightDurationTicks: 12
  }),
  victoryConditionKey: "default-control",
  districtControlVictoryThreshold: 1,
  startingResources: {
    cash: 1000,
    "dirty-cash": 250,
    chemicals: 10,
    biomass: 6,
    "metal-parts": 8,
    "tech-core": 2
  },
  conflict: {
    spyCooldownTicks: 2,
    attackCooldownTicks: 2,
    occupyCooldownTicks: 2,
    occupyFailureChancePct: 5,
    minAttackDurationTicks: 2,
    attackHeatGain: 6,
    occupyHeatGain: 2,
    occupyInfluenceCost: 5,
    occupyPopulationRefundPct: 10,
    spyBaseSuccessChance: 0.72,
    spyTrapRevealChance: 0.22,
    trapAttackLosses: 1,
    reportsLimit: 6,
    catastropheChance: 0.08
  },
  productionBuildings: baseProductionBuildingsConfig,
  craftBuildings: baseCraftBuildingsConfig,
  fixedBuildings: baseFixedBuildingsConfig,
  buildingActions: baseBuildingActionsConfig
};
