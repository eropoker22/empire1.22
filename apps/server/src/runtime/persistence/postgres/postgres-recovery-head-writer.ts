import type { ServerInstanceId } from "@empire/shared-types";
import type { InstanceSnapshotDto } from "../dto";
import {
  recordFullSnapshotRead,
  recordFullSnapshotWrite,
  recordMetadataOnlyRead,
  serializedJsonBytes,
  snapshotFieldBytes,
  type SnapshotPersistenceMetrics,
  type SnapshotWriteResult
} from "../repositories";
import { classifySnapshotWrite } from "../repositories/snapshot-write-guard";
import { assertSnapshotIntegrity } from "../services/snapshot-integrity-validator";
import type { PostgresQueryable } from "./postgres-client";
import { loadRecoveryMetadataFrom } from "./postgres-snapshot-metadata";
import {
  createRecoveryHeadId,
  ensureSnapshotInstanceRow,
  loadRecoveryHeadFrom,
  type PostgresSnapshotRepositoryOptions,
  withOptionalTransaction
} from "./postgres-snapshot-storage";

export const createPostgresRecoveryHeadWriter = (
  database: PostgresQueryable,
  options: PostgresSnapshotRepositoryOptions,
  metrics: SnapshotPersistenceMetrics
) => async (snapshot: InstanceSnapshotDto): Promise<SnapshotWriteResult> => {
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
      const current = await loadRecoveryMetadataFrom(client, snapshot.instanceId, true);
      recordMetadataOnlyRead(metrics, snapshot.instanceId, current ? 160 : 8);
      if (current && current.rootVersion > snapshot.integrity.rootVersion) {
        throw new Error(
          `Refusing to overwrite snapshot ${current.snapshotId} rootVersion ${current.rootVersion} with stale rootVersion ${snapshot.integrity.rootVersion}.`
        );
      }
      if (current?.rootVersion === snapshot.integrity.rootVersion) {
        const latest = await loadTrackedRecoveryHead(client, snapshot.instanceId, false, metrics);
        const decision = classifySnapshotWrite(latest, snapshot);
        if (decision !== "idempotent") {
          throw new Error(
            `Recovery head ${current.snapshotId} has rootVersion ${current.rootVersion} but is not idempotent.`
          );
        }
        await syncHostedSnapshotPointer(client, snapshot.instanceId);
        return decision;
      }
      const upsert = await client.query(
        `INSERT INTO empire_snapshot_latest (
           id, server_instance_id, schema_version, snapshot_id,
           root_version, tick, payload, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::timestamptz, now())
         ON CONFLICT (server_instance_id) DO UPDATE
         SET schema_version=EXCLUDED.schema_version, snapshot_id=EXCLUDED.snapshot_id,
             root_version=EXCLUDED.root_version, tick=EXCLUDED.tick, payload=EXCLUDED.payload,
             created_at=EXCLUDED.created_at, updated_at=now()
         WHERE empire_snapshot_latest.root_version < EXCLUDED.root_version
         RETURNING snapshot_id`,
        [createRecoveryHeadId(snapshot.instanceId), snapshot.instanceId, snapshot.version.schemaVersion,
          snapshot.snapshotId, snapshot.integrity.rootVersion, snapshot.tick, serialized, snapshot.createdAt]
      );
      if ((upsert.rowCount ?? upsert.rows.length) !== 1) {
        const latest = await loadTrackedRecoveryHead(client, snapshot.instanceId, false, metrics);
        if (!latest) throw new Error("Recovery head compare-and-swap rejected without a persisted head.");
        classifySnapshotWrite(latest, snapshot);
        await syncHostedSnapshotPointer(client, snapshot.instanceId);
        return "idempotent";
      }
      await syncHostedSnapshotPointer(client, snapshot.instanceId);
      return current ? "updated" : "created";
    });
    metrics.lastDatabaseSaveDurationMs = Math.max(0, performance.now() - databaseStartedAt);
    if (result !== "idempotent") {
      metrics.recoveryHeadUpdates += 1;
      recordFullSnapshotWrite(metrics, snapshot.instanceId, metrics.lastSerializedSnapshotSizeBytes);
      metrics.lastSnapshotFieldBytes = snapshotFieldBytes(snapshot);
    }
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

export const loadTrackedRecoveryHead = async (
  database: PostgresQueryable,
  instanceId: ServerInstanceId,
  forUpdate: boolean,
  metrics: SnapshotPersistenceMetrics
) => {
  const snapshot = await loadRecoveryHeadFrom(database, instanceId, forUpdate);
  if (snapshot) recordFullSnapshotRead(metrics, instanceId, serializedJsonBytes(snapshot));
  return snapshot;
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
