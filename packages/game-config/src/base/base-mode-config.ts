import type { ResolvedGameModeConfig } from "../contracts/game-mode-config";

/**
 * Responsibility: Legacy compatibility export for the shared config baseline.
 * Belongs here: temporary bridge to the resolved base config for existing imports.
 * Does not belong here: new mode-specific overrides or runtime state.
 */
export const baseModeConfig: Omit<ResolvedGameModeConfig, "mode"> = {
  tickRateMs: 5000,
  balance: {
    incomeMultiplier: 1,
    productionMultiplier: 1,
    cooldownMultiplier: 1,
    maxPlayersPerServer: 100,
    maxAllianceSize: 10,
    buildSlotLimit: 6,
    eventFrequencyMultiplier: 1,
    policePressureMultiplier: 1,
    raidIntensityMultiplier: 1,
    expansionSpeedMultiplier: 1,
    dayLengthTicks: 12,
    nightLengthTicks: 12,
    victoryConditionKey: "default-control",
    districtControlVictoryThreshold: 1,
    startingResources: {
      cash: 1000
    }
  },
  technical: {
    sessionTtlMs: 1000 * 60 * 60 * 12,
    gameDurationMs: 1000 * 60 * 60 * 24,
    storageKeyPrefix: "empire:base",
    snapshotIntervalTicks: 10,
    notificationBatchWindowMs: 250,
    debug: {
      allowDebugTools: false,
      enableDeterministicSeeds: false
    }
  },
  publicMeta: {
    mode: "free",
    label: "Empire Streets",
    matchStyle: "short",
    tickRateMs: 5000,
    sessionKeyPrefix: "empire:base"
  }
};
