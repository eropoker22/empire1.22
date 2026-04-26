import type { ResolvedGameModeConfig } from "../../contracts/game-mode-config";

/**
 * Responsibility: Free mode override focused on faster pacing and lower commitment.
 * Belongs here: only values that differ from the shared base config.
 * Does not belong here: duplicated full config copies or core gameplay logic.
 */
export const freeModeOverride: Partial<ResolvedGameModeConfig> = {
  mode: "free",
  tickRateMs: 5000,
  balance: {
    incomeMultiplier: 1.2,
    productionMultiplier: 1.2,
    cooldownMultiplier: 0.8,
    maxPlayersPerServer: 80,
    maxAllianceSize: 6,
    buildSlotLimit: 8,
    eventFrequencyMultiplier: 1.2,
    policePressureMultiplier: 0.9,
    raidIntensityMultiplier: 0.9,
    expansionSpeedMultiplier: 1.3,
    dayLengthTicks: 8,
    nightLengthTicks: 8,
    victoryConditionKey: "fast-control",
    startingResources: {
      cash: 1500,
      "dirty-cash": 300,
      chemicals: 10,
      biomass: 6,
      "metal-parts": 8,
      "tech-core": 2
    }
  },
  technical: {
    sessionTtlMs: 1000 * 60 * 60 * 6,
    gameDurationMs: 1000 * 60 * 60 * 12,
    storageKeyPrefix: "empire:free",
    snapshotIntervalTicks: 8,
    notificationBatchWindowMs: 200,
    debug: {
      allowDebugTools: false,
      enableDeterministicSeeds: false
    }
  },
  publicMeta: {
    mode: "free",
    label: "Empire Streets Free",
    matchStyle: "short",
    tickRateMs: 5000,
    sessionKeyPrefix: "empire:free"
  }
};
