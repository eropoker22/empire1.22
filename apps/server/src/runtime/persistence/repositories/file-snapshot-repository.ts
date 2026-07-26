import type { ServerInstanceId } from "@empire/shared-types";
import {
  SNAPSHOT_CHECKPOINT_KINDS,
  type InstanceSnapshotDto,
  type SnapshotCheckpointRecord
} from "../dto";
import { assertSnapshotIntegrity } from "../services/snapshot-integrity-validator";
import {
  createSnapshotPersistenceMetrics,
  emptySnapshotCheckpointCounts,
  type SnapshotRepository
} from "./snapshot-repository";
import {
  createInstancePersistenceDir,
  encodePathSegment,
  readJsonFile,
  type FilePersistenceOptions,
  writeJsonFileAtomic
} from "./file-persistence-utils";
import { join } from "node:path";
import { readdir } from "node:fs/promises";
import { classifySnapshotWrite } from "./snapshot-write-guard";
import {
  cleanupFileCheckpoints,
  compareNewestCheckpoint,
  isRollingCheckpoint
} from "./file-snapshot-checkpoint-maintenance";

/**
 * Responsibility: Local durable snapshot storage using versioned, readable JSON.
 * Belongs here: latest snapshot load/save and an optimistic rootVersion guard.
 * Does not belong here: snapshot creation or runtime restore orchestration.
 */
export const createFileSnapshotRepository = (
  options: FilePersistenceOptions
): SnapshotRepository => {
  let saveQueue = Promise.resolve();
  const metrics = createSnapshotPersistenceMetrics();

  const enqueue = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = saveQueue.then(operation);
    saveQueue = result.then(() => undefined, () => undefined);
    return result;
  };

  const saveRecoveryHead = (snapshot: InstanceSnapshotDto) => enqueue(async () => {
    const startedAt = performance.now();
    try {
      assertSnapshotIntegrity(snapshot, snapshot.instanceId);
      const latest = await loadRecoveryHead(options.rootDir, snapshot.instanceId);
      const decision = classifySnapshotWrite(latest, snapshot);
      if (decision === "idempotent") return decision;
      await writeJsonFileAtomic(createLatestSnapshotPath(options.rootDir, snapshot.instanceId), snapshot);
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
  });

  const saveCheckpoint = (checkpoint: SnapshotCheckpointRecord) => enqueue(async () => {
    try {
      assertSnapshotIntegrity(checkpoint.snapshot, checkpoint.instanceId);
      const path = createCheckpointPath(options.rootDir, checkpoint);
      const existing = await readJsonFile<SnapshotCheckpointRecord>(path);
      if (existing) {
        if (JSON.stringify(existing) === JSON.stringify(checkpoint)) return "idempotent" as const;
        throw new Error(`Checkpoint ${checkpoint.checkpointId} already exists with a different payload.`);
      }
      await writeJsonFileAtomic(path, checkpoint);
      recordCheckpointMetric(metrics, checkpoint);
      return "created" as const;
    } catch (error) {
      metrics.checkpointSaveFailures += 1;
      throw error;
    }
  });

  const loadHead = (instanceId: ServerInstanceId) =>
    loadRecoveryHead(options.rootDir, instanceId);

  const loadCheckpoint = (instanceId: ServerInstanceId) =>
    loadLatestCheckpoint(options.rootDir, instanceId);

  return {
    saveRecoveryHead,
    saveCheckpoint,
    loadRecoveryHead: loadHead,
    loadLatestCheckpoint: loadCheckpoint,
    loadForRecovery: async (instanceId) => {
      const head = await loadHead(instanceId);
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
      const checkpoint = await loadCheckpoint(instanceId);
      if (!checkpoint) {
        return { snapshot: null, source: "none", reasonCode: "RECOVERY_SNAPSHOT_MISSING" };
      }
      assertSnapshotIntegrity(checkpoint.snapshot, instanceId);
      await saveRecoveryHead(checkpoint.snapshot);
      metrics.recoveryFromCheckpointFallback += 1;
      console.warn("[snapshot-recovery] source=checkpoint-fallback reason=RECOVERY_HEAD_MISSING_CHECKPOINT_USED");
      return {
        snapshot: checkpoint.snapshot,
        source: "checkpoint-fallback",
        reasonCode: "RECOVERY_HEAD_MISSING_CHECKPOINT_USED"
      };
    },
    cleanupCheckpoints: (policy, nowIso) => enqueue(() =>
      cleanupFileCheckpoints(options.rootDir, policy, nowIso, metrics)),
    countCheckpoints: async (instanceId) => {
      const checkpoints = await loadCheckpoints(options.rootDir, instanceId);
      const counts = emptySnapshotCheckpointCounts();
      for (const checkpoint of checkpoints) {
        counts.total += 1;
        if (isRollingCheckpoint(checkpoint)) counts.rolling += 1;
        if (checkpoint.kind === SNAPSHOT_CHECKPOINT_KINDS.lifecycle) counts.lifecycle += 1;
        if (checkpoint.kind === SNAPSHOT_CHECKPOINT_KINDS.terminal) counts.terminal += 1;
      }
      return counts;
    },
    getMetrics: () => ({ ...metrics }),
    save: async (snapshot) => { await saveRecoveryHead(snapshot); },
    loadLatest: loadHead
  };
};

const loadRecoveryHead = (
  rootDir: string,
  instanceId: ServerInstanceId
): Promise<InstanceSnapshotDto | null> =>
  readJsonFile<InstanceSnapshotDto>(createLatestSnapshotPath(rootDir, instanceId));

const loadLatestCheckpoint = async (
  rootDir: string,
  instanceId: ServerInstanceId
): Promise<SnapshotCheckpointRecord | null> =>
  (await loadCheckpoints(rootDir, instanceId)).sort(compareNewestCheckpoint)[0] ?? null;

const loadCheckpoints = async (
  rootDir: string,
  instanceId: ServerInstanceId
): Promise<SnapshotCheckpointRecord[]> => {
  const directory = createCheckpointDir(rootDir, instanceId);
  const filenames = await readdir(directory).catch((error: unknown) => {
    if ((error as { code?: string }).code === "ENOENT") return [];
    throw error;
  });
  const checkpoints = await Promise.all(filenames
    .filter((filename) => filename.endsWith(".json"))
    .map((filename) => readJsonFile<SnapshotCheckpointRecord>(join(directory, filename))));
  return checkpoints.filter((checkpoint): checkpoint is SnapshotCheckpointRecord => Boolean(checkpoint));
};

const createLatestSnapshotPath = (
  rootDir: string,
  instanceId: ServerInstanceId
): string => join(createSnapshotDir(rootDir, instanceId), "latest.json");

const createSnapshotDir = (rootDir: string, instanceId: ServerInstanceId): string =>
  join(createInstancePersistenceDir(rootDir, instanceId), "snapshots");

const createCheckpointDir = (rootDir: string, instanceId: ServerInstanceId): string =>
  join(createSnapshotDir(rootDir, instanceId), "checkpoints");

const createCheckpointPath = (
  rootDir: string,
  checkpoint: SnapshotCheckpointRecord
): string => {
  return join(
    createCheckpointDir(rootDir, checkpoint.instanceId),
    `${encodePathSegment(checkpoint.checkpointId)}.json`
  );
};

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
