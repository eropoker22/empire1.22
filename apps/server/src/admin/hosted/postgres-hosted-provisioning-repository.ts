import type { PostgresDatabase, PostgresQueryable } from "../../runtime/persistence/postgres";
import { HOSTED_WORKER_FRESH_MS, type HostedControlPlaneRepository } from "./hosted-control-plane-repository";
import {
  insertAudit,
  JOB_COLUMNS,
  mapJob,
  type ProvisioningRow
} from "./postgres-hosted-control-plane-helpers";

type ProvisioningMethods = Pick<HostedControlPlaneRepository,
  "claimProvisioningJob" | "beginProvisioning" | "completeProvisioning" | "failProvisioning">;

export const createPostgresHostedProvisioningRepository = (
  database: PostgresDatabase
): ProvisioningMethods => ({
  claimProvisioningJob: async (workerId, workerIncarnationId, now, claimedUntil) => {
    const result = await database.query<ProvisioningRow>(
      `WITH candidate AS (
        SELECT job_id FROM empire_hosted_server_provisioning_jobs
        WHERE (status='pending' OR (status='claimed' AND claimed_until <= $3::timestamptz))
          AND available_at <= $3::timestamptz
          AND EXISTS (SELECT 1 FROM empire_hosted_worker_heartbeats worker
            WHERE worker.worker_id=$1 AND worker.worker_incarnation_id=$2 AND worker.status='online'
              AND worker.last_heartbeat_at > clock_timestamp() - ($5::int * interval '1 millisecond'))
        ORDER BY available_at, created_at FOR UPDATE SKIP LOCKED LIMIT 1
       ) UPDATE empire_hosted_server_provisioning_jobs job SET status='claimed', claimed_by_worker_id=$1,
         claimed_by_worker_incarnation_id=$2,claimed_until=$4::timestamptz,attempt=attempt+1,
         version=version+1,updated_at=$3::timestamptz
       FROM candidate WHERE job.job_id=candidate.job_id RETURNING ${qualifyColumns("job", JOB_COLUMNS)}`,
      [workerId, workerIncarnationId, now, claimedUntil, HOSTED_WORKER_FRESH_MS]
    );
    return result.rows[0] ? mapJob(result.rows[0]) : null;
  },
  beginProvisioning: (input) => database.transaction(async (client) => {
    if (!await lockCurrentClaim(client, input)) return false;
    const changed = await client.query(
      `UPDATE empire_hosted_server_instances SET status='provisioning',provisioning_state='provisioning',
       join_policy='closed',updated_at=$4::timestamptz,version=version+1
       WHERE server_instance_id=$1 AND provisioning_state IN ('requested','provisioning')
         AND runtime_lease_owner_id=$2 AND runtime_lease_incarnation_id=$3
         AND runtime_lease_expires_at > $4::timestamptz
       RETURNING server_instance_id`,
      [input.serverInstanceId, input.workerId, input.workerIncarnationId, input.at]
    );
    if ((changed.rowCount ?? 0) === 0) return false;
    await client.query(
      `UPDATE empire_server_instances SET status='provisioning',updated_at=$2::timestamptz WHERE server_instance_id=$1`,
      [input.serverInstanceId, input.at]
    );
    return true;
  }),
  completeProvisioning: (input) => database.transaction(async (client) => {
    if (!await lockCurrentClaim(client, input)) return false;
    const changed = await client.query(
      `UPDATE empire_hosted_server_instances SET status='lobby', provisioning_state='ready', join_policy='closed',
       initial_snapshot_id=COALESCE(initial_snapshot_id,$4), current_snapshot_id=$4, last_error_code=NULL,
       updated_at=$5::timestamptz, version=version+1
       WHERE server_instance_id=$1 AND provisioning_state='provisioning'
         AND runtime_lease_owner_id=$2 AND runtime_lease_incarnation_id=$3
         AND runtime_lease_expires_at > $5::timestamptz
         AND (initial_snapshot_id IS NULL OR initial_snapshot_id=$4)
       RETURNING server_instance_id`,
      [input.serverInstanceId, input.workerId, input.workerIncarnationId, input.snapshotId, input.at]
    );
    if ((changed.rowCount ?? 0) === 0) return false;
    await client.query(
      `UPDATE empire_server_instances SET status='lobby', payload=jsonb_set(payload,'{joinPolicy}','"closed"'),
       updated_at=$2::timestamptz WHERE server_instance_id=$1`,
      [input.serverInstanceId, input.at]
    );
    await client.query(
      `UPDATE empire_hosted_server_provisioning_jobs SET status='completed', claimed_until=NULL,
       updated_at=$2::timestamptz, version=version+1 WHERE job_id=$1`,
      [input.jobId, input.at]
    );
    await insertAudit(client, input.audit);
    return true;
  }),
  failProvisioning: (input) => database.transaction(async (client) => {
    if (!await lockCurrentClaim(client, input)) return false;
    const changed = await client.query(
      `UPDATE empire_hosted_server_instances SET status='failed', provisioning_state='failed', join_policy='closed',
       last_error_code=$4, updated_at=$5::timestamptz, version=version+1
       WHERE server_instance_id=$1 AND provisioning_state='provisioning'
         AND runtime_lease_owner_id=$2 AND runtime_lease_incarnation_id=$3
         AND runtime_lease_expires_at > $5::timestamptz
       RETURNING server_instance_id`,
      [input.serverInstanceId, input.workerId, input.workerIncarnationId, input.errorCode, input.at]
    );
    if ((changed.rowCount ?? 0) === 0) return false;
    await client.query(
      `UPDATE empire_server_instances SET status='failed', updated_at=$2::timestamptz WHERE server_instance_id=$1`,
      [input.serverInstanceId, input.at]
    );
    await client.query(
      `UPDATE empire_hosted_server_provisioning_jobs SET status='failed', claimed_until=NULL,last_error_code=$2,
       updated_at=$3::timestamptz,version=version+1 WHERE job_id=$1`,
      [input.jobId, input.errorCode, input.at]
    );
    await insertAudit(client, input.audit);
    return true;
  })
});

const lockCurrentClaim = async (
  client: PostgresQueryable,
  input: { jobId: string; serverInstanceId: string; workerId: string; workerIncarnationId: string;
    expectedJobVersion: number; at: string }
): Promise<boolean> => {
  const result = await client.query(
    `SELECT job_id FROM empire_hosted_server_provisioning_jobs
     WHERE job_id=$1 AND server_instance_id=$2 AND status='claimed' AND claimed_by_worker_id=$3
       AND claimed_by_worker_incarnation_id=$4 AND version=$5 AND claimed_until > $6::timestamptz
       AND EXISTS (SELECT 1 FROM empire_hosted_worker_heartbeats worker
         WHERE worker.worker_id=$3 AND worker.worker_incarnation_id=$4 AND worker.status='online'
           AND worker.last_heartbeat_at > clock_timestamp() - ($7::int * interval '1 millisecond'))
     FOR UPDATE`,
    [input.jobId, input.serverInstanceId, input.workerId, input.workerIncarnationId,
      input.expectedJobVersion, input.at, HOSTED_WORKER_FRESH_MS]
  );
  return (result.rowCount ?? 0) > 0;
};

const qualifyColumns = (alias: string, columns: string): string =>
  columns.split(",").map((column) => `${alias}.${column}`).join(",");
