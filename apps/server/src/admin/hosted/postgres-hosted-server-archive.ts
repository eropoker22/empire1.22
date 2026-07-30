import type { PostgresDatabase, PostgresQueryable } from "../../runtime/persistence/postgres";
import type { HostedControlPlaneRepository } from "./hosted-control-plane-repository";
import { insertAudit } from "./postgres-hosted-control-plane-helpers";

type ArchiveInput = Parameters<HostedControlPlaneRepository["archiveServerTransaction"]>[0];

export const archivePostgresHostedServer = (
  database: PostgresDatabase,
  input: ArchiveInput
) => database.transaction(async (client) => {
  const operation = `archive-server:${input.serverInstanceId}`;
  const existing = await client.query<{ request_hash: string; response_payload: unknown }>(
    `SELECT request_hash,response_payload FROM empire_hosted_server_idempotency
     WHERE admin_user_id=$1 AND operation=$2 AND idempotency_key=$3`,
    [input.adminUserId, operation, input.idempotencyKey]
  );
  if (existing.rows[0]) {
    if (existing.rows[0].request_hash !== input.requestHash) return { kind: "conflict" as const };
    const payload = jsonRecord(existing.rows[0].response_payload);
    const actionRequestId = String(payload?.actionRequestId ?? "");
    return actionRequestId
      ? { kind: "replayed" as const, actionRequestId }
      : { kind: "conflict" as const };
  }
  const server = await client.query<{ version: string | number; status: string }>(
    `SELECT version,status FROM empire_hosted_server_instances WHERE server_instance_id=$1 FOR UPDATE`,
    [input.serverInstanceId]
  );
  if (!server.rows[0] || server.rows[0].status === "archived") return { kind: "not-found" as const };
  if (Number(server.rows[0].version) !== input.expectedVersion) return { kind: "stale-version" as const };
  const activeOperation = await client.query(
    `SELECT action_request_id FROM empire_hosted_server_action_requests
     WHERE server_instance_id=$1 AND status IN ('requested','processing') LIMIT 1`,
    [input.serverInstanceId]
  );
  if ((activeOperation.rowCount ?? 0) > 0) return { kind: "operation-active" as const };
  const reserved = await client.query(
    `INSERT INTO empire_hosted_server_idempotency
     (id,admin_user_id,operation,idempotency_key,request_hash,resource_id,response_payload,created_at,updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::timestamptz,$8::timestamptz)
     ON CONFLICT (admin_user_id,operation,idempotency_key) DO NOTHING RETURNING id`,
    [`hosted-idempotency:${input.actionRequestId}`, input.adminUserId, operation, input.idempotencyKey,
      input.requestHash, input.actionRequestId, JSON.stringify({
        actionRequestId: input.actionRequestId,
        status: "completed"
      }), input.at]
  );
  if ((reserved.rowCount ?? 0) === 0) return { kind: "conflict" as const };

  await failPendingJobs(client, input.serverInstanceId, input.at);
  await client.query(
    `UPDATE empire_hosted_join_reservations
     SET status='canceled',canceled_at=$2::timestamptz,updated_at=$2::timestamptz,version=version+1
     WHERE server_instance_id=$1 AND status IN ('reserved','committed')`,
    [input.serverInstanceId, input.at]
  );
  await client.query(
    `UPDATE empire_gameplay_sessions
     SET revoked_at=COALESCE(revoked_at,$2::timestamptz),updated_at=$2::timestamptz,version=version+1
     WHERE server_instance_id=$1 AND revoked_at IS NULL`,
    [input.serverInstanceId, input.at]
  );
  await client.query(
    `UPDATE empire_join_tickets
     SET status='revoked',updated_at=$2::timestamptz
     WHERE server_instance_id=$1 AND consumed_at IS NULL AND expires_at > $2::timestamptz`,
    [input.serverInstanceId, input.at]
  );
  await client.query(
    `UPDATE empire_player_registrations
     SET status='revoked',updated_at=$2::timestamptz,version=version+1
     WHERE server_instance_id=$1 AND status='active'`,
    [input.serverInstanceId, input.at]
  );
  await releaseMemberships(client, input.serverInstanceId, input.at);
  await client.query(
    `UPDATE empire_hosted_server_instances
     SET status='archived',join_policy='closed',runtime_lease_owner_id=NULL,
       runtime_lease_incarnation_id=NULL,runtime_lease_expires_at=NULL,last_stopped_at=$2::timestamptz,
       last_error_code=NULL,updated_at=$2::timestamptz,version=version+1
     WHERE server_instance_id=$1 AND version=$3`,
    [input.serverInstanceId, input.at, input.expectedVersion]
  );
  await client.query(
    `UPDATE empire_server_instances
     SET status='archived',payload=jsonb_set(payload,'{joinPolicy}','"closed"'),updated_at=$2::timestamptz
     WHERE server_instance_id=$1`,
    [input.serverInstanceId, input.at]
  );
  await insertAudit(client, input.audit);
  return { kind: "created" as const, actionRequestId: input.actionRequestId };
});

const failPendingJobs = async (
  client: PostgresQueryable,
  serverInstanceId: string,
  at: string
): Promise<void> => {
  for (const table of [
    "empire_hosted_server_provisioning_jobs",
    "empire_hosted_join_jobs",
    "empire_server_membership_jobs"
  ]) {
    await client.query(
      `UPDATE ${table}
       SET status='failed',claimed_by_worker_id=NULL,claimed_by_worker_incarnation_id=NULL,claimed_until=NULL,
         last_error_code='SERVER_ARCHIVED_BY_ADMIN',updated_at=$2::timestamptz,version=version+1
       WHERE server_instance_id=$1 AND status IN ('pending','claimed')`,
      [serverInstanceId, at]
    );
  }
};

const releaseMemberships = (
  client: PostgresQueryable,
  serverInstanceId: string,
  at: string
) => client.query(
  `WITH changed AS (
     UPDATE empire_server_memberships
     SET status='server_removed',completed_at=$2::timestamptz,last_error_code='SERVER_ARCHIVED_BY_ADMIN',
       updated_at=$2::timestamptz,version=version+1
     WHERE server_instance_id=$1
       AND status IN ('setup_required','finalizing_setup','active','leave_pending','defeated')
     RETURNING membership_id,server_instance_id,account_id
   )
   INSERT INTO empire_server_membership_events
     (id,event_id,membership_id,server_instance_id,account_id,event_type,result,error_code,metadata,created_at)
   SELECT 'membership-event:'||membership_id||':server-archived',
     'membership-event:'||membership_id||':server-archived',membership_id,server_instance_id,account_id,
     'server-archived','completed','SERVER_ARCHIVED_BY_ADMIN','{}'::jsonb,$2::timestamptz
   FROM changed ON CONFLICT (event_id) DO NOTHING`,
  [serverInstanceId, at]
);

const jsonRecord = (value: unknown): Record<string, unknown> | null => {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
};
