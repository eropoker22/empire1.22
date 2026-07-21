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
  version: unknown;
}

export const HOSTED_PLAYER_ENTRY_SERVER_COLUMNS = `server_instance_id,display_name,mode,region,status,join_policy,
  provisioning_state,capacity,last_started_at,last_worker_heartbeat_at,runtime_lease_expires_at,current_snapshot_id,
  minimum_ready_players_to_start,registration_window_minutes,registration_opens_at,registration_closes_at,
  registration_closed_at,version`;

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
