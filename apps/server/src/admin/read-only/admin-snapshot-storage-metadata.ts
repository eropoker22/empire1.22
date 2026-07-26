import type { AdminSnapshotSummaryView } from "@empire/shared-types";
import type { PostgresQueryable } from "../../runtime/persistence/postgres";

const SNAPSHOT_CLEANUP_STALE_MS = 30 * 60_000;

export interface AdminSnapshotStorageMetadata {
  lastCheckpointAt: string | null;
  rollingCheckpointCount: number;
  lifecycleCheckpointCount: number;
  terminalCheckpointCount: number;
  lastCleanupAt: string | null;
  lastCleanupStatus: NonNullable<AdminSnapshotSummaryView["lastCleanupStatus"]>;
}

interface SnapshotStorageRow extends Record<string, unknown> {
  last_checkpoint_at: Date | string | null;
  rolling_checkpoint_count: string | number;
  lifecycle_checkpoint_count: string | number;
  terminal_checkpoint_count: string | number;
  last_cleanup_at: Date | string | null;
  last_cleanup_status: string | null;
}

export const loadAdminSnapshotStorageMetadata = async (
  database: PostgresQueryable,
  serverInstanceId: string
): Promise<AdminSnapshotStorageMetadata> => {
  const result = await database.query<SnapshotStorageRow>(
    `
      SELECT
        checkpoints.last_checkpoint_at,
        checkpoints.rolling_checkpoint_count,
        checkpoints.lifecycle_checkpoint_count,
        checkpoints.terminal_checkpoint_count,
        maintenance.last_completed_at AS last_cleanup_at,
        maintenance.last_status AS last_cleanup_status
      FROM (
        SELECT
          max(created_at) AS last_checkpoint_at,
          count(*) FILTER (
            WHERE checkpoint_kind IN ('periodic-checkpoint', 'legacy-checkpoint')
          ) AS rolling_checkpoint_count,
          count(*) FILTER (
            WHERE checkpoint_kind = 'lifecycle-checkpoint'
          ) AS lifecycle_checkpoint_count,
          count(*) FILTER (
            WHERE checkpoint_kind = 'terminal-checkpoint'
          ) AS terminal_checkpoint_count
        FROM empire_snapshots
        WHERE server_instance_id = $1
      ) checkpoints
      LEFT JOIN empire_snapshot_maintenance maintenance
        ON maintenance.scope = 'global'
    `,
    [serverInstanceId]
  );
  const row = result.rows[0];
  return {
    lastCheckpointAt: optionalIso(row?.last_checkpoint_at),
    rollingCheckpointCount: count(row?.rolling_checkpoint_count),
    lifecycleCheckpointCount: count(row?.lifecycle_checkpoint_count),
    terminalCheckpointCount: count(row?.terminal_checkpoint_count),
    lastCleanupAt: optionalIso(row?.last_cleanup_at),
    lastCleanupStatus: cleanupStatus(row?.last_cleanup_status)
  };
};

export const resolveAdminSnapshotStorageHealth = (input: {
  hasRecoveryHead: boolean;
  recoveryHeadStale: boolean;
  metadata: AdminSnapshotStorageMetadata;
  now: Date;
}): NonNullable<AdminSnapshotSummaryView["storageHealth"]> => {
  if (!input.hasRecoveryHead) return "unavailable";
  if (input.recoveryHeadStale) return "attention";
  if (input.metadata.lastCleanupStatus === "failed"
    || input.metadata.lastCleanupStatus === "never"
    || input.metadata.lastCleanupStatus === "unavailable") {
    return "attention";
  }
  if (!input.metadata.lastCleanupAt
    || input.now.getTime() - Date.parse(input.metadata.lastCleanupAt) > SNAPSHOT_CLEANUP_STALE_MS) {
    return "attention";
  }
  return "healthy";
};

const count = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
};

const optionalIso = (value: Date | string | null | undefined): string | null =>
  value ? (value instanceof Date ? value.toISOString() : new Date(value).toISOString()) : null;

const cleanupStatus = (
  value: string | null | undefined
): AdminSnapshotStorageMetadata["lastCleanupStatus"] =>
  value === "never" || value === "success" || value === "failed" || value === "skipped-lock"
    ? value
    : "unavailable";
