import type { ResolvedGameModeConfig } from "../../contracts/game-mode-config";
import { basePoliceConfig } from "../../base/base-police-config";
import { createDayNightConfig } from "../../public/day-night-config";

const WAR_MODE_TICK_RATE_MS = 15000;
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
    maxAllianceSize: 12,
    buildSlotLimit: 8,
    eventFrequencyMultiplier: 0.9,
    policePressureMultiplier: 1.1,
    raidIntensityMultiplier: 1.15,
    expansionSpeedMultiplier: 0.85,
    dayLengthTicks: 16,
    nightLengthTicks: 16,
    dayNight: createDayNightConfig({
      dayDurationTicks: 960,
      nightDurationTicks: 960
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
      occupyCooldownTicks: 2,
      minAttackDurationTicks: 48,
      attackHeatGain: 14,
      occupyHeatGain: 2,
      occupyInfluenceCost: 5,
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
