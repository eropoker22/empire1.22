import type { AdminAuditEntryView } from "@empire/shared-types";
import type { PostgresQueryable } from "../../runtime/persistence/postgres";
import { HOSTED_WORKER_FRESH_MS, type HostedActionRequestRecord, type HostedActionTransactionResult, type HostedCreateTransactionResult, type HostedProvisioningJobRecord, type HostedServerRecord, type HostedWorkerHeartbeatRecord } from "./hosted-control-plane-repository";

export interface HostedServerRow extends Record<string, unknown> { [key: string]: unknown }
export interface ProvisioningRow extends Record<string, unknown> { [key: string]: unknown }
export interface ActionRow extends Record<string, unknown> { [key: string]: unknown }
export interface WorkerRow extends Record<string, unknown> { [key: string]: unknown }

export const loadCreateReplay = async (client: PostgresQueryable, adminUserId: string, key: string, hash: string): Promise<HostedCreateTransactionResult> => {
  const idempotency = await client.query<{ request_hash: string; resource_id: string; response_payload: unknown }>(
    `SELECT request_hash,resource_id,response_payload FROM empire_hosted_server_idempotency
     WHERE admin_user_id=$1 AND operation='create-server' AND idempotency_key=$2`, [adminUserId, key]);
  if (!idempotency.rows[0] || idempotency.rows[0].request_hash !== hash) return { kind: "conflict" };
  const server = await client.query<HostedServerRow>(`${SERVER_SELECT} WHERE server_instance_id=$1`, [idempotency.rows[0].resource_id]);
  const job = await client.query<ProvisioningRow>(`${JOB_SELECT} WHERE server_instance_id=$1`, [idempotency.rows[0].resource_id]);
  if (!server.rows[0] || !job.rows[0]) throw new Error("Idempotency record references an incomplete create transaction.");
  const original = asRecord(idempotency.rows[0].response_payload);
  const mappedServer = mapServer(server.rows[0]);
  const mappedJob = mapJob(job.rows[0]);
  return { kind: "replayed", server: { ...mappedServer,
    status: original.status as HostedServerRecord["status"] ?? mappedServer.status,
    provisioningState: original.provisioningState as HostedServerRecord["provisioningState"] ?? mappedServer.provisioningState,
    joinPolicy: original.joinPolicy as HostedServerRecord["joinPolicy"] ?? mappedServer.joinPolicy,
    version: Number(original.version ?? mappedServer.version), updatedAt: String(original.updatedAt ?? mappedServer.updatedAt) },
    job: { ...mappedJob, jobId: String(original.jobId ?? mappedJob.jobId) } };
};

export const loadActionReplay = async (client: PostgresQueryable, userId: string, operation: string, key: string, hash: string): Promise<HostedActionTransactionResult> => {
  const idem = await client.query<{ request_hash: string; resource_id: string; response_payload: unknown }>(
    `SELECT request_hash,resource_id,response_payload FROM empire_hosted_server_idempotency WHERE admin_user_id=$1 AND operation=$2 AND idempotency_key=$3`,
    [userId, operation, key]);
  if (!idem.rows[0] || idem.rows[0].request_hash !== hash) return { kind: "conflict" };
  const request = await client.query<ActionRow>(`${ACTION_SELECT} WHERE action_request_id=$1`, [idem.rows[0].resource_id]);
  if (!request.rows[0]) throw new Error("Idempotency record references an incomplete action transaction.");
  const original = asRecord(idem.rows[0].response_payload);
  const mapped = mapAction(request.rows[0]);
  return { kind: "replayed", request: { ...mapped,
    status: original.status as HostedActionRequestRecord["status"] ?? mapped.status,
    version: Number(original.version ?? mapped.version) } };
};

