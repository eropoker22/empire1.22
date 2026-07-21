import type { PostgresDatabase } from "../../runtime/persistence/postgres";
import {
  countHostedRegistrationBaselinePlayers,
  listHostedReadyMemberships,
  lockHostedMembershipRows
} from "../../runtime/persistence/postgres/hosted-ready-membership-query";
import type { HostedControlPlaneRepository } from "./hosted-control-plane-repository";
import { resolveFrozenHostedLifecycle } from "./hosted-lifecycle-action-completion";
import {
  insertAudit,
  mapServer,
  SERVER_SELECT,
  type HostedServerRow
} from "./postgres-hosted-control-plane-helpers";

type RegistrationMethods = Pick<HostedControlPlaneRepository,
  "listReadyMemberships" | "freezeRegistrationLifecycle">;

interface LockedServerRow extends HostedServerRow {
  runtime_lease_incarnation_id: unknown;
  authoritative_now: unknown;
}

export const createPostgresHostedRegistrationRepository = (
  database: PostgresDatabase
): RegistrationMethods => ({
  listReadyMemberships: (serverInstanceId) =>
    listHostedReadyMemberships(database, serverInstanceId),

  freezeRegistrationLifecycle: (input) => database.transaction(async (client) => {
    const locked = await client.query<LockedServerRow>(
      `${SERVER_SELECT.replace("SELECT ", "SELECT clock_timestamp() AS authoritative_now,runtime_lease_incarnation_id,")}
       WHERE server_instance_id=$1 FOR UPDATE`,
      [input.serverInstanceId]
    );
    const row = locked.rows[0];
    if (!row) return { kind: "not-found", server: null };
    const server = mapServer(row);
    const authoritativeNow = iso(row.authoritative_now);
    if (server.version !== input.expectedVersion
      || server.runtimeLeaseOwnerId !== input.workerId
      || String(row.runtime_lease_incarnation_id ?? "") !== input.workerIncarnationId
      || !server.runtimeLeaseExpiresAt
      || Date.parse(server.runtimeLeaseExpiresAt) <= Date.parse(authoritativeNow)) {
      return { kind: "conflict", server: null };
    }
    if (server.registrationClosedAt) return { kind: "already-frozen", server };
    if (!server.registrationClosesAt || Date.parse(authoritativeNow) < Date.parse(server.registrationClosesAt)) {
      return { kind: "not-due", server };
    }
    await lockHostedMembershipRows(client, server.serverInstanceId);
    const baseline = await countHostedRegistrationBaselinePlayers(
      client,
      server.serverInstanceId,
      server.registrationClosesAt
    );
    const frozen = resolveFrozenHostedLifecycle(server, server.registrationClosesAt, baseline);
    if (!frozen) return { kind: "conflict", server: null };
    const changed = await client.query<HostedServerRow>(
      `UPDATE empire_hosted_server_instances
       SET registration_closed_at=registration_closes_at,
         registration_baseline_players=$2,
         effective_final_lockdown_trigger=$3,
         effective_first_elimination_tick=$4,
         join_policy='closed',
         last_error_code=NULL,
         updated_at=$5::timestamptz,
         version=version+1
       WHERE server_instance_id=$1 AND version=$6
         AND runtime_lease_owner_id=$7
         AND runtime_lease_incarnation_id=$8
         AND runtime_lease_expires_at > clock_timestamp()
       RETURNING ${SERVER_SELECT.slice("SELECT ".length, SERVER_SELECT.indexOf(" FROM"))}`,
      [server.serverInstanceId, baseline, frozen.effectiveFinalLockdownTrigger,
        frozen.effectiveFirstEliminationTick,
        authoritativeNow, input.expectedVersion, input.workerId, input.workerIncarnationId]
    );
    if (!changed.rows[0]) return { kind: "conflict", server: null };
    await client.query(
      `UPDATE empire_server_instances
       SET payload=jsonb_set(payload,'{joinPolicy}','"closed"'),updated_at=$2::timestamptz
       WHERE server_instance_id=$1`,
      [server.serverInstanceId, authoritativeNow]
    );
    await insertAudit(client, { ...input.closedAudit, createdAt: authoritativeNow });
    await insertAudit(client, { ...input.triggerAudit, createdAt: authoritativeNow });
    return { kind: "frozen", server: mapServer(changed.rows[0]) };
  })
});

const iso = (value: unknown): string => value instanceof Date
  ? value.toISOString()
  : new Date(String(value)).toISOString();
