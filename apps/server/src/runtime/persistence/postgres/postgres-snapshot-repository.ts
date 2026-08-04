import type { ServerInstanceId } from "@empire/shared-types";
import type { InstanceSnapshotDto, SnapshotCheckpointRecord } from "../dto";
import {
  assertSnapshotCheckpointIntegrity,
  assertSnapshotIntegrity
} from "../services/snapshot-integrity-validator";
import {
  createSnapshotPersistenceMetrics,
  type SnapshotRepository,
  type SnapshotWriteResult
} from "../repositories";
import { classifySnapshotWrite } from "../repositories/snapshot-write-guard";
import type { PostgresDatabase, PostgresQueryable } from "./postgres-client";
import { cleanupPostgresCheckpoints } from "./postgres-snapshot-maintenance";
import {
  assertRejectedCheckpointIsIdempotent,
  assertRejectedRecoveryHeadIsIdempotent,
  createCheckpointHistoryId,
  createRecoveryHeadId,
  ensureSnapshotInstanceRow,
  loadCheckpointCandidates,
  loadLatestValidCheckpoint,
  loadRecoveryHeadFrom,
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

  const saveRecoveryHead = async (snapshot: InstanceSnapshotDto): Promise<SnapshotWriteResult> => {
    const serializationStartedAt = performance.now();
    let serialized = "";
    try {
      assertSnapshotIntegrity(snapshot, snapshot.instanceId);
      serialized = JSON.stringify(snapshot);
      metrics.lastSnapshotSerializationDurationMs = Math.max(0, performance.now() - serializationStartedAt);
      metrics.lastSerializedSnapshotSizeBytes = new TextEncoder().encode(serialized).byteLength;
      if (metrics.lastSerializedSnapshotSizeBytes > 5 * 1024 * 1024) {
        console.warn("[snapshot-persistence] recovery-head serialized size exceeded 5 MiB");
      }
      const databaseStartedAt = performance.now();
      const result = await withOptionalTransaction(database, options, async (client) => {
        await ensureSnapshotInstanceRow(client, snapshot);
        const current = await loadRecoveryHeadFrom(client, snapshot.instanceId, true);
        const decision = classifySnapshotWrite(current, snapshot);
        if (decision === "idempotent") {
          await syncHostedSnapshotPointer(client, snapshot.instanceId);
          return decision;
        }
        const upsert = await client.query(
          `
            INSERT INTO empire_snapshot_latest (
              id, server_instance_id, schema_version, snapshot_id,
              root_version, tick, payload, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::timestamptz, now())
            ON CONFLICT (server_instance_id) DO UPDATE
            SET schema_version = EXCLUDED.schema_version,
                snapshot_id = EXCLUDED.snapshot_id,
                root_version = EXCLUDED.root_version,
                tick = EXCLUDED.tick,
                payload = EXCLUDED.payload,
                created_at = EXCLUDED.created_at,
                updated_at = now()
            WHERE empire_snapshot_latest.root_version < EXCLUDED.root_version
            RETURNING snapshot_id
          `,
          [
            createRecoveryHeadId(snapshot.instanceId),
            snapshot.instanceId,
            snapshot.version.schemaVersion,
            snapshot.snapshotId,
            snapshot.integrity.rootVersion,
            snapshot.tick,
            serialized,
            snapshot.createdAt
          ]
        );
        if ((upsert.rowCount ?? upsert.rows.length) !== 1) {
          await assertRejectedRecoveryHeadIsIdempotent(client, snapshot);
          await syncHostedSnapshotPointer(client, snapshot.instanceId);
          return "idempotent";
        }
        await syncHostedSnapshotPointer(client, snapshot.instanceId);
        return current ? "updated" : "created";
      });
      metrics.lastDatabaseSaveDurationMs = Math.max(0, performance.now() - databaseStartedAt);
      if (result !== "idempotent") metrics.recoveryHeadUpdates += 1;
      return result;
    } catch (error) {
      metrics.recoveryHeadUpdateFailures += 1;
      if (String((error as Error)?.message ?? "").includes("stale rootVersion")) {
        metrics.rootVersionDowngradeAttempts += 1;
        console.warn("[snapshot-persistence] recovery-head downgrade attempt rejected");
      }
      throw error;
    }
  };

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
      if (result === "created") recordCheckpointMetric(metrics, checkpoint.kind);
      return result;
    } catch (error) {
      metrics.checkpointSaveFailures += 1;
      throw error;
    }
  };

  const loadRecoveryHead = (instanceId: ServerInstanceId) =>
    loadRecoveryHeadFrom(database, instanceId, false);

  const loadLatestCheckpoint = async (instanceId: ServerInstanceId) =>
    (await loadCheckpointCandidates(database, instanceId, 1))[0] ?? null;

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
    save: async (snapshot) => { await saveRecoveryHead(snapshot); },
    loadLatest: loadRecoveryHead
  };
};

const syncHostedSnapshotPointer = async (
  client: PostgresQueryable,
  serverInstanceId: ServerInstanceId
): Promise<void> => {
  await client.query(
    `UPDATE empire_hosted_server_instances hosted
     SET current_snapshot_id=head.snapshot_id
     FROM empire_snapshot_latest head
     WHERE hosted.server_instance_id=$1
       AND head.server_instance_id=hosted.server_instance_id
       AND hosted.provisioning_state='ready'
       AND hosted.status IN ('lobby','running')
       AND hosted.current_snapshot_id IS DISTINCT FROM head.snapshot_id`,
    [serverInstanceId]
  );
};
