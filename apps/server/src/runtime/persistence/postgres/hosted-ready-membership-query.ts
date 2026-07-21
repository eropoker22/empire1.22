import type { PostgresQueryable } from "./postgres-client";

export interface HostedReadyMembershipRow {
  membershipId: string;
  playerId: string;
  reservedSpawnDistrictId: string;
}

export const listHostedReadyMemberships = async (
  database: PostgresQueryable,
  serverInstanceId: string,
  options: { lockRows?: boolean } = {}
): Promise<HostedReadyMembershipRow[]> => {
  const result = await database.query<{
    membership_id: string;
    player_id: string;
    reserved_spawn_district_id: string;
  }>(
    `SELECT membership.membership_id,membership.player_id,membership.reserved_spawn_district_id
     FROM empire_server_memberships membership
     JOIN empire_accounts account ON account.account_id=membership.account_id
     JOIN empire_snapshot_latest snapshot ON snapshot.server_instance_id=membership.server_instance_id
     WHERE membership.server_instance_id=$1
       AND membership.status='active'
       AND account.status='active'
       AND membership.faction_id IS NOT NULL
       AND membership.avatar_id IS NOT NULL
       AND membership.gang_color IS NOT NULL
       AND membership.setup_completed_at IS NOT NULL
       AND membership.starter_package_applied_at IS NOT NULL
       AND membership.join_ticket_id IS NOT NULL
       AND jsonb_extract_path_text(snapshot.payload,'state','playersById',membership.player_id,'status')='active'
       AND COALESCE(jsonb_extract_path_text(snapshot.payload,'state','playersById',membership.player_id,'accountId'),'') <> ''
       AND jsonb_extract_path_text(snapshot.payload,'state','playersById',membership.player_id,'homeDistrictId')
         = membership.reserved_spawn_district_id
       AND jsonb_extract_path_text(snapshot.payload,'state','playersById',membership.player_id,'metadata','membershipId')
         = membership.membership_id
       AND jsonb_extract_path_text(snapshot.payload,'state','playersById',membership.player_id,'metadata','setupComplete')='true'
       AND jsonb_extract_path_text(snapshot.payload,'state','playersById',membership.player_id,'metadata','starterPackageApplied')='true'
       AND jsonb_extract_path_text(snapshot.payload,'state','districtsById',membership.reserved_spawn_district_id,'ownerPlayerId')
         = membership.player_id
       AND EXISTS (
         SELECT 1 FROM empire_hosted_join_reservations reservation
         WHERE reservation.membership_id=membership.membership_id
           AND reservation.server_instance_id=membership.server_instance_id
           AND reservation.status='committed'
           AND reservation.reserved_spawn_district_id=membership.reserved_spawn_district_id
       )
     ORDER BY membership.player_id${options.lockRows ? " FOR UPDATE OF membership" : ""}`,
    [serverInstanceId]
  );
  return result.rows.map((row) => ({
    membershipId: String(row.membership_id),
    playerId: String(row.player_id),
    reservedSpawnDistrictId: String(row.reserved_spawn_district_id)
  }));
};

export const lockHostedMembershipRows = async (
  database: PostgresQueryable,
  serverInstanceId: string
): Promise<void> => {
  await database.query(
    `SELECT membership_id FROM empire_server_memberships
     WHERE server_instance_id=$1 ORDER BY membership_id FOR UPDATE`,
    [serverInstanceId]
  );
};

export const countHostedRegistrationBaselinePlayers = async (
  database: PostgresQueryable,
  serverInstanceId: string,
  closesAt: string
): Promise<number> => {
  const result = await database.query<{ count: string | number }>(
    `SELECT count(*)::int AS count
     FROM empire_server_memberships membership
     WHERE membership.server_instance_id=$1
       AND membership.joined_at < $2::timestamptz
       AND membership.setup_completed_at IS NOT NULL
       AND membership.setup_completed_at <= $2::timestamptz
       AND membership.starter_package_applied_at IS NOT NULL
       AND membership.starter_package_applied_at <= $2::timestamptz
       AND EXISTS (
         SELECT 1 FROM empire_server_membership_events activated
         WHERE activated.membership_id=membership.membership_id
           AND activated.event_type='player-activated'
           AND activated.result='completed'
           AND activated.created_at <= $2::timestamptz
       )
       AND NOT EXISTS (
         SELECT 1 FROM empire_server_membership_events terminal
         WHERE terminal.membership_id=membership.membership_id
           AND terminal.event_type IN ('early-leave','defeated','server-completed')
           AND terminal.created_at <= $2::timestamptz
       )`,
    [serverInstanceId, closesAt]
  );
  return Number(result.rows[0]?.count ?? 0);
};
