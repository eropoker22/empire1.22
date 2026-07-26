import type { ServerInstanceId } from "@empire/shared-types";
import type { QueryResultRow } from "pg";
import type {
  InstanceSnapshotDto,
  SnapshotCheckpointKind,
  SnapshotCheckpointRecord
} from "../dto";
import {
  assertSnapshotCheckpointIntegrity,
  assertSnapshotIntegrity
} from "../services/snapshot-integrity-validator";
import type {
  SnapshotPersistenceMetrics
} from "../repositories";
import { classifySnapshotWrite } from "../repositories/snapshot-write-guard";
import type { PostgresDatabase, PostgresQueryable } from "./postgres-client";
import { ensurePostgresServerInstanceRow } from "./postgres-server-instance-row";

export interface PostgresSnapshotRepositoryOptions {
  wrapWritesInTransaction: boolean;
  metrics?: SnapshotPersistenceMetrics;
}

export interface SnapshotCheckpointCursor {
  rootVersion: number;
  tick: number;
  createdAt: string;
  checkpointId: string;
}

export const ensureSnapshotInstanceRow = (
  client: PostgresQueryable,
  snapshot: InstanceSnapshotDto
): Promise<void> => ensurePostgresServerInstanceRow(client, snapshot.instanceId, {
  mode: snapshot.mode,
  status: snapshot.metadata.status,
  payload: {
    snapshotId: snapshot.snapshotId,
    displayName: snapshot.lobby?.displayName,
    region: snapshot.lobby?.region,
    capacity: snapshot.lobby?.capacity,
    joinPolicy: snapshot.lobby?.joinPolicy
  },
  createdAt: snapshot.metadata.createdAt
});

export const loadRecoveryHeadFrom = async (
  database: PostgresQueryable,
  instanceId: ServerInstanceId,
  forUpdate: boolean
): Promise<InstanceSnapshotDto | null> => {
  const result = await database.query<{ payload: unknown }>(
    `
      SELECT payload
      FROM empire_snapshot_latest
      WHERE server_instance_id = $1
      ${forUpdate ? "FOR UPDATE" : ""}
    `,
    [instanceId]
  );
  return result.rows[0] ? coercePayload<InstanceSnapshotDto>(result.rows[0].payload) : null;
};

export const loadCheckpointCandidates = async (
  database: PostgresQueryable,
  instanceId: ServerInstanceId,
  limit: number,
  cursor: SnapshotCheckpointCursor | null = null
): Promise<SnapshotCheckpointRecord[]> => {
  const result = await database.query<CheckpointRow>(
    `
      SELECT snapshot_id, checkpoint_kind, reason_code, lifecycle_phase,
             is_protected, root_version, tick, created_at, payload
      FROM empire_snapshots
      WHERE server_instance_id = $1
        AND (
          $3::bigint IS NULL
          OR (root_version, tick, created_at, snapshot_id) <
             ($3::bigint, $4::integer, $5::timestamptz, $6::text)
        )
      ORDER BY root_version DESC, tick DESC, created_at DESC, snapshot_id DESC
      LIMIT $2
    `,
    [
      instanceId,
      limit,
      cursor?.rootVersion ?? null,
      cursor?.tick ?? null,
      cursor?.createdAt ?? null,
      cursor?.checkpointId ?? null
    ]
  );
  return result.rows.map((row) => checkpointFromRow(instanceId, row));
};

const RECOVERY_CHECKPOINT_BATCH_SIZE = 20;

export const loadLatestValidCheckpoint = async (
  database: PostgresQueryable,
  instanceId: ServerInstanceId,
  metrics: SnapshotPersistenceMetrics
): Promise<SnapshotCheckpointRecord | null> => {
  let cursor: SnapshotCheckpointCursor | null = null;
  while (true) {
    const candidates = await loadCheckpointCandidates(
      database,
      instanceId,
      RECOVERY_CHECKPOINT_BATCH_SIZE,
      cursor
    );
    for (const candidate of candidates) {
      try {
        assertSnapshotCheckpointIntegrity(candidate);
        return candidate;
      } catch (_error) {
        metrics.recoveryIntegrityFailures += 1;
      }
    }
    if (candidates.length < RECOVERY_CHECKPOINT_BATCH_SIZE) return null;
    const last = candidates.at(-1)!;
    cursor = {
      rootVersion: last.rootVersion,
      tick: last.tick,
      createdAt: last.createdAt,
      checkpointId: last.checkpointId
    };
  }
};

