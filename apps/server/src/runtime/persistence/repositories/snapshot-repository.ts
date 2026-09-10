import type { ServerInstanceId } from "@empire/shared-types";
import type {
  InstanceSnapshotDto,
  SnapshotCheckpointRecord
} from "../dto";
import type { SnapshotRetentionPolicy } from "../services/retention-policy";
import {
  readSnapshotInstanceIoMetrics,
  type SnapshotInstanceIoMetrics
} from "./snapshot-io-diagnostics";

export {
  readSnapshotInstanceIoMetrics,
  recordCheckpointWrite,
  recordFullSnapshotRead,
  recordFullSnapshotWrite,
  recordMetadataOnlyRead,
  serializedJsonBytes,
  snapshotFieldBytes,
  type SnapshotInstanceIoMetrics
} from "./snapshot-io-diagnostics";

export type SnapshotWriteResult = "created" | "updated" | "idempotent";

export interface SnapshotRecoveryMetadata {
  snapshotId: string;
  rootVersion: number;
  tick: number;
  createdAt: string;
  updatedAt: string;
}

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
  fullSnapshotReads: number;
  fullSnapshotReadBytes: number;
  fullSnapshotWrites: number;
  fullSnapshotWriteBytes: number;
  metadataOnlyReads: number;
  metadataOnlyReadBytesEstimate: number;
  recoveryHeadLoads: number;
  recoveryHeadSaves: number;
  checkpointWrites: number;
  tickTransactions: number;
  totalTickDbRoundTrips: number;
  averageTickDbRoundTrips: number;
  maxTickDbRoundTrips: number;
  totalDatabaseTimePerTickMs: number;
  databaseTimePerTickMs: number;
  commandTransactions: number;
  totalCommandDbRoundTrips: number;
  queriesPerCommandSubmit: number;
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
  lastSnapshotFieldBytes: Record<string, number>;
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
  loadRecoveryMetadata(
    instanceId: ServerInstanceId,
    options?: { forUpdate?: boolean }
  ): Promise<SnapshotRecoveryMetadata | null>;
  loadLatestCheckpoint(instanceId: ServerInstanceId): Promise<SnapshotCheckpointRecord | null>;
  loadForRecovery(instanceId: ServerInstanceId): Promise<SnapshotRecoveryResult>;
  cleanupCheckpoints(policy: SnapshotRetentionPolicy, nowIso: string): Promise<SnapshotCleanupResult>;
  countCheckpoints(instanceId: ServerInstanceId): Promise<SnapshotCheckpointCounts>;
  getMetrics(): Readonly<SnapshotPersistenceMetrics>;
  getInstanceIoMetrics(instanceId: ServerInstanceId): Readonly<SnapshotInstanceIoMetrics>;
  /** @deprecated Use saveRecoveryHead or saveCheckpoint to make write intent explicit. */
  save(snapshot: InstanceSnapshotDto): Promise<void>;
  /** @deprecated Use loadRecoveryHead or loadForRecovery to make recovery intent explicit. */
  loadLatest(instanceId: ServerInstanceId): Promise<InstanceSnapshotDto | null>;
}

export const createSnapshotPersistenceMetrics = (): SnapshotPersistenceMetrics => ({
  fullSnapshotReads: 0,
  fullSnapshotReadBytes: 0,
  fullSnapshotWrites: 0,
  fullSnapshotWriteBytes: 0,
  metadataOnlyReads: 0,
  metadataOnlyReadBytesEstimate: 0,
  recoveryHeadLoads: 0,
  recoveryHeadSaves: 0,
  checkpointWrites: 0,
  tickTransactions: 0,
  totalTickDbRoundTrips: 0,
  averageTickDbRoundTrips: 0,
  maxTickDbRoundTrips: 0,
  totalDatabaseTimePerTickMs: 0,
  databaseTimePerTickMs: 0,
  commandTransactions: 0,
  totalCommandDbRoundTrips: 0,
  queriesPerCommandSubmit: 0,
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
  lastDatabaseSaveDurationMs: 0,
  lastSnapshotFieldBytes: {}
});

export const createSnapshotRecoveryMetadata = (
  snapshot: InstanceSnapshotDto,
  updatedAt = snapshot.createdAt
): SnapshotRecoveryMetadata => ({
  snapshotId: snapshot.snapshotId,
  rootVersion: snapshot.integrity.rootVersion,
  tick: snapshot.tick,
  createdAt: snapshot.createdAt,
  updatedAt
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
    loadRecoveryMetadata: async (_instanceId, _options) => null,
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
    getInstanceIoMetrics: (instanceId) => readSnapshotInstanceIoMetrics(metrics, instanceId),
    save: async (_snapshot) => undefined,
    loadLatest: async (_instanceId) => null
  };
};
