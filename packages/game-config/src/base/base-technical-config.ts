import type { TechnicalConfig } from "../contracts/technical-config";

/**
 * Responsibility: Shared technical defaults for runtime and persistence behavior.
 * Belongs here: session namespaces, snapshot cadence, and debug-safe defaults.
 * Does not belong here: mode-specific tuning or live instance mutation.
 */
export const baseTechnicalConfig: TechnicalConfig = {
  sessionTtlMs: 1000 * 60 * 60 * 12,
  gameDurationMs: 1000 * 60 * 60 * 24,
  storageKeyPrefix: "empire:base",
  snapshotIntervalTicks: 10,
  notificationBatchWindowMs: 250,
  debug: {
    allowDebugTools: false,
    enableDeterministicSeeds: false
  }
};

