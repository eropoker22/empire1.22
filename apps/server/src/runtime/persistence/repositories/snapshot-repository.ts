import type { ServerInstanceId } from "@empire/shared-types";
import type {
  InstanceSnapshotDto,
  SnapshotCheckpointRecord
} from "../dto";
import type { SnapshotRetentionPolicy } from "../services/retention-policy";

export type SnapshotWriteResult = "created" | "updated" | "idempotent";

export interface SnapshotRecoveryResult {
  snapshot: InstanceSnapshotDto | null;
  source: "recovery-head" | "checkpoint-fallback" | "none";
  reasonCode: "RECOVERY_HEAD_VALID" | "RECOVERY_HEAD_MISSING_CHECKPOINT_USED" | "RECOVERY_SNAPSHOT_MISSING";
}

export interface SnapshotCleanupResult {
  acquired: boolean;
  deletedRows: number;
  durationMs: number;
  completedAt: string;
}

export interface SnapshotCheckpointCounts {
  total: number;
  rolling: number;
  lifecycle: number;
  terminal: number;
}

export interface SnapshotPersistenceMetrics {
  recoveryHeadUpdates: number;
  recoveryHeadUpdateFailures: number;
  periodicCheckpointsCreated: number;
  lifecycleCheckpointsCreated: number;
  terminalCheckpointsCreated: number;
  checkpointSaveFailures: number;
  cleanupRuns: number;
  cleanupDeletedRows: number;
  cleanupFailures: number;
  lastCleanupDurationMs: number;
  lastCleanupAt: string | null;
  recoveryFromHead: number;
  recoveryFromCheckpointFallback: number;
  recoveryIntegrityFailures: number;
  rootVersionDowngradeAttempts: number;
  lastSerializedSnapshotSizeBytes: number;
  lastSnapshotSerializationDurationMs: number;
  lastDatabaseSaveDurationMs: number;
}

/**
 * Responsibility: Storage boundary for versioned instance snapshots.
 * Belongs here: load/save contract for full instance snapshots.
 * Does not belong here: snapshot creation logic or runtime scheduling.
 */
export interface SnapshotRepository {
  saveRecoveryHead(snapshot: InstanceSnapshotDto): Promise<SnapshotWriteResult>;
  saveCheckpoint(checkpoint: SnapshotCheckpointRecord): Promise<SnapshotWriteResult>;
  loadRecoveryHead(instanceId: ServerInstanceId): Promise<InstanceSnapshotDto | null>;
  loadLatestCheckpoint(instanceId: ServerInstanceId): Promise<SnapshotCheckpointRecord | null>;
  loadForRecovery(instanceId: ServerInstanceId): Promise<SnapshotRecoveryResult>;
  cleanupCheckpoints(policy: SnapshotRetentionPolicy, nowIso: string): Promise<SnapshotCleanupResult>;
  countCheckpoints(instanceId: ServerInstanceId): Promise<SnapshotCheckpointCounts>;
  getMetrics(): Readonly<SnapshotPersistenceMetrics>;
  /** @deprecated Use saveRecoveryHead or saveCheckpoint to make write intent explicit. */
  save(snapshot: InstanceSnapshotDto): Promise<void>;
  /** @deprecated Use loadRecoveryHead or loadForRecovery to make recovery intent explicit. */
  loadLatest(instanceId: ServerInstanceId): Promise<InstanceSnapshotDto | null>;
}

export const createSnapshotPersistenceMetrics = (): SnapshotPersistenceMetrics => ({
  recoveryHeadUpdates: 0,
  recoveryHeadUpdateFailures: 0,
  periodicCheckpointsCreated: 0,
  lifecycleCheckpointsCreated: 0,
  terminalCheckpointsCreated: 0,
  checkpointSaveFailures: 0,
  cleanupRuns: 0,
  cleanupDeletedRows: 0,
  cleanupFailures: 0,
  lastCleanupDurationMs: 0,
  lastCleanupAt: null,
  recoveryFromHead: 0,
  recoveryFromCheckpointFallback: 0,
  recoveryIntegrityFailures: 0,
  rootVersionDowngradeAttempts: 0,
  lastSerializedSnapshotSizeBytes: 0,
  lastSnapshotSerializationDurationMs: 0,
  lastDatabaseSaveDurationMs: 0
});

export const emptySnapshotCheckpointCounts = (): SnapshotCheckpointCounts => ({
  total: 0,
  rolling: 0,
  lifecycle: 0,
  terminal: 0
});

export const createNullSnapshotRepository = (): SnapshotRepository => {
  const metrics = createSnapshotPersistenceMetrics();
  return {
    saveRecoveryHead: async (_snapshot) => "idempotent",
    saveCheckpoint: async (_checkpoint) => "idempotent",
    loadRecoveryHead: async (_instanceId) => null,
    loadLatestCheckpoint: async (_instanceId) => null,
    loadForRecovery: async (_instanceId) => ({
      snapshot: null,
      source: "none",
      reasonCode: "RECOVERY_SNAPSHOT_MISSING"
    }),
    cleanupCheckpoints: async (_policy, nowIso) => ({
      acquired: true,
      deletedRows: 0,
      durationMs: 0,
      completedAt: nowIso
    }),
    countCheckpoints: async (_instanceId) => emptySnapshotCheckpointCounts(),
    getMetrics: () => metrics,
    save: async (_snapshot) => undefined,
    loadLatest: async (_instanceId) => null
  };
};
