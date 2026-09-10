import type { ServerInstanceId } from "@empire/shared-types";
import type { InstanceSnapshotDto, SnapshotCheckpointRecord } from "../dto";
import {
  assertSnapshotCheckpointIntegrity,
  assertSnapshotIntegrity
} from "../services/snapshot-integrity-validator";
import {
  createSnapshotPersistenceMetrics,
  readSnapshotInstanceIoMetrics,
  recordCheckpointWrite,
  recordMetadataOnlyRead,
  type SnapshotRepository,
  type SnapshotWriteResult
} from "../repositories";
import type { PostgresDatabase, PostgresQueryable } from "./postgres-client";
import {
  createPostgresRecoveryHeadWriter,
  loadTrackedRecoveryHead
} from "./postgres-recovery-head-writer";
import { loadRecoveryMetadataFrom } from "./postgres-snapshot-metadata";
import { cleanupPostgresCheckpoints } from "./postgres-snapshot-maintenance";
import {
  assertRejectedCheckpointIsIdempotent,
  createCheckpointHistoryId,
  ensureSnapshotInstanceRow,
  loadCheckpointCandidates,
  loadLatestValidCheckpoint,
  recordCheckpointMetric,
  type PostgresSnapshotRepositoryOptions,
  withOptionalTransaction
} from "./postgres-snapshot-storage";

export const createPostgresSnapshotRepository = (
  database: PostgresDatabase,
  metrics = createSnapshotPersistenceMetrics()
): SnapshotRepository => createPostgresSnapshotRepositoryForQueryable(database, {
  wrapWritesInTransaction: true,
  metrics
});

export const createPostgresSnapshotRepositoryForTransaction = (
  client: PostgresQueryable,
  metrics = createSnapshotPersistenceMetrics()
): SnapshotRepository => createPostgresSnapshotRepositoryForQueryable(client, {
  wrapWritesInTransaction: false,
  metrics
});

const createPostgresSnapshotRepositoryForQueryable = (
  database: PostgresQueryable,
  options: PostgresSnapshotRepositoryOptions
): SnapshotRepository => {
  const metrics = options.metrics ?? createSnapshotPersistenceMetrics();

  const saveRecoveryHead = createPostgresRecoveryHeadWriter(database, options, metrics);

  const saveCheckpoint = async (checkpoint: SnapshotCheckpointRecord): Promise<SnapshotWriteResult> => {
    try {
      assertSnapshotCheckpointIntegrity(checkpoint);
      const serialized = JSON.stringify(checkpoint.snapshot);
      const databaseStartedAt = performance.now();
      const result = await withOptionalTransaction(database, options, async (client) => {
        await ensureSnapshotInstanceRow(client, checkpoint.snapshot);
        const inserted = await client.query(
          `
            INSERT INTO empire_snapshots (
              id, server_instance_id, schema_version, snapshot_id, root_version,
              tick, checkpoint_kind, reason_code, lifecycle_phase, is_protected,
              payload, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::timestamptz, now())
            ON CONFLICT (server_instance_id, snapshot_id) DO NOTHING
            RETURNING snapshot_id
          `,
          [
            createCheckpointHistoryId(checkpoint),
            checkpoint.instanceId,
            checkpoint.snapshot.version.schemaVersion,
            checkpoint.checkpointId,
            checkpoint.rootVersion,
            checkpoint.tick,
            checkpoint.kind,
            checkpoint.reasonCode,
            checkpoint.lifecyclePhase,
            checkpoint.protected,
            serialized,
            checkpoint.createdAt
          ]
        );
        if ((inserted.rowCount ?? inserted.rows.length) === 1) return "created";
        await assertRejectedCheckpointIsIdempotent(client, checkpoint);
        return "idempotent";
      });
      metrics.lastDatabaseSaveDurationMs = Math.max(0, performance.now() - databaseStartedAt);
      if (result === "created") {
        recordCheckpointMetric(metrics, checkpoint.kind);
        recordCheckpointWrite(metrics, checkpoint.instanceId);
      }
      return result;
    } catch (error) {
      metrics.checkpointSaveFailures += 1;
      throw error;
    }
  };

  const loadRecoveryHead = (instanceId: ServerInstanceId) =>
    loadTrackedRecoveryHead(database, instanceId, false, metrics);

  const loadRecoveryMetadata = async (
    instanceId: ServerInstanceId,
    metadataOptions: { forUpdate?: boolean } = {}
  ) => {
    const metadata = await loadRecoveryMetadataFrom(database, instanceId, metadataOptions.forUpdate === true);
    recordMetadataOnlyRead(metrics, instanceId, metadata ? 160 : 8);
    return metadata;
  };

  const loadLatestCheckpoint = async (instanceId: ServerInstanceId) =>
    (await loadCheckpointCandidates(database, instanceId, 1))[0] ?? null;

  return {
    saveRecoveryHead,
    saveCheckpoint,
    loadRecoveryHead,
    loadRecoveryMetadata,
    loadLatestCheckpoint,
    loadForRecovery: async (instanceId) => {
      const head = await loadRecoveryHead(instanceId);
      if (head) {
        try {
          assertSnapshotIntegrity(head, instanceId);
        } catch (error) {
          metrics.recoveryIntegrityFailures += 1;
          console.warn("[snapshot-recovery] source=recovery-head status=invalid");
          throw error;
        }
        metrics.recoveryFromHead += 1;
        return { snapshot: head, source: "recovery-head", reasonCode: "RECOVERY_HEAD_VALID" };
      }
      const checkpoint = await loadLatestValidCheckpoint(database, instanceId, metrics);
      if (!checkpoint) {
        return { snapshot: null, source: "none", reasonCode: "RECOVERY_SNAPSHOT_MISSING" };
      }
      await saveRecoveryHead(checkpoint.snapshot);
      metrics.recoveryFromCheckpointFallback += 1;
      console.warn("[snapshot-recovery] source=checkpoint-fallback reason=RECOVERY_HEAD_MISSING_CHECKPOINT_USED");
      return {
        snapshot: checkpoint.snapshot,
        source: "checkpoint-fallback",
        reasonCode: "RECOVERY_HEAD_MISSING_CHECKPOINT_USED"
      };
    },
    cleanupCheckpoints: (policy, nowIso) =>
      cleanupPostgresCheckpoints(database, options, policy, nowIso, metrics),
    countCheckpoints: async (instanceId) => {
      const result = await database.query<{
        total: string | number;
        rolling: string | number;
        lifecycle: string | number;
        terminal: string | number;
      }>(
        `
          SELECT
            count(*) AS total,
            count(*) FILTER (WHERE checkpoint_kind IN ('periodic-checkpoint', 'legacy-checkpoint')) AS rolling,
            count(*) FILTER (WHERE checkpoint_kind = 'lifecycle-checkpoint') AS lifecycle,
            count(*) FILTER (WHERE checkpoint_kind = 'terminal-checkpoint') AS terminal
          FROM empire_snapshots
          WHERE server_instance_id = $1
        `,
        [instanceId]
      );
      const row = result.rows[0];
      return {
        total: Number(row?.total ?? 0),
        rolling: Number(row?.rolling ?? 0),
        lifecycle: Number(row?.lifecycle ?? 0),
        terminal: Number(row?.terminal ?? 0)
      };
    },
    getMetrics: () => ({ ...metrics }),
    getInstanceIoMetrics: (instanceId) => readSnapshotInstanceIoMetrics(metrics, instanceId),
    save: async (snapshot) => { await saveRecoveryHead(snapshot); },
    loadLatest: loadRecoveryHead
  };
};
