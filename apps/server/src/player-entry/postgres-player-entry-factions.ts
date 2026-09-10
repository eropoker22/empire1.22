import { MAX_PLAYERS_PER_FACTION, PLAYER_FACTION_IDS, type ServerMembershipView } from "@empire/shared-types";
import type { PostgresQueryable } from "../runtime/persistence/postgres";

/** Count committed selections as well as active players; the server row serializes reservations. */
export const loadFactionAvailability = async (
  database: PostgresQueryable,
  serverInstanceId: string
): Promise<NonNullable<ServerMembershipView["factionAvailability"]>> => {
  const result = await database.query<{ faction_id: string; players: number | string }>(
    `WITH occupants AS (
       SELECT player_id,faction_id FROM empire_server_memberships
       WHERE server_instance_id=$1 AND status IN ('finalizing_setup','active','leave_pending')
         AND faction_id IS NOT NULL
       UNION
       SELECT player.key,player.value->>'factionId'
       FROM empire_snapshot_latest snapshot,
         jsonb_each(COALESCE(snapshot.payload->'state'->'playersById','{}'::jsonb)) player
       WHERE snapshot.server_instance_id=$1 AND player.value->>'status'='active'
         AND NOT EXISTS (SELECT 1 FROM empire_server_memberships membership
           WHERE membership.server_instance_id=$1 AND membership.player_id=player.key)
     ) SELECT faction_id,count(DISTINCT player_id)::int AS players FROM occupants GROUP BY faction_id`,
    [serverInstanceId]
  );
  return PLAYER_FACTION_IDS.map((factionId) => {
    const players = Number(result.rows.find((row) => row.faction_id === factionId)?.players ?? 0);
    return { factionId, players, capacity: MAX_PLAYERS_PER_FACTION, available: players < MAX_PLAYERS_PER_FACTION };
  });
};
