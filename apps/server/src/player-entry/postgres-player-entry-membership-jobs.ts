import type { PostgresDatabase, PostgresQueryable } from "../runtime/persistence/postgres";

const WORKER_FRESH_MS = 30_000;

export interface MembershipJobRecord {
  jobId: string;
  membershipId: string;
  serverInstanceId: string;
  jobType: "activate" | "leave";
  status: "pending" | "claimed" | "completed" | "failed";
  attempt: number;
  claimedByWorkerId: string | null;
  claimedByWorkerIncarnationId: string | null;
  claimedUntil: string | null;
  version: number;
}

export interface MembershipJobCompletionInput {
  membershipId: string;
  jobId: string;
  serverInstanceId: string;
  accountId: string;
  workerId: string;
  workerIncarnationId: string;
  expectedJobVersion: number;
  joinTicketId: string | null;
  at: string;
}

export interface MembershipJobFailureInput {
  membershipId: string;
  jobId: string;
  serverInstanceId: string;
  workerId: string;
  workerIncarnationId: string;
  expectedJobVersion: number;
  errorCode: string;
  at: string;
}

export const claimPostgresMembershipJob = async (
  database: PostgresDatabase,
  workerId: string,
  workerIncarnationId: string,
  now: string,
  claimedUntil: string
): Promise<MembershipJobRecord | null> => {
  const result = await database.query<JobRow>(
    `WITH candidate AS (
       SELECT job_id FROM empire_server_membership_jobs
       WHERE (status='pending' OR (status='claimed' AND claimed_until <= $3::timestamptz))
         AND available_at <= $3::timestamptz
         AND EXISTS (SELECT 1 FROM empire_hosted_worker_heartbeats worker
           WHERE worker.worker_id=$1 AND worker.worker_incarnation_id=$2 AND worker.status='online'
             AND worker.last_heartbeat_at > clock_timestamp() - ($5::int * interval '1 millisecond'))
       ORDER BY available_at,created_at FOR UPDATE SKIP LOCKED LIMIT 1
     ) UPDATE empire_server_membership_jobs job SET status='claimed',claimed_by_worker_id=$1,
       claimed_by_worker_incarnation_id=$2,claimed_until=$4::timestamptz,
       attempt=attempt+1,updated_at=$3::timestamptz,version=version+1
     FROM candidate WHERE job.job_id=candidate.job_id
     RETURNING job.job_id,job.membership_id,job.server_instance_id,job.job_type,job.status,
       job.attempt,job.claimed_by_worker_id,job.claimed_by_worker_incarnation_id,job.claimed_until,job.version`,
    [workerId, workerIncarnationId, now, claimedUntil, WORKER_FRESH_MS]
  );
  return result.rows[0] ? mapJob(result.rows[0]) : null;
};

export const failPostgresMembershipJob = (
  database: PostgresDatabase,
  input: MembershipJobFailureInput
): Promise<boolean> => database.transaction(async (client) => {
  const failed = await client.query(
    `UPDATE empire_server_membership_jobs SET status=CASE WHEN attempt < 5 THEN 'pending' ELSE 'failed' END,
      claimed_by_worker_id=NULL,claimed_by_worker_incarnation_id=NULL,claimed_until=NULL,last_error_code=$7,
      available_at=CASE WHEN attempt < 5 THEN $8::timestamptz + interval '5 seconds' ELSE available_at END,
      updated_at=$8::timestamptz,version=version+1
     WHERE job_id=$1 AND membership_id=$2 AND server_instance_id=$3 AND status='claimed'
       AND claimed_by_worker_id=$4 AND claimed_by_worker_incarnation_id=$5 AND version=$6
       AND claimed_until > $8::timestamptz
     RETURNING job_id`,
    [input.jobId, input.membershipId, input.serverInstanceId, input.workerId,
      input.workerIncarnationId, input.expectedJobVersion, input.errorCode, input.at]
  );
  if ((failed.rowCount ?? 0) !== 1) return false;
  const membership = await client.query(
    `UPDATE empire_server_memberships SET last_error_code=$3,updated_at=$4::timestamptz,version=version+1
     WHERE membership_id=$1 AND server_instance_id=$2 RETURNING membership_id`,
    [input.membershipId, input.serverInstanceId, input.errorCode, input.at]
  );
  if ((membership.rowCount ?? 0) !== 1) {
    throw new Error(`Membership ${input.membershipId} changed while failing its job.`);
  }
  return true;
});