export const assertRejectedCheckpointIsIdempotent = async (
  database: PostgresQueryable,
  checkpoint: SnapshotCheckpointRecord
): Promise<void> => {
  const result = await database.query<CheckpointRow>(
    `
      SELECT snapshot_id, checkpoint_kind, reason_code, lifecycle_phase,
             is_protected, root_version, tick, created_at, payload
      FROM empire_snapshots
      WHERE server_instance_id = $1
        AND snapshot_id = $2
      LIMIT 1
    `,
    [checkpoint.instanceId, checkpoint.checkpointId]
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error(`Checkpoint ${checkpoint.checkpointId} conflict was reported without a persisted row.`);
  }
  const existing = checkpointFromRow(checkpoint.instanceId, row);
  assertSnapshotCheckpointIntegrity(existing);
  assertSnapshotIntegrity(checkpoint.snapshot, checkpoint.instanceId);
  const sameMetadata =
    existing.kind === checkpoint.kind &&
    existing.reasonCode === checkpoint.reasonCode &&
    existing.lifecyclePhase === checkpoint.lifecyclePhase &&
    existing.protected === checkpoint.protected &&
    existing.tick === checkpoint.tick &&
    existing.rootVersion === checkpoint.rootVersion &&
    Date.parse(existing.createdAt) === Date.parse(checkpoint.createdAt);
  let sameSnapshot = false;
  try {
    sameSnapshot = classifySnapshotWrite(existing.snapshot, checkpoint.snapshot) === "idempotent";
  } catch (_error) {
    sameSnapshot = false;
  }
  if (!sameMetadata || !sameSnapshot) {
    throw new Error(`Checkpoint ${checkpoint.checkpointId} collides with a different persisted checkpoint.`);
  }
};

export const assertRejectedRecoveryHeadIsIdempotent = async (
  database: PostgresQueryable,
  snapshot: InstanceSnapshotDto
): Promise<void> => {
  const latest = await loadRecoveryHeadFrom(database, snapshot.instanceId, false);
  if (!latest) throw new Error("Recovery head compare-and-swap rejected without a persisted head.");
  classifySnapshotWrite(latest, snapshot);
};

export const withOptionalTransaction = async <TResult>(
  database: PostgresQueryable,
  options: PostgresSnapshotRepositoryOptions,
  callback: (client: PostgresQueryable) => Promise<TResult>
): Promise<TResult> => {
  if (options.wrapWritesInTransaction && "transaction" in database && typeof database.transaction === "function") {
    return database.transaction(callback);
  }
  return callback(database);
};

export const createCheckpointHistoryId = (checkpoint: SnapshotCheckpointRecord): string =>
  `snapshot-checkpoint:${checkpoint.instanceId}:${checkpoint.checkpointId}`;

export const createRecoveryHeadId = (instanceId: ServerInstanceId): string =>
  `snapshot-head:${instanceId}`;

export const recordCheckpointMetric = (
  metrics: SnapshotPersistenceMetrics,
  kind: SnapshotCheckpointKind
): void => {
  if (kind === "periodic-checkpoint") metrics.periodicCheckpointsCreated += 1;
  if (kind === "lifecycle-checkpoint") metrics.lifecycleCheckpointsCreated += 1;
  if (kind === "terminal-checkpoint") metrics.terminalCheckpointsCreated += 1;
};

interface CheckpointRow extends QueryResultRow {
  snapshot_id: string;
  checkpoint_kind: SnapshotCheckpointKind;
  reason_code: string;
  lifecycle_phase: string | null;
  is_protected: boolean;
  root_version: string | number;
  tick: string | number;
  created_at: string | Date;
  payload: unknown;
}

const checkpointFromRow = (
  instanceId: ServerInstanceId,
  row: CheckpointRow
): SnapshotCheckpointRecord => ({
  checkpointId: row.snapshot_id,
  instanceId,
  kind: row.checkpoint_kind,
  reasonCode: row.reason_code,
  lifecyclePhase: row.lifecycle_phase,
  protected: row.is_protected,
  createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  tick: Number(row.tick),
  rootVersion: Number(row.root_version),
  snapshot: coercePayload<InstanceSnapshotDto>(row.payload)
});

const coercePayload = <TPayload>(payload: unknown): TPayload =>
  typeof payload === "string" ? JSON.parse(payload) as TPayload : payload as TPayload;
