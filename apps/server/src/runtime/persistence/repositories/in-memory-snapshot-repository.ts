import type { ServerInstanceId } from "@empire/shared-types";
import {
  SNAPSHOT_CHECKPOINT_KINDS,
  type InstanceSnapshotDto,
  type SnapshotCheckpointRecord
} from "../dto";
import type { SnapshotRetentionPolicy } from "../services/retention-policy";
import { assertSnapshotIntegrity } from "../services/snapshot-integrity-validator";
import { isTerminalSnapshot } from "../services/snapshot-retention-classification";
import {
  createSnapshotPersistenceMetrics,
  emptySnapshotCheckpointCounts,
  type SnapshotCheckpointCounts,
  type SnapshotRepository
} from "./snapshot-repository";
import { classifySnapshotWrite } from "./snapshot-write-guard";

/**
 * Responsibility: Development/test snapshot repository kept in process memory.
 * Belongs here: latest snapshot save/load by instance id.
 * Does not belong here: filesystem or database IO.
 */
export const createInMemorySnapshotRepository = (): SnapshotRepository => {
  const recoveryHeads = new Map<ServerInstanceId, InstanceSnapshotDto>();
  const checkpointsByInstanceId = new Map<ServerInstanceId, Map<string, SnapshotCheckpointRecord>>();
  const metrics = createSnapshotPersistenceMetrics();

  const saveRecoveryHead = async (snapshot: InstanceSnapshotDto) => {
    const startedAt = performance.now();
    try {
      assertSnapshotIntegrity(snapshot, snapshot.instanceId);
      const latest = recoveryHeads.get(snapshot.instanceId) ?? null;
      const decision = classifySnapshotWrite(latest, snapshot);
      if (decision === "idempotent") return decision;
      recoveryHeads.set(snapshot.instanceId, structuredClone(snapshot));
      metrics.recoveryHeadUpdates += 1;
      recordSerializationMetrics(metrics, snapshot, startedAt);
      return latest ? "updated" as const : "created" as const;
    } catch (error) {
      metrics.recoveryHeadUpdateFailures += 1;
      if (String((error as Error)?.message ?? "").includes("stale rootVersion")) {
        metrics.rootVersionDowngradeAttempts += 1;
      }
      throw error;
    }
  };

  const saveCheckpoint = async (checkpoint: SnapshotCheckpointRecord) => {
    try {
      assertSnapshotIntegrity(checkpoint.snapshot, checkpoint.instanceId);
      const checkpoints = checkpointsByInstanceId.get(checkpoint.instanceId) ?? new Map();
      checkpointsByInstanceId.set(checkpoint.instanceId, checkpoints);
      const existing = checkpoints.get(checkpoint.checkpointId);
      if (existing) {
        if (JSON.stringify(existing) === JSON.stringify(checkpoint)) return "idempotent" as const;
        throw new Error(`Checkpoint ${checkpoint.checkpointId} already exists with a different payload.`);
      }
      checkpoints.set(checkpoint.checkpointId, structuredClone(checkpoint));
      recordCheckpointMetric(metrics, checkpoint);
      return "created" as const;
    } catch (error) {
      metrics.checkpointSaveFailures += 1;
      throw error;
    }
  };

  const loadRecoveryHead = async (instanceId: ServerInstanceId) => {
    const snapshot = recoveryHeads.get(instanceId);
    return snapshot ? structuredClone(snapshot) : null;
  };

  const loadLatestCheckpoint = async (instanceId: ServerInstanceId) => {
    const checkpoint = [...(checkpointsByInstanceId.get(instanceId)?.values() ?? [])]
      .sort(compareNewestCheckpoint)[0];
    return checkpoint ? structuredClone(checkpoint) : null;
  };

  return {
    saveRecoveryHead,
    saveCheckpoint,
    loadRecoveryHead,
    loadLatestCheckpoint,
    loadForRecovery: async (instanceId) => {
      const head = await loadRecoveryHead(instanceId);
      if (head) {
        try {
          assertSnapshotIntegrity(head, instanceId);
        } catch (error) {
          metrics.recoveryIntegrityFailures += 1;
          throw error;
        }
        metrics.recoveryFromHead += 1;
        return { snapshot: head, source: "recovery-head", reasonCode: "RECOVERY_HEAD_VALID" };
      }
      const checkpoint = await loadLatestCheckpoint(instanceId);
      if (!checkpoint) {
        return { snapshot: null, source: "none", reasonCode: "RECOVERY_SNAPSHOT_MISSING" };
      }
      assertSnapshotIntegrity(checkpoint.snapshot, instanceId);
      await saveRecoveryHead(checkpoint.snapshot);
      metrics.recoveryFromCheckpointFallback += 1;
      return {
        snapshot: checkpoint.snapshot,
        source: "checkpoint-fallback",
        reasonCode: "RECOVERY_HEAD_MISSING_CHECKPOINT_USED"
      };
    },
    cleanupCheckpoints: async (policy, nowIso) => cleanupInMemoryCheckpoints(
      checkpointsByInstanceId,
      policy,
      nowIso,
      metrics
    ),
    countCheckpoints: async (instanceId) =>
      countCheckpoints(checkpointsByInstanceId.get(instanceId)?.values() ?? []),
    getMetrics: () => ({ ...metrics }),
    save: async (snapshot) => { await saveRecoveryHead(snapshot); },
    loadLatest: loadRecoveryHead
  };
};

