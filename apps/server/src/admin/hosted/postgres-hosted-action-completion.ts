import type { AdminAuditAction, AdminAuditEntryView } from "@empire/shared-types";
import type { PostgresDatabase, PostgresQueryable } from "../../runtime/persistence/postgres";
import {
  countHostedRegistrationBaselinePlayers,
  listHostedReadyMemberships,
  lockHostedMembershipRows
} from "../../runtime/persistence/postgres/hosted-ready-membership-query";
import type { HostedControlPlaneRepository, HostedServerRecord } from "./hosted-control-plane-repository";
import {
  resolveHostedLifecycleActionCompletion,
  type HostedLifecycleCompletionError
} from "./hosted-lifecycle-action-completion";
import {
  insertAudit,
  lockCurrentActionClaim,
  mapServer,
  SERVER_COLUMNS,
  type HostedServerRow
} from "./postgres-hosted-control-plane-helpers";

type CompletionInput = Parameters<HostedControlPlaneRepository["completeAction"]>[0];

interface LockedServerRow extends HostedServerRow {
  authoritative_now: unknown;
  runtime_lease_incarnation_id: unknown;
}

export const completePostgresHostedAction = (
  database: PostgresDatabase,
  input: CompletionInput
): Promise<boolean> => database.transaction(async (client) => {
  const locked = await client.query<LockedServerRow>(
    `SELECT clock_timestamp() AS authoritative_now,runtime_lease_incarnation_id,${SERVER_COLUMNS}
     FROM empire_hosted_server_instances WHERE server_instance_id=$1 FOR UPDATE`,
    [input.request.serverInstanceId]
  );
  const row = locked.rows[0];
  if (!row) return false;
  const authoritativeNow = iso(row.authoritative_now);
  if (!await lockCurrentActionClaim(client, { ...input, at: authoritativeNow })) return false;
  const server = mapServer(row);
  if (!hasCurrentLease(server, row, input, authoritativeNow)) return false;

  const readyMemberships = input.request.action === "start"
    ? await listHostedReadyMemberships(client, server.serverInstanceId, { lockRows: true }) : [];
  let baselinePlayers: number | undefined;
  const startNeedsFreeze = input.request.action === "start" && !server.registrationClosedAt
    && Boolean(server.registrationClosesAt)
    && Date.parse(authoritativeNow) >= Date.parse(server.registrationClosesAt!);
  if (input.request.action === "close-registration-now" || startNeedsFreeze) {
    await lockHostedMembershipRows(client, server.serverInstanceId);
    baselinePlayers = await countHostedRegistrationBaselinePlayers(
      client,
      server.serverInstanceId,
      startNeedsFreeze ? server.registrationClosesAt! : authoritativeNow
    );
  }
  const decision = resolveHostedLifecycleActionCompletion({
    server,
    request: input.request,
    authoritativeNow,
    readyPlayers: readyMemberships.length,
    registrationBaselinePlayers: baselinePlayers
  });
  if (decision.kind === "rejected") {
    await rejectClaimedAction(client, input, authoritativeNow, decision.errorCode);
    return false;
  }

  if (!await updateHostedServer(client, server, decision.server, input, authoritativeNow)) return false;
  await client.query(
    `UPDATE empire_server_instances
     SET status=$2,payload=jsonb_set(payload,'{joinPolicy}',to_jsonb($3::text)),updated_at=$4::timestamptz
     WHERE server_instance_id=$1`,
    [server.serverInstanceId, decision.server.status, decision.server.joinPolicy, authoritativeNow]
  );
  await client.query(
    `UPDATE empire_hosted_server_action_requests
     SET status='completed',claimed_until=NULL,last_error_code=NULL,updated_at=$2::timestamptz,version=version+1
     WHERE action_request_id=$1`,
    [input.request.actionRequestId, authoritativeNow]
  );
  await insertCompletionAudits(client, input.audit, decision.auditActions, authoritativeNow);
  return true;
});

const updateHostedServer = async (
  client: PostgresQueryable,
  previous: HostedServerRecord,
  next: HostedServerRecord,
  input: CompletionInput,
  now: string
): Promise<boolean> => {
  const result = await client.query(
    `UPDATE empire_hosted_server_instances SET
       status=$2,join_policy=$3,registration_schedule_version=$4,
       registration_opens_at=$5::timestamptz,registration_closes_at=$6::timestamptz,
       registration_closed_at=$7::timestamptz,registration_baseline_players=$8,
       effective_final_lockdown_trigger=$9,effective_first_elimination_tick=$10,
       last_started_at=$11::timestamptz,last_paused_at=$12::timestamptz,last_stopped_at=$13::timestamptz,
       last_error_code=$14,updated_at=$15::timestamptz,version=version+1
     WHERE server_instance_id=$1 AND version=$16 AND runtime_lease_owner_id=$17
       AND runtime_lease_incarnation_id=$18 AND runtime_lease_expires_at > clock_timestamp()
     RETURNING server_instance_id`,
    [previous.serverInstanceId, next.status, next.joinPolicy, next.registrationScheduleVersion,
      next.registrationOpensAt, next.registrationClosesAt, next.registrationClosedAt,
      next.registrationBaselinePlayers, next.effectiveFinalLockdownTrigger, next.effectiveFirstEliminationTick,
      next.lastStartedAt, next.lastPausedAt, next.lastStoppedAt, next.lastErrorCode, now,
      input.request.expectedVersion, input.request.claimedByWorkerId, input.workerIncarnationId]
  );
  return (result.rowCount ?? 0) > 0;
};

const rejectClaimedAction = async (
  client: PostgresQueryable,
  input: CompletionInput,
  now: string,
  errorCode: HostedLifecycleCompletionError
): Promise<void> => {
  await client.query(
    `UPDATE empire_hosted_server_action_requests
     SET status='failed',claimed_until=NULL,last_error_code=$2,updated_at=$3::timestamptz,version=version+1
     WHERE action_request_id=$1`,
    [input.request.actionRequestId, errorCode, now]
  );
  await client.query(
    `UPDATE empire_hosted_server_instances SET last_error_code=$2,updated_at=$3::timestamptz
     WHERE server_instance_id=$1`,
    [input.request.serverInstanceId, errorCode, now]
  );
  const action: AdminAuditAction = errorCode === "SERVER_START_MINIMUM_PLAYERS_NOT_MET"
    ? "server-start-rejected-minimum-players" : "lifecycle-failure";
  await insertAudit(client, { ...input.audit, action, result: "failure", createdAt: now });
};

const insertCompletionAudits = async (
  client: PostgresQueryable,
  audit: AdminAuditEntryView,
  actions: AdminAuditAction[],
  now: string
): Promise<void> => {
  const resolved = actions.length ? actions : [audit.action];
  for (const [index, action] of resolved.entries()) {
    await insertAudit(client, {
      ...audit,
      id: resolved.length === 1 ? audit.id : `${audit.id}:${index + 1}`,
      action,
      createdAt: now
    });
  }
};

const hasCurrentLease = (
  server: HostedServerRecord,
  row: LockedServerRow,
  input: CompletionInput,
  now: string
): boolean => Boolean(input.request.claimedByWorkerId
  && server.version === input.request.expectedVersion
  && server.runtimeLeaseOwnerId === input.request.claimedByWorkerId
  && String(row.runtime_lease_incarnation_id ?? "") === input.workerIncarnationId
  && server.runtimeLeaseExpiresAt
  && Date.parse(server.runtimeLeaseExpiresAt) > Date.parse(now));

const iso = (value: unknown): string => value instanceof Date
  ? value.toISOString()
  : new Date(String(value)).toISOString();
