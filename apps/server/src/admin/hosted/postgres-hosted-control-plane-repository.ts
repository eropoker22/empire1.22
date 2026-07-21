import { isProductionSchemaCurrent, type PostgresDatabase } from "../../runtime/persistence/postgres";
import type {
  HostedActionRequestRecord,
  HostedControlPlaneRepository,
  HostedCreateTransactionResult,
} from "./hosted-control-plane-repository";
import { HOSTED_WORKER_FRESH_MS } from "./hosted-control-plane-repository";
import { ACTION_COLUMNS, type ActionRow, failActionIfLeaseCurrent, insertAction, insertAudit, insertJob, insertServer,
  lockCurrentActionClaim,
  loadActionReplay, loadCreateReplay, mapAction, mapServer, mapWorker,
  prepareRuntimeRestart, SERVER_SELECT, type HostedServerRow, type WorkerRow } from "./postgres-hosted-control-plane-helpers";
import { createPostgresHostedJoinRepository } from "./postgres-hosted-join-repository";
import { createPostgresHostedProvisioningRepository } from "./postgres-hosted-provisioning-repository";
import { createPostgresHostedRegistrationRepository } from "./postgres-hosted-registration-repository";
import { completePostgresHostedAction } from "./postgres-hosted-action-completion";

export const createPostgresHostedControlPlaneRepository = (
  database: PostgresDatabase
): HostedControlPlaneRepository => ({
  durable: true,
  ...createPostgresHostedJoinRepository(database),
  ...createPostgresHostedProvisioningRepository(database),
  ...createPostgresHostedRegistrationRepository(database),
  isSchemaCurrent: () => isProductionSchemaCurrent(database),
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
    const server = await client.query<{ version: string | number; provisioning_state: string }>(
      `SELECT version,provisioning_state FROM empire_hosted_server_instances WHERE server_instance_id=$1 FOR UPDATE`,
      [input.request.serverInstanceId]
    );
    if (!server.rows[0]) return { kind: "not-found" };
    if (server.rows[0].provisioning_state !== "ready") return { kind: "not-ready" };
    if (Number(server.rows[0].version) !== input.request.expectedVersion) return { kind: "stale-version" };
    const activeOperation = await client.query(
      `SELECT action_request_id FROM empire_hosted_server_action_requests
       WHERE server_instance_id=$1 AND status IN ('requested','processing') LIMIT 1`,
      [input.request.serverInstanceId]
    );
    if ((activeOperation.rowCount ?? 0) > 0) return { kind: "operation-active" };
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
  claimAction: async (workerId, workerIncarnationId, now, claimedUntil) => {
    const result = await database.query<ActionRow>(
      `WITH candidate AS (
        SELECT action_request_id FROM empire_hosted_server_action_requests
        WHERE (status='requested' OR (status='processing' AND claimed_until <= $3::timestamptz))
          AND EXISTS (SELECT 1 FROM empire_hosted_worker_heartbeats worker
            WHERE worker.worker_id=$1 AND worker.worker_incarnation_id=$2 AND worker.status='online'
              AND worker.last_heartbeat_at > clock_timestamp() - ($5::int * interval '1 millisecond'))
        ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1
       ) UPDATE empire_hosted_server_action_requests request SET status='processing', claimed_by_worker_id=$1,
         claimed_until=$4::timestamptz, updated_at=$3::timestamptz, version=version+1
       FROM candidate WHERE request.action_request_id=candidate.action_request_id RETURNING ${qualifyColumns("request", ACTION_COLUMNS)}`,
      [workerId, workerIncarnationId, now, claimedUntil, HOSTED_WORKER_FRESH_MS]
    );
    return result.rows[0] ? mapAction(result.rows[0]) : null;
  },
  prepareRuntimeRestart: (input) => database.transaction((client) => prepareRuntimeRestart(client, input)),
  completeAction: (input) => completePostgresHostedAction(database, input),
  failAction: (input) => database.transaction(async (client) => {
    if (!input.request.claimedByWorkerId || !await lockCurrentActionClaim(client, input)) return false;
    if (!await failActionIfLeaseCurrent(client, {
      serverInstanceId: input.request.serverInstanceId, workerId: input.request.claimedByWorkerId,
      workerIncarnationId: input.workerIncarnationId, expectedVersion: input.request.expectedVersion,
      failRestart: input.request.action === "restart", errorCode: input.errorCode, at: input.at
    })) return false;
    await client.query(
      `UPDATE empire_hosted_server_action_requests SET status='failed',claimed_until=NULL,last_error_code=$2,
       updated_at=$3::timestamptz,version=version+1 WHERE action_request_id=$1`,
      [input.request.actionRequestId, input.errorCode, input.at]);
    await insertAudit(client, input.audit);
    return true;
  }),
  finalizeResolvedServer: (input) => database.transaction(async (client) => {
    const changed = await client.query(
      `UPDATE empire_hosted_server_instances SET status='stopped',join_policy='closed',current_snapshot_id=$5,
       runtime_lease_owner_id=NULL,runtime_lease_incarnation_id=NULL,runtime_lease_expires_at=NULL,
       last_stopped_at=$6::timestamptz,last_error_code=NULL,updated_at=$6::timestamptz,version=version+1
       WHERE server_instance_id=$1 AND provisioning_state='ready' AND status='running' AND version=$4
         AND runtime_lease_owner_id=$2 AND runtime_lease_incarnation_id=$3
         AND runtime_lease_expires_at > $6::timestamptz
       RETURNING server_instance_id`,
      [input.serverInstanceId, input.workerId, input.workerIncarnationId, input.expectedVersion,
        input.snapshotId, input.at]
    );
    if ((changed.rowCount ?? 0) === 0) return false;
    await client.query(
      `UPDATE empire_server_instances SET status='ended',payload=jsonb_set(payload,'{joinPolicy}','"closed"'),
       updated_at=$2::timestamptz WHERE server_instance_id=$1`,
      [input.serverInstanceId, input.at]
    );
    return true;
  }),
  writeWorkerHeartbeat: async (record, allowIncarnationTakeover = false) => {
    await database.query(
      `INSERT INTO empire_hosted_worker_heartbeats
       (id,worker_id,worker_incarnation_id,region,started_at,last_heartbeat_at,build_sha,status,updated_at)
       VALUES ($1,$2,$3,$4,$5::timestamptz,$6::timestamptz,$7,$8,$6::timestamptz)
       ON CONFLICT (worker_id) DO UPDATE SET worker_incarnation_id=EXCLUDED.worker_incarnation_id,
       region=EXCLUDED.region,started_at=EXCLUDED.started_at,last_heartbeat_at=EXCLUDED.last_heartbeat_at,
       build_sha=EXCLUDED.build_sha,status=EXCLUDED.status,updated_at=EXCLUDED.updated_at
       WHERE ($9::boolean AND empire_hosted_worker_heartbeats.started_at <= EXCLUDED.started_at)
          OR (empire_hosted_worker_heartbeats.worker_incarnation_id = EXCLUDED.worker_incarnation_id
            AND empire_hosted_worker_heartbeats.started_at = EXCLUDED.started_at
            AND empire_hosted_worker_heartbeats.last_heartbeat_at <= EXCLUDED.last_heartbeat_at)`,
      [`hosted-worker:${record.workerId}`, record.workerId, record.workerIncarnationId, record.region,
        record.startedAt, record.lastHeartbeatAt, record.buildSha, record.status, allowIncarnationTakeover]
    );
  },
  getFreshWorkerHeartbeat: async (since) => {
    const result = await database.query<WorkerRow>(
      `SELECT worker_id,worker_incarnation_id,region,started_at,last_heartbeat_at,build_sha,status FROM empire_hosted_worker_heartbeats
       WHERE status='online' AND last_heartbeat_at >= $1::timestamptz ORDER BY last_heartbeat_at DESC LIMIT 1`, [since]);
    return result.rows[0] ? mapWorker(result.rows[0]) : null;
  },
  acquireRuntimeLease: async (input) => {
    const result = await database.query(
      `UPDATE empire_hosted_server_instances SET runtime_lease_owner_id=$2,runtime_lease_incarnation_id=$3,
       runtime_lease_expires_at=$5::timestamptz,last_worker_heartbeat_at=$4::timestamptz,updated_at=$4::timestamptz
       WHERE server_instance_id=$1 AND $5::timestamptz > clock_timestamp()
         AND EXISTS (SELECT 1 FROM empire_hosted_worker_heartbeats worker
           WHERE worker.worker_id=$2 AND worker.worker_incarnation_id=$3 AND worker.status='online'
             AND worker.last_heartbeat_at > clock_timestamp() - ($6::int * interval '1 millisecond'))
         AND ((runtime_lease_owner_id=$2 AND runtime_lease_incarnation_id=$3)
           OR runtime_lease_expires_at IS NULL OR runtime_lease_expires_at <= clock_timestamp())
       RETURNING server_instance_id`, [input.serverInstanceId, input.workerId, input.workerIncarnationId,
        input.now, input.expiresAt, HOSTED_WORKER_FRESH_MS]);
    return (result.rowCount ?? 0) > 0;
  },
  isRuntimeLeaseCurrent: async (input) => {
    const result = await database.query(
      `SELECT server_instance_id FROM empire_hosted_server_instances
       WHERE server_instance_id=$1 AND runtime_lease_owner_id=$2 AND runtime_lease_incarnation_id=$3
         AND runtime_lease_expires_at > clock_timestamp()`,
      [input.serverInstanceId, input.workerId, input.workerIncarnationId]
    );
    return (result.rowCount ?? 0) === 1;
  },
  releaseRuntimeLease: async (id, workerId, workerIncarnationId, at) => {
    await database.query(`UPDATE empire_hosted_server_instances SET runtime_lease_owner_id=NULL,
      runtime_lease_incarnation_id=NULL,runtime_lease_expires_at=NULL,updated_at=$4::timestamptz
      WHERE server_instance_id=$1 AND runtime_lease_owner_id=$2 AND runtime_lease_incarnation_id=$3
        AND status <> 'running'`, [id, workerId, workerIncarnationId, at]);
  },
  writeInstanceHeartbeat: (input) => database.transaction(async (client) => {
    const current = await client.query(
      `UPDATE empire_hosted_server_instances SET last_worker_heartbeat_at=$5::timestamptz,
       runtime_lease_expires_at=$4::timestamptz,updated_at=$5::timestamptz
       WHERE server_instance_id=$1 AND runtime_lease_owner_id=$2 AND runtime_lease_incarnation_id=$3
         AND runtime_lease_expires_at > clock_timestamp() AND $4::timestamptz > clock_timestamp()
       RETURNING server_instance_id`,
      [input.serverInstanceId, input.workerId, input.workerIncarnationId, input.leaseExpiresAt, input.at]
    );
    if ((current.rowCount ?? 0) !== 1) return;
    await client.query(
      `INSERT INTO empire_hosted_instance_heartbeats
       (id,server_instance_id,worker_id,lease_expires_at,last_tick,last_snapshot_at,last_error_code,last_heartbeat_at,updated_at)
       VALUES ($1,$2,$3,$4::timestamptz,$5,$6::timestamptz,$7,$8::timestamptz,$8::timestamptz)
       ON CONFLICT (server_instance_id) DO UPDATE SET worker_id=EXCLUDED.worker_id,lease_expires_at=EXCLUDED.lease_expires_at,
       last_tick=EXCLUDED.last_tick,last_snapshot_at=EXCLUDED.last_snapshot_at,last_error_code=EXCLUDED.last_error_code,
       last_heartbeat_at=EXCLUDED.last_heartbeat_at,updated_at=EXCLUDED.updated_at`,
      [`hosted-instance-heartbeat:${input.serverInstanceId}`, input.serverInstanceId, input.workerId,
        input.leaseExpiresAt, input.lastTick, input.lastSnapshotAt, input.lastErrorCode, input.at]
    );
  })
});

const qualifyColumns = (alias: string, columns: string): string =>
  columns.split(",").map((column) => `${alias}.${column}`).join(",");