export const completePostgresMembershipJob = (
  database: PostgresDatabase,
  input: MembershipJobCompletionInput,
  nextStatus: "active" | "left_early"
): Promise<boolean> => database.transaction((client) =>
  completePostgresMembershipJobInTransaction(client, input, nextStatus));

export const completePostgresMembershipJobInTransaction = async (
  client: PostgresQueryable,
  input: MembershipJobCompletionInput,
  nextStatus: "active" | "left_early"
): Promise<boolean> => {
  const job = await client.query<MembershipJobClaimRow>(
    `SELECT status,claimed_by_worker_id,claimed_by_worker_incarnation_id,claimed_until,version
     FROM empire_server_membership_jobs
     WHERE job_id=$1 AND membership_id=$2 AND server_instance_id=$3 FOR UPDATE`,
    [input.jobId, input.membershipId, input.serverInstanceId]
  );
  const currentJob = job.rows[0];
  if (!currentJob) return false;
  const membership = await client.query<MembershipCompletionRow>(
    `SELECT membership_id,account_id,server_instance_id,status,join_ticket_id,
       reserved_spawn_district_id,setup_completed_at
     FROM empire_server_memberships
     WHERE membership_id=$1 AND server_instance_id=$2 AND account_id=$3 FOR UPDATE`,
    [input.membershipId, input.serverInstanceId, input.accountId]
  );
  const row = membership.rows[0];
  if (!row) return false;
  if (row.status === nextStatus) {
    if (currentJob.status === "completed") {
      return nextStatus !== "active" || nullable(row.join_ticket_id) === input.joinTicketId;
    }
    return isCurrentClaim(currentJob, input) ? finishJob(client, input) : false;
  }
  if (!isCurrentClaim(currentJob, input)) return false;
  const expected = nextStatus === "active" ? "finalizing_setup" : "leave_pending";
  if (row.status !== expected) return false;
  const changed = await client.query(
    `UPDATE empire_server_memberships SET status=$2,
      setup_completed_at=CASE WHEN $2='active' THEN $3::timestamptz ELSE setup_completed_at END,
      starter_package_applied_at=CASE WHEN $2='active' THEN COALESCE(starter_package_applied_at,$3::timestamptz) ELSE starter_package_applied_at END,
      early_leave_at=CASE WHEN $2='left_early' THEN $3::timestamptz ELSE early_leave_at END,
      join_ticket_id=COALESCE($4,join_ticket_id),last_error_code=NULL,updated_at=$3::timestamptz,version=version+1
     WHERE membership_id=$1 AND server_instance_id=$5 AND account_id=$6 AND status=$7 RETURNING membership_id`,
    [input.membershipId, nextStatus, input.at, input.joinTicketId,
      input.serverInstanceId, input.accountId, expected]
  );
  if ((changed.rowCount ?? 0) !== 1) return false;
  if (nextStatus === "left_early") await client.query(
    `UPDATE empire_hosted_join_reservations SET status='canceled',canceled_at=$2::timestamptz,
      updated_at=$2::timestamptz,version=version+1
     WHERE membership_id=$1 AND server_instance_id=$3 AND status='committed'`,
    [input.membershipId, input.at, input.serverInstanceId]
  );
  await insertMembershipEvent(client, input, row, nextStatus);
  return finishJob(client, input);
};

