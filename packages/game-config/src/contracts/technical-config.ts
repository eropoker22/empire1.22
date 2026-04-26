/**
 * Responsibility: Technical runtime knobs for session partitioning and instance operation.
 * Belongs here: TTLs, namespaces, snapshot cadence, and debug-safe flags.
 * Does not belong here: gameplay rules or client-side mutation logic.
 */
export interface TechnicalConfig {
  sessionTtlMs: number;
  gameDurationMs: number;
  storageKeyPrefix: string;
  snapshotIntervalTicks: number;
  notificationBatchWindowMs: number;
  debug: {
    allowDebugTools: boolean;
    enableDeterministicSeeds: boolean;
  };
}

