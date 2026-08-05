import type { PostgresQueryable } from "../runtime/persistence/postgres";

export const PLAYER_ENTRY_BLOCKING_STATUSES = [
  "setup_required",
  "finalizing_setup",
  "active",
  "leave_pending",
  "defeated"
] as const;

export interface HostedPlayerEntryServerRow extends Record<string, unknown> {
  server_instance_id: unknown;
  display_name: unknown;
  mode: unknown;
  region: unknown;
  status: unknown;
  join_policy: unknown;
  provisioning_state: unknown;
  capacity: unknown;
  last_started_at: unknown;
  last_worker_heartbeat_at: unknown;
  runtime_lease_expires_at: unknown;
  current_snapshot_id: unknown;
  minimum_ready_players_to_start: unknown;
  registration_window_minutes: unknown;
  registration_opens_at: unknown;
  registration_closes_at: unknown;
  registration_closed_at: unknown;
  starting_player_state: unknown;
  version: unknown;
}

export const HOSTED_PLAYER_ENTRY_SERVER_COLUMNS = `server_instance_id,display_name,mode,region,status,join_policy,
  provisioning_state,capacity,last_started_at,last_worker_heartbeat_at,runtime_lease_expires_at,current_snapshot_id,
  minimum_ready_players_to_start,registration_window_minutes,registration_opens_at,registration_closes_at,
  registration_closed_at,starting_player_state,version`;

export const readAuthoritativePostgresNow = async (
  database: PostgresQueryable,
  injectedNow?: Date
): Promise<Date> => {
  if (injectedNow) return new Date(injectedNow.getTime());
  const result = await database.query<{ authoritative_now: Date | string }>(
    "SELECT clock_timestamp() AS authoritative_now"
  );
  return new Date(result.rows[0]!.authoritative_now);
};

export const loadOnlinePlayerCount = async (
  database: PostgresQueryable,
  now: Date,
  presenceWindowMs: number
): Promise<number> => {
  const presentSince = new Date(now.getTime() - presenceWindowMs).toISOString();
  const result = await database.query<{ online_players: string | number }>(
    `SELECT count(*)::int AS online_players FROM (
       SELECT account_id FROM empire_account_sessions
       WHERE revoked_at IS NULL AND expires_at > $1::timestamptz AND last_seen_at >= $2::timestamptz
       UNION
       SELECT account_id FROM empire_gameplay_sessions
       WHERE revoked_at IS NULL AND expires_at > $1::timestamptz AND last_seen_at >= $2::timestamptz
     ) online_accounts`,
    [now.toISOString(), presentSince]
  );
  return Math.max(0, Number(result.rows[0]?.online_players ?? 0));
};

export const getHostedOccupancy = async (
  database: PostgresQueryable,
  serverInstanceId: string,
  at: string
) => {
  const result = await database.query<{ committed_players: string | number; reserved_slots: string | number }>(
    `SELECT
      (SELECT count(*) FROM (
        SELECT account_id AS identity FROM empire_server_memberships WHERE server_instance_id=$1 AND status=ANY($3::text[])
        UNION
        SELECT account_id AS identity FROM empire_player_registrations WHERE server_instance_id=$1 AND status='active' AND account_id IS NOT NULL
      ) occupied) AS committed_players,
      (SELECT count(*) FROM empire_hosted_join_reservations
       WHERE server_instance_id=$1 AND status='reserved' AND expires_at > $2::timestamptz) AS reserved_slots`,
    [serverInstanceId, at, PLAYER_ENTRY_BLOCKING_STATUSES]
  );
  return {
    committedPlayers: Number(result.rows[0]?.committed_players ?? 0),
    reservedSlots: Number(result.rows[0]?.reserved_slots ?? 0)
  };
};

export interface HostedServerPopulationStats {
  serverInstanceId: string;
  committedPlayers: number;
  reservedSlots: number;
  readyPlayers: number;
}

export const loadHostedServerPopulationStats = async (
  database: PostgresQueryable,
  serverInstanceIds: string[],
  at: string
): Promise<HostedServerPopulationStats[]> => {
  if (serverInstanceIds.length === 0) return [];
  const result = await database.query<HostedServerPopulationStatsRow>(
    `WITH requested AS (
       SELECT unnest($1::text[]) AS server_instance_id
     ), occupied_identities AS (
       SELECT membership.server_instance_id,membership.account_id AS identity
       FROM empire_server_memberships membership
       WHERE membership.server_instance_id=ANY($1::text[])
         AND membership.status=ANY($3::text[])
       UNION
       SELECT registration.server_instance_id,registration.account_id AS identity
       FROM empire_player_registrations registration
       WHERE registration.server_instance_id=ANY($1::text[])
         AND registration.status='active'
         AND registration.account_id IS NOT NULL
     ), committed AS (
       SELECT server_instance_id,count(*)::int AS committed_players
       FROM occupied_identities GROUP BY server_instance_id
     ), reserved AS (
       SELECT server_instance_id,count(*)::int AS reserved_slots
       FROM empire_hosted_join_reservations
       WHERE server_instance_id=ANY($1::text[])
         AND status='reserved'
         AND expires_at > $2::timestamptz
       GROUP BY server_instance_id
     ), ready AS (
       SELECT membership.server_instance_id,count(*)::int AS ready_players
       FROM empire_server_memberships membership
       JOIN empire_accounts account
         ON account.account_id=membership.account_id
       WHERE membership.server_instance_id=ANY($1::text[])
         AND membership.status='active'
         AND account.status='active'
         AND membership.faction_id IS NOT NULL
         AND membership.avatar_id IS NOT NULL
         AND membership.gang_color IS NOT NULL
         AND membership.setup_completed_at IS NOT NULL
         AND membership.starter_package_applied_at IS NOT NULL
         AND membership.join_ticket_id IS NOT NULL
         AND EXISTS (
           SELECT 1
           FROM empire_hosted_join_reservations reservation
           WHERE reservation.membership_id=membership.membership_id
             AND reservation.server_instance_id=membership.server_instance_id
             AND reservation.status='committed'
             AND reservation.reserved_spawn_district_id
               = membership.reserved_spawn_district_id
         )
       GROUP BY membership.server_instance_id
     )
     SELECT requested.server_instance_id,
       COALESCE(committed.committed_players,0)::int AS committed_players,
       COALESCE(reserved.reserved_slots,0)::int AS reserved_slots,
       COALESCE(ready.ready_players,0)::int AS ready_players
     FROM requested
     LEFT JOIN committed USING (server_instance_id)
     LEFT JOIN reserved USING (server_instance_id)
     LEFT JOIN ready USING (server_instance_id)
     ORDER BY requested.server_instance_id`,
    [serverInstanceIds, at, PLAYER_ENTRY_BLOCKING_STATUSES]
  );
  return result.rows.map((row) => ({
    serverInstanceId: String(row.server_instance_id),
    committedPlayers: Number(row.committed_players),
    reservedSlots: Number(row.reserved_slots),
    readyPlayers: Number(row.ready_players)
  }));
};

interface HostedServerPopulationStatsRow extends Record<string, unknown> {
  server_instance_id: unknown;
  committed_players: unknown;
  reserved_slots: unknown;
  ready_players: unknown;
}
