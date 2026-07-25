import type { ServerInstanceId } from "@empire/shared-types";
import type {
  InstanceSnapshotDto,
  SnapshotCheckpointKind,
  SnapshotCheckpointRecord
} from "../dto";
import type {
  SnapshotPersistenceMetrics,
  SnapshotWriteResult
} from "../repositories";
import { classifySnapshotWrite } from "../repositories/snapshot-write-guard";
import type { PostgresDatabase, PostgresQueryable } from "./postgres-client";
import { ensurePostgresServerInstanceRow } from "./postgres-server-instance-row";

export interface PostgresSnapshotRepositoryOptions {
  wrapWritesInTransaction: boolean;
  metrics?: SnapshotPersistenceMetrics;
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
  limit: number
): Promise<SnapshotCheckpointRecord[]> => {
  const result = await database.query<CheckpointRow>(
    `
      SELECT snapshot_id, checkpoint_kind, reason_code, lifecycle_phase,
             is_protected, root_version, tick, created_at, payload
      FROM empire_snapshots
      WHERE server_instance_id = $1
      ORDER BY root_version DESC, tick DESC, created_at DESC, snapshot_id DESC
      LIMIT $2
    `,
    [instanceId, limit]
  );
  return result.rows.map((row) => checkpointFromRow(instanceId, row));
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

interface CheckpointRow {
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
