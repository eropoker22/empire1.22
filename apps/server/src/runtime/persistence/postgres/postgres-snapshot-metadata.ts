import type { ServerInstanceId } from "@empire/shared-types";
import type { QueryResultRow } from "pg";
import type { PostgresQueryable } from "./postgres-client";

interface PostgresSnapshotRecoveryMetadataRow extends QueryResultRow {
  snapshot_id: string;
  root_version: string | number;
  tick: string | number;
  created_at: string | Date;
  updated_at: string | Date;
}

export const loadRecoveryMetadataFrom = async (
  database: PostgresQueryable,
  instanceId: ServerInstanceId,
  forUpdate: boolean
) => {
  const result = await database.query<PostgresSnapshotRecoveryMetadataRow>(
    `SELECT snapshot_id, root_version, tick, created_at, updated_at
     FROM empire_snapshot_latest
     WHERE server_instance_id = $1
     ${forUpdate ? "FOR UPDATE" : ""}`,
    [instanceId]
  );
  const row = result.rows[0];
  return row ? {
    snapshotId: row.snapshot_id,
    rootVersion: Number(row.root_version),
    tick: Number(row.tick),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at)
  } : null;
};
