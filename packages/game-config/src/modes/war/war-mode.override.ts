import type { ResolvedGameModeConfig } from "../../contracts/game-mode-config";

/**
 * Responsibility: War mode override focused on longer pacing and larger coordination windows.
 * Belongs here: only values that differ from the shared base config.
 * Does not belong here: duplicated base config sections or UI branching.
 */
export const warModeOverride: Partial<ResolvedGameModeConfig> = {
  mode: "war",
  tickRateMs: 15000,
  balance: {
    incomeMultiplier: 1,
    productionMultiplier: 1,
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
    victoryConditionKey: "long-war-control",
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
    sessionTtlMs: 1000 * 60 * 60 * 24,
    gameDurationMs: 1000 * 60 * 60 * 24 * 7,
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
    tickRateMs: 15000,
    sessionKeyPrefix: "empire:war"
  }
};
