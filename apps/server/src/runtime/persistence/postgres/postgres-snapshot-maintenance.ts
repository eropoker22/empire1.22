import type { SnapshotRetentionPolicy } from "../services/retention-policy";
import type { SnapshotPersistenceMetrics } from "../repositories";
import type { PostgresQueryable } from "./postgres-client";
import {
  type PostgresSnapshotRepositoryOptions,
  withOptionalTransaction
} from "./postgres-snapshot-storage";

const SNAPSHOT_CLEANUP_ADVISORY_LOCK = 1_843_771_154;

export const cleanupPostgresCheckpoints = async (
  database: PostgresQueryable,
  options: PostgresSnapshotRepositoryOptions,
  policy: SnapshotRetentionPolicy,
  nowIso: string,
  metrics: SnapshotPersistenceMetrics
) => {
  const startedAt = performance.now();
  try {
    const result = await withOptionalTransaction(database, options, async (client) => {
      const lock = await client.query<{ acquired: boolean }>(
        "SELECT pg_try_advisory_xact_lock($1) AS acquired",
        [SNAPSHOT_CLEANUP_ADVISORY_LOCK]
      );
      if (lock.rows[0]?.acquired !== true) return { acquired: false, deletedRows: 0 };
      const deleted = await client.query(
        `
          WITH rolling AS (
            SELECT s.id,
                   row_number() OVER (
                     PARTITION BY s.server_instance_id
                     ORDER BY s.root_version DESC, s.tick DESC, s.created_at DESC, s.snapshot_id DESC
                   ) AS rolling_rank,
                   i.status,
                   s.created_at
            FROM empire_snapshots s
            JOIN empire_server_instances i ON i.server_instance_id = s.server_instance_id
            WHERE s.checkpoint_kind IN ('periodic-checkpoint', 'legacy-checkpoint')
              AND s.is_protected = false
          ),
          candidate_ids AS (
            SELECT id, created_at
            FROM rolling
            WHERE (
              status IN ('stopped', 'destroyed', 'completed', 'resolved')
              AND (
                rolling_rank > $1
                OR created_at < $2::timestamptz - ($3::text || ' days')::interval
              )
            ) OR (
              status NOT IN ('stopped', 'destroyed', 'completed', 'resolved')
              AND rolling_rank > $4
            )
            UNION
            SELECT s.id, s.created_at
            FROM empire_snapshots s
            JOIN empire_server_instances i ON i.server_instance_id = s.server_instance_id
            WHERE $5::boolean = false
              AND s.checkpoint_kind = 'lifecycle-checkpoint'
              AND s.is_protected = false
              AND i.status IN ('stopped', 'destroyed', 'completed', 'resolved')
              AND s.created_at < $2::timestamptz - ($3::text || ' days')::interval
          ),
          locked AS (
            SELECT s.id
            FROM empire_snapshots s
            JOIN candidate_ids candidate ON candidate.id = s.id
            ORDER BY candidate.created_at ASC, s.id ASC
            LIMIT $6
            FOR UPDATE OF s SKIP LOCKED
          )
          DELETE FROM empire_snapshots target
          USING locked
          WHERE target.id = locked.id
          RETURNING target.id
        `,
        [
          policy.rollingCheckpointCountTerminal,
          nowIso,
          policy.terminalRetentionDays,
          policy.rollingCheckpointCountActive,
          policy.retainLifecycleCheckpoints,
          policy.cleanupBatchSize
        ]
      );
      return { acquired: true, deletedRows: deleted.rowCount ?? deleted.rows.length };
    });
    const durationMs = Math.max(0, performance.now() - startedAt);
    if (result.acquired) {
      metrics.cleanupRuns += 1;
      metrics.cleanupDeletedRows += result.deletedRows;
      metrics.lastCleanupDurationMs = durationMs;
      metrics.lastCleanupAt = nowIso;
    }
    await recordMaintenanceStatus(database, {
      startedAt: nowIso,
      completedAt: nowIso,
      status: result.acquired ? "success" : "skipped-lock",
      deletedRows: result.deletedRows,
      durationMs
    });
    return { ...result, durationMs, completedAt: nowIso };
  } catch (error) {
    metrics.cleanupFailures += 1;
    await recordMaintenanceStatus(database, {
      startedAt: nowIso,
      completedAt: nowIso,
      status: "failed",
      deletedRows: 0,
      durationMs: Math.max(0, performance.now() - startedAt)
    }).catch(() => undefined);
    throw error;
  }
};

const recordMaintenanceStatus = (
  database: PostgresQueryable,
  input: {
    startedAt: string;
    completedAt: string;
    status: "success" | "failed" | "skipped-lock";
    deletedRows: number;
    durationMs: number;
  }
): Promise<unknown> => database.query(
  `
    INSERT INTO empire_snapshot_maintenance (
      scope, last_started_at, last_completed_at, last_status,
      last_deleted_rows, last_duration_ms, updated_at
    )
    VALUES ('global', $1::timestamptz, $2::timestamptz, $3, $4, $5, now())
    ON CONFLICT (scope) DO UPDATE
    SET last_started_at = EXCLUDED.last_started_at,
        last_completed_at = EXCLUDED.last_completed_at,
        last_status = EXCLUDED.last_status,
        last_deleted_rows = EXCLUDED.last_deleted_rows,
        last_duration_ms = EXCLUDED.last_duration_ms,
        updated_at = now()
  `,
  [
    input.startedAt,
    input.completedAt,
    input.status,
    input.deletedRows,
    input.durationMs
  ]
);
