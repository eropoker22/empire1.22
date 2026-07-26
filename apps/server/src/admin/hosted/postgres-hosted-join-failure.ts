import type { PostgresQueryable } from "../../runtime/persistence/postgres";
import type { HostedControlPlaneRepository } from "./hosted-control-plane-repository";

type JoinFailureInput = Parameters<HostedControlPlaneRepository["failJoin"]>[0];

export const failPostgresHostedJoinInTransaction = async (
  client: PostgresQueryable,
  input: JoinFailureInput
): Promise<boolean> => {
  const job = await client.query<{
    status: string;
    claimed_by_worker_id: string | null;
    claimed_by_worker_incarnation_id: string | null;
    claimed_until: unknown;
    version: string | number;
  }>(
    `SELECT status,claimed_by_worker_id,claimed_by_worker_incarnation_id,claimed_until,version
     FROM empire_hosted_join_jobs
     WHERE job_id=$1 AND reservation_id=$2 AND server_instance_id=$3
     FOR UPDATE`,
    [input.jobId, input.reservationId, input.serverInstanceId]
  );
  const current = job.rows[0];
  if (!current || current.status !== "claimed"
    || current.claimed_by_worker_id !== input.workerId
    || current.claimed_by_worker_incarnation_id !== input.workerIncarnationId
    || Number(current.version) !== input.expectedJobVersion
    || !current.claimed_until
    || Date.parse(String(current.claimed_until)) <= Date.parse(input.at)) return false;
  const reservation = await client.query(
    `UPDATE empire_hosted_join_reservations SET status=$3,
       canceled_at=CASE WHEN $3='expired' THEN canceled_at ELSE $4::timestamptz END,
       updated_at=$4::timestamptz,version=version+1
     WHERE reservation_id=$1 AND server_instance_id=$2 AND status='reserved'
     RETURNING reservation_id`,
    [input.reservationId, input.serverInstanceId, input.status, input.at]
  );
  if ((reservation.rowCount ?? 0) !== 1) return false;
  const failed = await client.query(
    `UPDATE empire_hosted_join_jobs SET status='failed',claimed_by_worker_id=NULL,
       claimed_by_worker_incarnation_id=NULL,claimed_until=NULL,last_error_code=$7,
       updated_at=$8::timestamptz,version=version+1
     WHERE job_id=$1 AND reservation_id=$2 AND server_instance_id=$3 AND status='claimed'
       AND claimed_by_worker_id=$4 AND claimed_by_worker_incarnation_id=$5 AND version=$6
     RETURNING job_id`,
    [input.jobId, input.reservationId, input.serverInstanceId, input.workerId,
      input.workerIncarnationId, input.expectedJobVersion, input.errorCode, input.at]
  );
  if ((failed.rowCount ?? 0) !== 1) {
    throw new Error(`Hosted join job ${input.jobId} claim changed while it was locked.`);
  }
  return true;
};
