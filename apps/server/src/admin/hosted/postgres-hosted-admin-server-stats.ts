import type { PostgresQueryable } from "../../runtime/persistence/postgres";
import { PLAYER_ENTRY_BLOCKING_STATUSES } from "../../player-entry/postgres-player-entry-server-query";
import type { HostedAdminServerStats } from "./hosted-control-plane-repository";

export const loadPostgresHostedAdminServerStats = async (
  database: PostgresQueryable,
  serverInstanceIds: string[],
  at: string
): Promise<HostedAdminServerStats[]> => {
  if (serverInstanceIds.length === 0) return [];
  const result = await database.query<AdminServerStatsRow>(
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
       JOIN empire_accounts account ON account.account_id=membership.account_id
       JOIN empire_snapshot_latest snapshot
         ON snapshot.server_instance_id=membership.server_instance_id
       WHERE membership.server_instance_id=ANY($1::text[])
         AND membership.status='active'
         AND account.status='active'
         AND membership.faction_id IS NOT NULL
         AND membership.avatar_id IS NOT NULL
         AND membership.gang_color IS NOT NULL
         AND membership.setup_completed_at IS NOT NULL
         AND membership.starter_package_applied_at IS NOT NULL
         AND membership.join_ticket_id IS NOT NULL
         AND jsonb_extract_path_text(
           snapshot.payload,'state','playersById',membership.player_id,'status'
         )='active'
         AND COALESCE(jsonb_extract_path_text(
           snapshot.payload,'state','playersById',membership.player_id,'accountId'
         ),'') <> ''
         AND jsonb_extract_path_text(
           snapshot.payload,'state','playersById',membership.player_id,'homeDistrictId'
         )=membership.reserved_spawn_district_id
         AND jsonb_extract_path_text(
           snapshot.payload,'state','playersById',membership.player_id,'metadata','membershipId'
         )=membership.membership_id
         AND jsonb_extract_path_text(
           snapshot.payload,'state','playersById',membership.player_id,'metadata','setupComplete'
         )='true'
         AND jsonb_extract_path_text(
           snapshot.payload,'state','playersById',membership.player_id,'metadata','starterPackageApplied'
         )='true'
         AND jsonb_extract_path_text(
           snapshot.payload,'state','districtsById',
           membership.reserved_spawn_district_id,'ownerPlayerId'
         )=membership.player_id
         AND EXISTS (
           SELECT 1 FROM empire_hosted_join_reservations reservation
           WHERE reservation.membership_id=membership.membership_id
             AND reservation.server_instance_id=membership.server_instance_id
             AND reservation.status='committed'
             AND reservation.reserved_spawn_district_id=
               membership.reserved_spawn_district_id
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

interface AdminServerStatsRow extends Record<string, unknown> {
  server_instance_id: unknown;
  committed_players: unknown;
  reserved_slots: unknown;
  ready_players: unknown;
}