export const insertServer = (db: PostgresQueryable, s: HostedServerRecord) => db.query(
  `INSERT INTO empire_hosted_server_instances (${SERVER_INSERT_COLUMNS})
   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::timestamptz,$14::timestamptz,$15::timestamptz,
    $16,$17,$18,$19,$20,$21,$22,$23,$24::jsonb,$25,$26,$27,$28::timestamptz,$29::timestamptz,$30::timestamptz,
    $31::timestamptz,$32::timestamptz,$33,$34,$35::timestamptz,$36::timestamptz,$37,$38)`,
  [`hosted-server:${s.serverInstanceId}`,s.serverInstanceId,s.mode,s.displayName,s.region,s.capacity,s.status,s.joinPolicy,
    s.provisioningState,s.minimumReadyPlayersToStart,s.registrationWindowMinutes,s.registrationScheduleVersion,
    s.registrationOpensAt,s.registrationClosesAt,s.registrationClosedAt,s.registrationBaselinePlayers,
    s.canonicalFinalLockdownTrigger,s.canonicalFirstEliminationTick,s.canonicalTickRateMs,s.effectiveFinalLockdownTrigger,
    s.effectiveFirstEliminationTick,s.worldSeed,s.configVersion,JSON.stringify(s.mapComposition),s.initialSnapshotId,
    s.currentSnapshotId,s.runtimeLeaseOwnerId,
    s.runtimeLeaseExpiresAt,s.lastWorkerHeartbeatAt,s.lastStartedAt,s.lastPausedAt,s.lastStoppedAt,s.lastErrorCode,
    s.createdByAdminUserId,s.createdAt,s.updatedAt,s.version,s.serverTemplate]
);
export const insertJob = (db: PostgresQueryable, j: HostedProvisioningJobRecord) => db.query(
  `INSERT INTO empire_hosted_server_provisioning_jobs
   (id,job_id,server_instance_id,attempt,status,available_at,claimed_by_worker_id,claimed_until,last_error_code,created_at,updated_at,version)
   VALUES ($1,$2,$3,$4,$5,$6::timestamptz,$7,$8::timestamptz,$9,$10::timestamptz,$11::timestamptz,$12)`,
  [`hosted-job:${j.jobId}`,j.jobId,j.serverInstanceId,j.attempt,j.status,j.availableAt,j.claimedByWorkerId,j.claimedUntil,
    j.lastErrorCode,j.createdAt,j.updatedAt,j.version]
);
export const insertAction = (db: PostgresQueryable, r: HostedActionRequestRecord) => db.query(
  `INSERT INTO empire_hosted_server_action_requests
   (id,action_request_id,server_instance_id,admin_user_id,action,action_payload,reason,expected_version,status,
    claimed_by_worker_id,claimed_until,last_error_code,created_at,updated_at,version)
   VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11::timestamptz,$12,$13::timestamptz,$14::timestamptz,$15)`,
  [`hosted-action:${r.actionRequestId}`,r.actionRequestId,r.serverInstanceId,r.adminUserId,r.action,
    JSON.stringify(r.actionPayload),r.reason,r.expectedVersion,r.status,r.claimedByWorkerId,r.claimedUntil,r.lastErrorCode,
    r.createdAt,r.updatedAt,r.version]
);
export const insertAudit = (db: PostgresQueryable, e: AdminAuditEntryView) => db.query(
  `INSERT INTO empire_admin_access_audit (id,admin_session_id,actor_id,role,action,target_instance_id,result,correlation_id,created_at)
   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::timestamptz)`,
  [e.id,e.adminSessionId,e.actorId,e.role,e.action,e.targetInstanceId,e.result,e.correlationId,e.createdAt]
);

export const prepareRuntimeRestart = async (db: PostgresQueryable, input: {
  serverInstanceId: string; workerId: string; workerIncarnationId: string; expectedVersion: number; at: string;
}): Promise<boolean> => {
  const changed = await db.query(
    `UPDATE empire_hosted_server_instances SET status='restarting',join_policy='closed',updated_at=$5::timestamptz
     WHERE server_instance_id=$1 AND runtime_lease_owner_id=$2 AND runtime_lease_incarnation_id=$3 AND version=$4
       AND runtime_lease_expires_at > $5::timestamptz
       AND status IN ('running','restarting') RETURNING server_instance_id`,
    [input.serverInstanceId, input.workerId, input.workerIncarnationId, input.expectedVersion, input.at]
  );
  if ((changed.rowCount ?? 0) > 0) await db.query(
    `UPDATE empire_server_instances SET status='restarting',updated_at=$2::timestamptz WHERE server_instance_id=$1`,
    [input.serverInstanceId, input.at]
  );
  return (changed.rowCount ?? 0) > 0;
};