const cleanupInMemoryCheckpoints = async (
  checkpointsByInstanceId: Map<ServerInstanceId, Map<string, SnapshotCheckpointRecord>>,
  policy: SnapshotRetentionPolicy,
  nowIso: string,
  metrics: ReturnType<typeof createSnapshotPersistenceMetrics>
) => {
  const startedAt = performance.now();
  let deletedRows = 0;
  try {
    for (const checkpoints of checkpointsByInstanceId.values()) {
      const values = [...checkpoints.values()];
      const terminal = values.some((checkpoint) => isTerminalSnapshot(checkpoint.snapshot));
      const rollingLimit = terminal
        ? policy.rollingCheckpointCountTerminal
        : policy.rollingCheckpointCountActive;
      const rolling = values.filter(isRollingCheckpoint).sort(compareNewestCheckpoint);
      const expiredBefore = Date.parse(nowIso) - policy.terminalRetentionDays * 24 * 60 * 60 * 1000;
      const candidates = values.filter((checkpoint) => {
        if (checkpoint.protected || checkpoint.kind === SNAPSHOT_CHECKPOINT_KINDS.terminal) return false;
        if (checkpoint.kind === SNAPSHOT_CHECKPOINT_KINDS.lifecycle) {
          return !policy.retainLifecycleCheckpoints && terminal && Date.parse(checkpoint.createdAt) < expiredBefore;
        }
        const rank = rolling.findIndex((entry) => entry.checkpointId === checkpoint.checkpointId);
        return rank >= rollingLimit || (terminal && Date.parse(checkpoint.createdAt) < expiredBefore);
      }).sort((left, right) => left.createdAt.localeCompare(right.createdAt));
      for (const checkpoint of candidates.slice(0, Math.max(1, policy.cleanupBatchSize - deletedRows))) {
        checkpoints.delete(checkpoint.checkpointId);
        deletedRows += 1;
        if (deletedRows >= policy.cleanupBatchSize) break;
      }
      if (deletedRows >= policy.cleanupBatchSize) break;
    }
    metrics.cleanupRuns += 1;
    metrics.cleanupDeletedRows += deletedRows;
    metrics.lastCleanupDurationMs = Math.max(0, performance.now() - startedAt);
    metrics.lastCleanupAt = nowIso;
    return {
      acquired: true,
      deletedRows,
      durationMs: metrics.lastCleanupDurationMs,
      completedAt: nowIso
    };
  } catch (error) {
    metrics.cleanupFailures += 1;
    throw error;
  }
};

const countCheckpoints = (
  checkpoints: Iterable<SnapshotCheckpointRecord>
): SnapshotCheckpointCounts => {
  const counts = emptySnapshotCheckpointCounts();
  for (const checkpoint of checkpoints) {
    counts.total += 1;
    if (isRollingCheckpoint(checkpoint)) counts.rolling += 1;
    if (checkpoint.kind === SNAPSHOT_CHECKPOINT_KINDS.lifecycle) counts.lifecycle += 1;
    if (checkpoint.kind === SNAPSHOT_CHECKPOINT_KINDS.terminal) counts.terminal += 1;
  }
  return counts;
};

const isRollingCheckpoint = (checkpoint: SnapshotCheckpointRecord): boolean =>
  checkpoint.kind === SNAPSHOT_CHECKPOINT_KINDS.periodic ||
  checkpoint.kind === SNAPSHOT_CHECKPOINT_KINDS.legacy;

const compareNewestCheckpoint = (
  left: SnapshotCheckpointRecord,
  right: SnapshotCheckpointRecord
): number => right.rootVersion - left.rootVersion ||
  right.tick - left.tick ||
  right.createdAt.localeCompare(left.createdAt) ||
  right.checkpointId.localeCompare(left.checkpointId);

const recordCheckpointMetric = (
  metrics: ReturnType<typeof createSnapshotPersistenceMetrics>,
  checkpoint: SnapshotCheckpointRecord
): void => {
  if (checkpoint.kind === SNAPSHOT_CHECKPOINT_KINDS.periodic) metrics.periodicCheckpointsCreated += 1;
  if (checkpoint.kind === SNAPSHOT_CHECKPOINT_KINDS.lifecycle) metrics.lifecycleCheckpointsCreated += 1;
  if (checkpoint.kind === SNAPSHOT_CHECKPOINT_KINDS.terminal) metrics.terminalCheckpointsCreated += 1;
};

const recordSerializationMetrics = (
  metrics: ReturnType<typeof createSnapshotPersistenceMetrics>,
  snapshot: InstanceSnapshotDto,
  startedAt: number
): void => {
  const serialized = JSON.stringify(snapshot);
  metrics.lastSnapshotSerializationDurationMs = Math.max(0, performance.now() - startedAt);
  metrics.lastSerializedSnapshotSizeBytes = new TextEncoder().encode(serialized).byteLength;
};
