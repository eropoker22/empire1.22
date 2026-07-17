import type { PostgresDatabase } from "../../runtime/persistence/postgres";
import type {
  HostedControlPlaneRepository,
  HostedCreateTransactionResult,
} from "./hosted-control-plane-repository";
import { ACTION_COLUMNS, type ActionRow, failRestartIfInProgress, insertAction, insertAudit, insertJob, insertServer, JOB_COLUMNS,
  HOSTED_CONTROL_PLANE_MIGRATION, loadActionReplay, loadCreateReplay, mapAction, mapJob, mapServer, mapWorker, type ProvisioningRow,
  prepareRuntimeRestart, SERVER_SELECT, type HostedServerRow, type WorkerRow } from "./postgres-hosted-control-plane-helpers";
import { createPostgresHostedJoinRepository } from "./postgres-hosted-join-repository";

export const createPostgresHostedControlPlaneRepository = (
  database: PostgresDatabase
): HostedControlPlaneRepository => ({
  durable: true,
  ...createPostgresHostedJoinRepository(database),
  isSchemaCurrent: async () => {
    try {
      const result = await database.query<{ present: boolean }>(
        `SELECT EXISTS (SELECT 1 FROM empire_schema_migrations WHERE filename=$1 AND checksum=$2) AS present`,
        [HOSTED_CONTROL_PLANE_MIGRATION.filename, HOSTED_CONTROL_PLANE_MIGRATION.checksum]
      );
      return result.rows[0]?.present === true;
    } catch (_error) {
      return false;
    }
  },
  listServers: async () => {
    const result = await database.query<HostedServerRow>(`${SERVER_SELECT} ORDER BY created_at, server_instance_id`);
    return result.rows.map(mapServer);
  },
  getServer: async (id) => {
    const result = await database.query<HostedServerRow>(`${SERVER_SELECT} WHERE server_instance_id=$1`, [id]);
    return result.rows[0] ? mapServer(result.rows[0]) : null;
  },
  createServerTransaction: (input) => database.transaction(async (client) => {
    const reserved = await client.query(
      `INSERT INTO empire_hosted_server_idempotency
       (id,admin_user_id,operation,idempotency_key,request_hash,resource_id,response_payload,created_at,updated_at)
       VALUES ($1,$2,'create-server',$3,$4,$5,$6::jsonb,$7::timestamptz,$7::timestamptz)
       ON CONFLICT (admin_user_id,operation,idempotency_key) DO NOTHING RETURNING id`,
      [`hosted-idempotency:${input.server.serverInstanceId}`, input.adminUserId, input.idempotencyKey,
        input.requestHash, input.server.serverInstanceId, JSON.stringify({ status: input.server.status,
          provisioningState: input.server.provisioningState, joinPolicy: input.server.joinPolicy,
          version: input.server.version, updatedAt: input.server.updatedAt, jobId: input.job.jobId }), input.server.createdAt]
    );
    if ((reserved.rowCount ?? 0) === 0) {
      const replay = await loadCreateReplay(client, input.adminUserId, input.idempotencyKey, input.requestHash);
      if (replay.kind === "replayed") await insertAudit(client, { ...input.audit, action: "create-server-replay",
        targetInstanceId: replay.server.serverInstanceId });
      return replay;
    }

    await client.query(
      `INSERT INTO empire_server_instances
       (id,server_instance_id,schema_version,mode,status,payload,created_at,updated_at)
       VALUES ($1,$2,1,$3,$4,$5::jsonb,$6::timestamptz,$6::timestamptz)`,
      [`server-instance:${input.server.serverInstanceId}`, input.server.serverInstanceId, input.server.mode,
        input.server.status, JSON.stringify({ displayName: input.server.displayName, region: input.server.region,
          capacity: input.server.capacity, joinPolicy: input.server.joinPolicy }), input.server.createdAt]
    );
    await insertServer(client, input.server);
    await insertJob(client, input.job);
    await insertAudit(client, input.audit);
    return { kind: "created", server: input.server, job: input.job } satisfies HostedCreateTransactionResult;
  }),
  enqueueActionTransaction: (input) => database.transaction(async (client) => {
    const operation = `lifecycle:${input.request.serverInstanceId}`;
    const existing = await client.query<{ request_hash: string }>(
      `SELECT request_hash FROM empire_hosted_server_idempotency
       WHERE admin_user_id=$1 AND operation=$2 AND idempotency_key=$3`,
      [input.request.adminUserId, operation, input.idempotencyKey]
    );
    if (existing.rows[0]) {
      const replay = await loadActionReplay(client, input.request.adminUserId, operation, input.idempotencyKey, input.requestHash);
      if (replay.kind === "replayed") await insertAudit(client, { ...input.audit, action: "lifecycle-replay" });
      return replay;
    }
    const server = await client.query<{ version: string | number }>(
      `SELECT version FROM empire_hosted_server_instances WHERE server_instance_id=$1 FOR UPDATE`,
      [input.request.serverInstanceId]
    );
    if (!server.rows[0]) return { kind: "not-found" };
    if (Number(server.rows[0].version) !== input.request.expectedVersion) return { kind: "stale-version" };
    const reserved = await client.query(
      `INSERT INTO empire_hosted_server_idempotency
       (id,admin_user_id,operation,idempotency_key,request_hash,resource_id,response_payload,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::timestamptz,$8::timestamptz)
       ON CONFLICT (admin_user_id,operation,idempotency_key) DO NOTHING RETURNING id`,
      [`hosted-idempotency:${input.request.actionRequestId}`, input.request.adminUserId, operation,
        input.idempotencyKey, input.requestHash, input.request.actionRequestId,
        JSON.stringify({ status: input.request.status, version: input.request.version }), input.request.createdAt]
    );
    if ((reserved.rowCount ?? 0) === 0) {
      const replay = await loadActionReplay(client, input.request.adminUserId, operation, input.idempotencyKey, input.requestHash);
      if (replay.kind === "replayed") await insertAudit(client, { ...input.audit, action: "lifecycle-replay" });
      return replay;
    }
    await insertAction(client, input.request);
    await insertAudit(client, input.audit);
    return { kind: "created", request: input.request };
  }),
  claimProvisioningJob: async (workerId, now, claimedUntil) => {
    const result = await database.query<ProvisioningRow>(
      `WITH candidate AS (
        SELECT job_id FROM empire_hosted_server_provisioning_jobs
        WHERE (status='pending' OR (status='claimed' AND claimed_until <= $2::timestamptz))
          AND available_at <= $2::timestamptz
        ORDER BY available_at, created_at FOR UPDATE SKIP LOCKED LIMIT 1
       ) UPDATE empire_hosted_server_provisioning_jobs job SET status='claimed', claimed_by_worker_id=$1,
         claimed_until=$3::timestamptz, attempt=attempt+1, version=version+1, updated_at=$2::timestamptz
       FROM candidate WHERE job.job_id=candidate.job_id RETURNING ${qualifyColumns("job", JOB_COLUMNS)}`,
      [workerId, now, claimedUntil]
    );
    return result.rows[0] ? mapJob(result.rows[0]) : null;
  },
  beginProvisioning: async (jobId, serverInstanceId, at) => {
    const result = await database.transaction(async (client) => {
      const changed = await client.query(
        `UPDATE empire_hosted_server_instances SET status='provisioning',provisioning_state='provisioning',
         join_policy='closed',updated_at=$2::timestamptz,version=version+1
         WHERE server_instance_id=$1 AND provisioning_state IN ('requested','provisioning') RETURNING server_instance_id`,
        [serverInstanceId, at]
      );
      if ((changed.rowCount ?? 0) > 0) await client.query(
        `UPDATE empire_server_instances SET status='provisioning',updated_at=$2::timestamptz WHERE server_instance_id=$1`,
        [serverInstanceId, at]
      );
      const job = await client.query(`SELECT job_id FROM empire_hosted_server_provisioning_jobs WHERE job_id=$1 AND server_instance_id=$2`, [jobId, serverInstanceId]);
      return (changed.rowCount ?? 0) > 0 && (job.rowCount ?? 0) > 0;
    });
    return result;
  },
  completeProvisioning: (input) => database.transaction(async (client) => {
    await client.query(
      `UPDATE empire_hosted_server_instances SET status='lobby', provisioning_state='ready', join_policy='closed',
       initial_snapshot_id=COALESCE(initial_snapshot_id,$2), current_snapshot_id=$2, last_error_code=NULL,
       updated_at=$3::timestamptz, version=version+1
       WHERE server_instance_id=$1 AND (initial_snapshot_id IS NULL OR initial_snapshot_id=$2)`,
      [input.serverInstanceId, input.snapshotId, input.at]
    );
    await client.query(
      `UPDATE empire_server_instances SET status='lobby', payload=jsonb_set(payload,'{joinPolicy}','"closed"'),
       updated_at=$2::timestamptz WHERE server_instance_id=$1`, [input.serverInstanceId, input.at]);
    await client.query(
      `UPDATE empire_hosted_server_provisioning_jobs SET status='completed', claimed_until=NULL,
       updated_at=$2::timestamptz, version=version+1 WHERE job_id=$1`, [input.jobId, input.at]);
    await insertAudit(client, input.audit);
  }),
  failProvisioning: (input) => database.transaction(async (client) => {
    await client.query(
      `UPDATE empire_hosted_server_instances SET status='failed', provisioning_state='failed', join_policy='closed',
       last_error_code=$2, updated_at=$3::timestamptz, version=version+1 WHERE server_instance_id=$1`,
      [input.serverInstanceId, input.errorCode, input.at]);
    await client.query(`UPDATE empire_server_instances SET status='failed', updated_at=$2::timestamptz WHERE server_instance_id=$1`,
      [input.serverInstanceId, input.at]);
    await client.query(
      `UPDATE empire_hosted_server_provisioning_jobs SET status='failed', claimed_until=NULL,last_error_code=$2,
       updated_at=$3::timestamptz,version=version+1 WHERE job_id=$1`, [input.jobId, input.errorCode, input.at]);
    await insertAudit(client, input.audit);
  }),
  claimAction: async (workerId, now, claimedUntil) => {
    const result = await database.query<ActionRow>(
      `WITH candidate AS (
        SELECT action_request_id FROM empire_hosted_server_action_requests
        WHERE status='requested' OR (status='processing' AND claimed_until <= $2::timestamptz)
        ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1
       ) UPDATE empire_hosted_server_action_requests request SET status='processing', claimed_by_worker_id=$1,
         claimed_until=$3::timestamptz, updated_at=$2::timestamptz, version=version+1
       FROM candidate WHERE request.action_request_id=candidate.action_request_id RETURNING ${qualifyColumns("request", ACTION_COLUMNS)}`,
      [workerId, now, claimedUntil]
    );
    return result.rows[0] ? mapAction(result.rows[0]) : null;
  },
  prepareRuntimeRestart: (input) => database.transaction((client) => prepareRuntimeRestart(client, input)),
  completeAction: (input) => database.transaction(async (client) => {
    const changed = await client.query(
      `UPDATE empire_hosted_server_instances SET status=$2, join_policy=$3,
       last_started_at=CASE WHEN $6='start' THEN $4::timestamptz ELSE last_started_at END,
       last_paused_at=CASE WHEN $2='paused' THEN $4::timestamptz ELSE last_paused_at END,
       last_stopped_at=CASE WHEN $2='stopped' THEN $4::timestamptz ELSE last_stopped_at END,
       updated_at=$4::timestamptz, version=version+1 WHERE server_instance_id=$1 AND version=$5 RETURNING server_instance_id`,
      [input.request.serverInstanceId, input.nextStatus, input.nextJoinPolicy, input.at, input.request.expectedVersion,
        input.request.action]
    );
    if ((changed.rowCount ?? 0) === 0) throw new Error("Lifecycle request has a stale server version.");
    await client.query(
      `UPDATE empire_server_instances SET status=$2,payload=jsonb_set(payload,'{joinPolicy}',to_jsonb($3::text)),
       updated_at=$4::timestamptz WHERE server_instance_id=$1`,
      [input.request.serverInstanceId, input.nextStatus, input.nextJoinPolicy, input.at]
    );
    await client.query(
      `UPDATE empire_hosted_server_action_requests SET status='completed',claimed_until=NULL,updated_at=$2::timestamptz,
       version=version+1 WHERE action_request_id=$1`, [input.request.actionRequestId, input.at]);
    await insertAudit(client, input.audit);
  }),
  failAction: (input) => database.transaction(async (client) => {
    await failRestartIfInProgress(client, { serverInstanceId: input.request.serverInstanceId,
      errorCode: input.errorCode, at: input.at });
    await client.query(
      `UPDATE empire_hosted_server_action_requests SET status='failed',claimed_until=NULL,last_error_code=$2,
       updated_at=$3::timestamptz,version=version+1 WHERE action_request_id=$1`,
      [input.request.actionRequestId, input.errorCode, input.at]);
    await insertAudit(client, input.audit);
  }),
  writeWorkerHeartbeat: async (record) => {
    await database.query(
      `INSERT INTO empire_hosted_worker_heartbeats
       (id,worker_id,region,started_at,last_heartbeat_at,build_sha,status,updated_at)
       VALUES ($1,$2,$3,$4::timestamptz,$5::timestamptz,$6,$7,$5::timestamptz)
       ON CONFLICT (worker_id) DO UPDATE SET region=EXCLUDED.region,last_heartbeat_at=EXCLUDED.last_heartbeat_at,
       build_sha=EXCLUDED.build_sha,status=EXCLUDED.status,updated_at=EXCLUDED.updated_at`,
      [`hosted-worker:${record.workerId}`, record.workerId, record.region, record.startedAt,
        record.lastHeartbeatAt, record.buildSha, record.status]
    );
  },
  getFreshWorkerHeartbeat: async (since) => {
    const result = await database.query<WorkerRow>(
      `SELECT worker_id,region,started_at,last_heartbeat_at,build_sha,status FROM empire_hosted_worker_heartbeats
       WHERE status='online' AND last_heartbeat_at >= $1::timestamptz ORDER BY last_heartbeat_at DESC LIMIT 1`, [since]);
    return result.rows[0] ? mapWorker(result.rows[0]) : null;
  },
  acquireRuntimeLease: async (input) => {
    const result = await database.query(
      `UPDATE empire_hosted_server_instances SET runtime_lease_owner_id=$2,runtime_lease_expires_at=$4::timestamptz,
       last_worker_heartbeat_at=$3::timestamptz,updated_at=$3::timestamptz
       WHERE server_instance_id=$1 AND (runtime_lease_owner_id=$2 OR runtime_lease_expires_at IS NULL OR runtime_lease_expires_at <= $3::timestamptz)
       RETURNING server_instance_id`, [input.serverInstanceId, input.workerId, input.now, input.expiresAt]);
    return (result.rowCount ?? 0) > 0;
  },
  releaseRuntimeLease: async (id, workerId, at) => {
    await database.query(`UPDATE empire_hosted_server_instances SET runtime_lease_owner_id=NULL,runtime_lease_expires_at=NULL,
      updated_at=$3::timestamptz WHERE server_instance_id=$1 AND runtime_lease_owner_id=$2 AND status <> 'running'`, [id, workerId, at]);
  },
  writeInstanceHeartbeat: async (input) => {
    await database.query(
      `INSERT INTO empire_hosted_instance_heartbeats
       (id,server_instance_id,worker_id,lease_expires_at,last_tick,last_snapshot_at,last_error_code,last_heartbeat_at,updated_at)
       VALUES ($1,$2,$3,$4::timestamptz,$5,$6::timestamptz,$7,$8::timestamptz,$8::timestamptz)
       ON CONFLICT (server_instance_id) DO UPDATE SET worker_id=EXCLUDED.worker_id,lease_expires_at=EXCLUDED.lease_expires_at,
       last_tick=EXCLUDED.last_tick,last_snapshot_at=EXCLUDED.last_snapshot_at,last_error_code=EXCLUDED.last_error_code,
       last_heartbeat_at=EXCLUDED.last_heartbeat_at,updated_at=EXCLUDED.updated_at`,
      [`hosted-instance-heartbeat:${input.serverInstanceId}`, input.serverInstanceId, input.workerId,
        input.leaseExpiresAt, input.lastTick, input.lastSnapshotAt, input.lastErrorCode, input.at]
    );
    await database.query(`UPDATE empire_hosted_server_instances SET last_worker_heartbeat_at=$3::timestamptz,
      runtime_lease_expires_at=$4::timestamptz,updated_at=$3::timestamptz
      WHERE server_instance_id=$1 AND runtime_lease_owner_id=$2`,
    [input.serverInstanceId, input.workerId, input.at, input.leaseExpiresAt]);
  }
});

const qualifyColumns = (alias: string, columns: string): string =>
  columns.split(",").map((column) => `${alias}.${column}`).join(",");