export const failActionIfLeaseCurrent = async (db: PostgresQueryable, input: {
  serverInstanceId: string; workerId: string; workerIncarnationId: string; expectedVersion: number;
  failRestart: boolean; errorCode: string; at: string;
}): Promise<boolean> => {
  const current = await db.query<{ status: string; version: number; runtime_lease_owner_id: string | null; runtime_lease_incarnation_id: string | null; runtime_lease_expires_at: Date | string | null }>(
    `SELECT status,version,runtime_lease_owner_id,runtime_lease_incarnation_id,runtime_lease_expires_at FROM empire_hosted_server_instances
     WHERE server_instance_id=$1 FOR UPDATE`, [input.serverInstanceId]);
  const server = current.rows[0];
  if (!server) return false;
  const currentLease = server.runtime_lease_owner_id === input.workerId &&
    server.runtime_lease_incarnation_id === input.workerIncarnationId && Boolean(server.runtime_lease_expires_at) &&
    new Date(server.runtime_lease_expires_at!).toISOString() > input.at;
  const releasedRestart = input.failRestart && !server.runtime_lease_owner_id && server.status === "restarting" &&
    Number(server.version) === input.expectedVersion;
  if (!currentLease && !releasedRestart) return false;
  if (!releasedRestart && (!input.failRestart || server.status !== "restarting" || Number(server.version) !== input.expectedVersion)) {
    const noted = await db.query(`UPDATE empire_hosted_server_instances SET last_error_code=$2,updated_at=$3::timestamptz
      WHERE server_instance_id=$1`, [input.serverInstanceId, input.errorCode, input.at]);
    return (noted.rowCount ?? 0) > 0;
  }
  const changed = await db.query(
    `UPDATE empire_hosted_server_instances SET status='failed',join_policy='closed',runtime_lease_owner_id=NULL,
     runtime_lease_incarnation_id=NULL,runtime_lease_expires_at=NULL,last_error_code=$2,
     updated_at=$3::timestamptz,version=version+1
     WHERE server_instance_id=$1 AND status='restarting' AND version=$4
       AND (runtime_lease_owner_id IS NULL OR (runtime_lease_owner_id=$5 AND runtime_lease_incarnation_id=$6))
     RETURNING server_instance_id`,
    [input.serverInstanceId, input.errorCode, input.at, input.expectedVersion, input.workerId, input.workerIncarnationId]);
  if ((changed.rowCount ?? 0) > 0) await db.query(
    `UPDATE empire_server_instances SET status='failed',updated_at=$2::timestamptz
     WHERE server_instance_id=$1 AND status='restarting'`, [input.serverInstanceId, input.at]);
  return (changed.rowCount ?? 0) > 0;
};

export const lockCurrentActionClaim = async (
  client: PostgresQueryable,
  input: { request: HostedActionRequestRecord; workerIncarnationId: string; at: string }
): Promise<boolean> => {
  const result = await client.query(
    `SELECT action_request_id FROM empire_hosted_server_action_requests
     WHERE action_request_id=$1 AND server_instance_id=$2 AND status='processing' AND claimed_by_worker_id=$3
       AND version=$4 AND claimed_until > $5::timestamptz
       AND EXISTS (SELECT 1 FROM empire_hosted_worker_heartbeats worker
         WHERE worker.worker_id=$3 AND worker.worker_incarnation_id=$6 AND worker.status='online'
           AND worker.last_heartbeat_at > clock_timestamp() - ($7::int * interval '1 millisecond')) FOR UPDATE`,
    [input.request.actionRequestId, input.request.serverInstanceId, input.request.claimedByWorkerId,
      input.request.version, input.at, input.workerIncarnationId, HOSTED_WORKER_FRESH_MS]);
  return (result.rowCount ?? 0) > 0;
};

