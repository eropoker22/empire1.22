import type { HostedJoinJobRecord } from "./hosted-control-plane-repository";
import { HOSTED_WORKER_FRESH_MS } from "./hosted-control-plane-repository";
import type { PostgresDatabase, PostgresQueryable } from "../../runtime/persistence/postgres";

export interface PostgresHostedJoinJobRow extends Record<string, unknown> { [key: string]: unknown }

export const claimPostgresHostedJoinJob = async (
  database: PostgresDatabase,
  workerId: string,
  now: string,
  claimedUntil: string
): Promise<HostedJoinJobRecord | null> => {
  const result = await database.query<PostgresHostedJoinJobRow>(
    `WITH candidate AS (
       SELECT job.job_id FROM empire_hosted_join_jobs job
       JOIN empire_hosted_join_reservations reservation ON reservation.reservation_id=job.reservation_id
       JOIN empire_hosted_server_instances server ON server.server_instance_id=job.server_instance_id
       WHERE (job.status='pending' OR (job.status='claimed' AND job.claimed_until <= $2::timestamptz))
         AND job.available_at <= $2::timestamptz AND reservation.status='reserved'
         AND reservation.expires_at > $2::timestamptz
         AND server.provisioning_state='ready'
         AND server.status IN ('lobby','running') AND server.current_snapshot_id IS NOT NULL
         AND server.runtime_lease_owner_id IS NOT NULL AND server.registration_closed_at IS NULL
         AND server.registration_opens_at <= clock_timestamp()
         AND server.registration_closes_at > clock_timestamp()
         AND server.registration_closes_at = server.registration_opens_at
           + (server.registration_window_minutes * interval '1 minute')
         AND server.last_worker_heartbeat_at > clock_timestamp() - ($4::bigint * interval '1 millisecond')
         AND server.runtime_lease_expires_at > clock_timestamp()
       ORDER BY job.available_at,job.created_at FOR UPDATE OF job SKIP LOCKED LIMIT 1
     ) UPDATE empire_hosted_join_jobs job SET status='claimed',claimed_by_worker_id=$1,
       claimed_until=$3::timestamptz,attempt=attempt+1,updated_at=$2::timestamptz,version=version+1
     FROM candidate WHERE job.job_id=candidate.job_id RETURNING ${qualify("job", HOSTED_JOIN_JOB_COLUMNS)}`,
    [workerId, now, claimedUntil, HOSTED_WORKER_FRESH_MS]
  );
  return result.rows[0] ? mapPostgresHostedJoinJob(result.rows[0]) : null;
};

export const loadPostgresHostedJoinJob = async (
  client: PostgresQueryable,
  reservationId: string
): Promise<HostedJoinJobRecord | null> => {
  const result = await client.query<PostgresHostedJoinJobRow>(
    `${HOSTED_JOIN_JOB_SELECT} WHERE reservation_id=$1`,
    [reservationId]
  );
  return result.rows[0] ? mapPostgresHostedJoinJob(result.rows[0]) : null;
};

const mapPostgresHostedJoinJob = (row: PostgresHostedJoinJobRow): HostedJoinJobRecord => ({
  jobId: String(row.job_id),
  reservationId: String(row.reservation_id),
  serverInstanceId: String(row.server_instance_id),
  status: row.status as HostedJoinJobRecord["status"],
  attempt: Number(row.attempt),
  availableAt: iso(row.available_at),
  claimedByWorkerId: nullable(row.claimed_by_worker_id),
  claimedUntil: isoOrNull(row.claimed_until),
  lastErrorCode: nullable(row.last_error_code),
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at),
  version: Number(row.version)
});

const HOSTED_JOIN_JOB_COLUMNS = `job_id,reservation_id,server_instance_id,status,attempt,available_at,claimed_by_worker_id,
  claimed_until,last_error_code,created_at,updated_at,version`;
const HOSTED_JOIN_JOB_SELECT = `SELECT ${HOSTED_JOIN_JOB_COLUMNS} FROM empire_hosted_join_jobs`;
const qualify = (alias: string, columns: string) => columns.split(",").map((column) => `${alias}.${column.trim()}`).join(",");
const nullable = (value: unknown): string | null => value == null ? null : String(value);
const iso = (value: unknown): string => value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
const isoOrNull = (value: unknown): string | null => value == null ? null : iso(value);
