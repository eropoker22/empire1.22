import type { TechnicalConfig } from "../contracts/technical-config";
import { resolveSnapshotCheckpointIntervalTicks } from "./snapshot-checkpoint-cadence";

/**
 * Responsibility: Shared technical defaults for runtime and persistence behavior.
 * Belongs here: session namespaces, snapshot cadence, and debug-safe defaults.
 * Does not belong here: mode-specific tuning or live instance mutation.
 */
export const baseTechnicalConfig: TechnicalConfig = {
  sessionTtlMs: 1000 * 60 * 60 * 12,
  gameDurationMs: 1000 * 60 * 60 * 24,
  storageKeyPrefix: "empire:base",
  snapshotIntervalTicks: resolveSnapshotCheckpointIntervalTicks(5_000),
  notificationBatchWindowMs: 250,
  debug: {
    allowDebugTools: false,
    enableDeterministicSeeds: false
  }
};