export const mapServer = (r: HostedServerRow): HostedServerRecord => ({
  serverInstanceId:String(r.server_instance_id),mode:r.mode as HostedServerRecord["mode"],displayName:String(r.display_name),region:String(r.region),capacity:Number(r.capacity),
  serverTemplate:r.server_template as HostedServerRecord["serverTemplate"],
  status:r.status as HostedServerRecord["status"],joinPolicy:r.join_policy as HostedServerRecord["joinPolicy"],provisioningState:r.provisioning_state as HostedServerRecord["provisioningState"],
  minimumReadyPlayersToStart:Number(r.minimum_ready_players_to_start),registrationWindowMinutes:Number(r.registration_window_minutes),
  registrationScheduleVersion:Number(r.registration_schedule_version),registrationOpensAt:dateOrNull(r.registration_opens_at),
  registrationClosesAt:dateOrNull(r.registration_closes_at),registrationClosedAt:dateOrNull(r.registration_closed_at),
  registrationBaselinePlayers:numberOrNull(r.registration_baseline_players),canonicalFinalLockdownTrigger:numberOrNull(r.canonical_final_lockdown_trigger),
  canonicalFirstEliminationTick:numberOrNull(r.canonical_first_elimination_tick),canonicalTickRateMs:numberOrNull(r.canonical_tick_rate_ms),
  effectiveFinalLockdownTrigger:numberOrNull(r.effective_final_lockdown_trigger),effectiveFirstEliminationTick:numberOrNull(r.effective_first_elimination_tick),
  worldSeed:String(r.world_seed),configVersion:Number(r.config_version),mapComposition:json(r.map_composition) as HostedServerRecord["mapComposition"],
  initialSnapshotId:nullable(r.initial_snapshot_id),currentSnapshotId:nullable(r.current_snapshot_id),runtimeLeaseOwnerId:nullable(r.runtime_lease_owner_id),
  runtimeLeaseExpiresAt:dateOrNull(r.runtime_lease_expires_at),lastWorkerHeartbeatAt:dateOrNull(r.last_worker_heartbeat_at),lastStartedAt:dateOrNull(r.last_started_at),
  lastPausedAt:dateOrNull(r.last_paused_at),lastStoppedAt:dateOrNull(r.last_stopped_at),lastErrorCode:nullable(r.last_error_code),
  createdByAdminUserId:String(r.created_by_admin_user_id),createdAt:date(r.created_at),updatedAt:date(r.updated_at),version:Number(r.version)
});
export const mapJob = (r: ProvisioningRow): HostedProvisioningJobRecord => ({jobId:String(r.job_id),serverInstanceId:String(r.server_instance_id),attempt:Number(r.attempt),status:r.status as HostedProvisioningJobRecord["status"],availableAt:date(r.available_at),claimedByWorkerId:nullable(r.claimed_by_worker_id),claimedUntil:dateOrNull(r.claimed_until),lastErrorCode:nullable(r.last_error_code),createdAt:date(r.created_at),updatedAt:date(r.updated_at),version:Number(r.version)});
export const mapAction = (r: ActionRow): HostedActionRequestRecord => ({actionRequestId:String(r.action_request_id),serverInstanceId:String(r.server_instance_id),adminUserId:String(r.admin_user_id),action:r.action as HostedActionRequestRecord["action"],actionPayload:asRecord(r.action_payload) as HostedActionRequestRecord["actionPayload"],reason:String(r.reason),expectedVersion:Number(r.expected_version),status:r.status as HostedActionRequestRecord["status"],claimedByWorkerId:nullable(r.claimed_by_worker_id),claimedUntil:dateOrNull(r.claimed_until),lastErrorCode:nullable(r.last_error_code),createdAt:date(r.created_at),updatedAt:date(r.updated_at),version:Number(r.version)});
export const mapWorker = (r: WorkerRow): HostedWorkerHeartbeatRecord => ({workerId:String(r.worker_id),workerIncarnationId:String(r.worker_incarnation_id),region:String(r.region),startedAt:date(r.started_at),lastHeartbeatAt:date(r.last_heartbeat_at),buildSha:String(r.build_sha),status:r.status as HostedWorkerHeartbeatRecord["status"]});
const json = (v: unknown): unknown => typeof v === "string" ? JSON.parse(v) : v;
const nullable = (v: unknown): string | null => v == null ? null : String(v);
const numberOrNull = (v: unknown): number | null => v == null ? null : Number(v);
const date = (v: unknown): string => v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString();
const dateOrNull = (v: unknown): string | null => v == null ? null : date(v);
const asRecord = (value: unknown): Record<string, unknown> => {
  const parsed = typeof value === "string" ? JSON.parse(value) as unknown : value;
  return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
};
export const SERVER_COLUMNS = `server_instance_id,mode,display_name,region,capacity,status,join_policy,provisioning_state,minimum_ready_players_to_start,registration_window_minutes,registration_schedule_version,registration_opens_at,registration_closes_at,registration_closed_at,registration_baseline_players,canonical_final_lockdown_trigger,canonical_first_elimination_tick,canonical_tick_rate_ms,effective_final_lockdown_trigger,effective_first_elimination_tick,world_seed,config_version,map_composition,initial_snapshot_id,current_snapshot_id,runtime_lease_owner_id,runtime_lease_expires_at,last_worker_heartbeat_at,last_started_at,last_paused_at,last_stopped_at,last_error_code,created_by_admin_user_id,created_at,updated_at,version,server_template`;
export const SERVER_SELECT = `SELECT ${SERVER_COLUMNS} FROM empire_hosted_server_instances`;
const SERVER_INSERT_COLUMNS = `id,${SERVER_COLUMNS}`;
export const JOB_COLUMNS = `job_id,server_instance_id,attempt,status,available_at,claimed_by_worker_id,claimed_until,last_error_code,created_at,updated_at,version`;
export const ACTION_COLUMNS = `action_request_id,server_instance_id,admin_user_id,action,action_payload,reason,expected_version,status,claimed_by_worker_id,claimed_until,last_error_code,created_at,updated_at,version`;
const JOB_SELECT = `SELECT ${JOB_COLUMNS} FROM empire_hosted_server_provisioning_jobs`;
const ACTION_SELECT = `SELECT ${ACTION_COLUMNS} FROM empire_hosted_server_action_requests`;