const finishJob = async (
  client: PostgresQueryable,
  input: MembershipJobCompletionInput
): Promise<boolean> => {
  const result = await client.query(
    `UPDATE empire_server_membership_jobs SET status='completed',claimed_by_worker_id=NULL,
     claimed_by_worker_incarnation_id=NULL,claimed_until=NULL,last_error_code=NULL,updated_at=$8::timestamptz,
     version=version+1 WHERE job_id=$1 AND membership_id=$2 AND server_instance_id=$3 AND status='claimed'
       AND claimed_by_worker_id=$4 AND claimed_by_worker_incarnation_id=$5 AND version=$6
       AND claimed_until > $7::timestamptz RETURNING job_id`,
    [input.jobId, input.membershipId, input.serverInstanceId, input.workerId,
      input.workerIncarnationId, input.expectedJobVersion, input.at, input.at]
  );
  if ((result.rowCount ?? 0) !== 1) {
    throw new Error(`Membership job ${input.jobId} claim changed while it was locked.`);
  }
  return true;
};

const isCurrentClaim = (
  job: MembershipJobClaimRow,
  input: MembershipJobCompletionInput
): boolean => job.status === "claimed"
  && job.claimed_by_worker_id === input.workerId
  && job.claimed_by_worker_incarnation_id === input.workerIncarnationId
  && Number(job.version) === input.expectedJobVersion
  && Boolean(job.claimed_until)
  && Date.parse(String(job.claimed_until)) > Date.parse(input.at);

const insertMembershipEvent = (
  client: PostgresQueryable,
  input: MembershipJobCompletionInput,
  row: MembershipCompletionRow,
  nextStatus: "active" | "left_early"
) => {
  const eventType = nextStatus === "active" ? "player-activated" : "early-leave";
  const metadata = nextStatus === "active"
    ? { starterPackageApplied: true, districtId: String(row.reserved_spawn_district_id) }
    : { setupCompleted: Boolean(row.setup_completed_at) };
  return client.query(
    `INSERT INTO empire_server_membership_events
     (id,event_id,membership_id,server_instance_id,account_id,event_type,result,error_code,metadata,created_at)
     VALUES ($1,$1,$2,$3,$4,$5,'completed',NULL,$6::jsonb,$7::timestamptz)
     ON CONFLICT (event_id) DO NOTHING`,
    [`membership-event:${input.membershipId}:${eventType}`, input.membershipId, input.serverInstanceId,
      input.accountId, eventType, JSON.stringify(metadata), input.at]
  );
};

const mapJob = (row: JobRow): MembershipJobRecord => ({
  jobId: String(row.job_id), membershipId: String(row.membership_id), serverInstanceId: String(row.server_instance_id),
  jobType: row.job_type as MembershipJobRecord["jobType"], status: row.status as MembershipJobRecord["status"],
  attempt: Number(row.attempt), claimedByWorkerId: nullable(row.claimed_by_worker_id),
  claimedByWorkerIncarnationId: nullable(row.claimed_by_worker_incarnation_id),
  claimedUntil: isoOrNull(row.claimed_until), version: Number(row.version)
});

const nullable = (value: unknown): string | null => value == null ? null : String(value);
const isoOrNull = (value: unknown): string | null =>
  value == null ? null : value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();

interface JobRow extends Record<string, unknown> { job_id: unknown; membership_id: unknown; server_instance_id: unknown; job_type: unknown; status: unknown; attempt: unknown; claimed_by_worker_id: unknown; claimed_by_worker_incarnation_id: unknown; claimed_until: unknown; version: unknown }
interface MembershipJobClaimRow extends Record<string, unknown> { status: unknown; claimed_by_worker_id: string | null; claimed_by_worker_incarnation_id: string | null; claimed_until: unknown; version: unknown }
interface MembershipCompletionRow extends Record<string, unknown> { status: unknown; join_ticket_id: unknown; reserved_spawn_district_id: unknown; setup_completed_at: unknown }
