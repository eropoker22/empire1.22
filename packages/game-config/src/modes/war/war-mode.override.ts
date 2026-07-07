import type { ResolvedGameModeConfig } from "../../contracts/game-mode-config";
import { basePoliceConfig } from "../../base/base-police-config";
import { createDayNightConfig } from "../../public/day-night-config";

const WAR_MODE_TICK_RATE_MS = 15000;
// 960 ticks at a 15s War tick rate is 4 hours per day/night phase.
const WAR_MODE_DAY_NIGHT_PHASE_TICKS = 960;
const WAR_MODE_RAID_DURATION_TICKS = Math.ceil((30 * 60 * 1000) / WAR_MODE_TICK_RATE_MS);

/**
 * Responsibility: War mode override focused on longer pacing and larger coordination windows.
 * Belongs here: only values that differ from the shared base config.
 * Does not belong here: duplicated base config sections or UI branching.
 */
export const warModeOverride: Partial<ResolvedGameModeConfig> = {
  mode: "war",
  tickRateMs: WAR_MODE_TICK_RATE_MS,
  balance: {
    incomeMultiplier: 0.85,
    productionMultiplier: 0.85,
    cooldownMultiplier: 1.15,
    maxPlayersPerServer: 150,
    maxAllianceSize: 4,
    allianceLifecycle: {
      readiness: {
        readyIntervalSeconds: 8 * 60 * 60,
        readyButtonAvailableBeforeDueSeconds: 0,
        gracePeriodSeconds: 0,
        voteDurationSeconds: 2 * 60 * 60,
        voteRetryCooldownSeconds: 2 * 60 * 60
      },
      voluntaryLeavePenalty: {
        allianceJoinLockoutSeconds: 24 * 60 * 60,
        allianceCreateLockoutSeconds: 24 * 60 * 60,
        influenceDebuffSeconds: 18 * 60 * 60,
        actionCooldownDebuffSeconds: 12 * 60 * 60,
        formerAllyTruceSeconds: 120 * 60,
        influenceGenerationMultiplier: 0.8,
        actionCooldownMultiplier: 1.15,
        blocksAllianceDefenseSupport: true
      },
      inactiveKickPenalty: {
        allianceJoinLockoutSeconds: 12 * 60 * 60,
        allianceCreateLockoutSeconds: 12 * 60 * 60,
        influenceDebuffSeconds: 0,
        actionCooldownDebuffSeconds: 0,
        statDebuffSeconds: 8 * 60 * 60,
        formerAllyTruceSeconds: 120 * 60,
        influenceGenerationMultiplier: 1,
        actionCooldownMultiplier: 1,
        attackMultiplier: 0.5,
        defenseMultiplier: 0.5,
        productionMultiplier: 0.5,
        incomeMultiplier: 0.5,
        blocksAllianceDefenseSupport: true
      },
      disbandPenalty: {
        allianceJoinLockoutSeconds: 60 * 60,
        allianceCreateLockoutSeconds: 60 * 60,
        influenceDebuffSeconds: 0,
        actionCooldownDebuffSeconds: 0,
        formerAllyTruceSeconds: 120 * 60,
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
    buildSlotLimit: 8,
    eventFrequencyMultiplier: 0.9,
    policePressureMultiplier: 1.1,
    raidIntensityMultiplier: 1.15,
    expansionSpeedMultiplier: 0.85,
    dayLengthTicks: WAR_MODE_DAY_NIGHT_PHASE_TICKS,
    nightLengthTicks: WAR_MODE_DAY_NIGHT_PHASE_TICKS,
    dayNight: createDayNightConfig({
      dayDurationTicks: WAR_MODE_DAY_NIGHT_PHASE_TICKS,
      nightDurationTicks: WAR_MODE_DAY_NIGHT_PHASE_TICKS
    }),
    police: {
      ...basePoliceConfig,
      raidDurationTicks: WAR_MODE_RAID_DURATION_TICKS,
      pendingRaidTtlTicks: WAR_MODE_RAID_DURATION_TICKS,
      maxConcurrentRaidsByPhase: {
        day: 2,
        night: 1
      }
    },
    victoryConditionKey: "long-war-control",
    conflict: {
      spyCooldownTicks: 4,
      attackCooldownTicks: 48,
      robCooldownTicks: 40,
      heistCooldownTicks: 32,
      occupyCooldownTicks: 2,
      occupyFailureChancePct: 5,
      minAttackDurationTicks: 48,
      attackHeatGain: 14,
      occupyHeatGain: 2,
      occupyInfluenceCost: 5,
      occupyPopulationRefundPct: 10,
      spyBaseSuccessChance: 0.66,
      spyTrapRevealChance: 0.28,
      trapAttackLosses: 2,
      reportsLimit: 10,
      catastropheChance: 0.1
    },
    startingResources: {
      cash: 1000,
      "dirty-cash": 250,
      chemicals: 8,
      biomass: 5,
      "metal-parts": 8,
      "tech-core": 1
    }
  },
  technical: {
    sessionTtlMs: 1000 * 60 * 60 * 24 * 10,
    gameDurationMs: 1000 * 60 * 60 * 24 * 10,
    storageKeyPrefix: "empire:war",
    snapshotIntervalTicks: 12,
    notificationBatchWindowMs: 400,
    debug: {
      allowDebugTools: false,
      enableDeterministicSeeds: false
    }
  },
  publicMeta: {
    mode: "war",
    label: "Empire Streets War",
    matchStyle: "long",
    tickRateMs: WAR_MODE_TICK_RATE_MS,
    sessionKeyPrefix: "empire:war"
  }
};
