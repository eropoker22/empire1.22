import type { SpawnMapDistrictView } from "@empire/shared-types";
import { findSharedCitySpawnCandidate } from "../bootstrap/gameplay-slice-shared-city-seed";
import type { PostgresQueryable } from "../runtime/persistence/postgres";

export interface SnapshotDistrict {
  id: unknown;
  name?: unknown;
  zone?: unknown;
  status?: unknown;
  ownerPlayerId?: unknown;
  lockdownUntilTick?: unknown;
  operationLocks?: { occupy?: unknown };
  buildingIds?: unknown[];
  adjacentDistrictIds?: unknown[];
  version?: unknown;
}

export interface SnapshotPlayer {
  id?: unknown;
  name?: unknown;
  color?: unknown;
  metadata?: Record<string, unknown>;
}

export interface SpawnOwnerIdentity {
  displayName: string;
  gangName: string;
  gangColor: string | null;
}

interface SpawnOwnerIdentityRow extends Record<string, unknown> {
  player_id: unknown;
  display_name: unknown;
  gang_name: unknown;
  gang_color: unknown;
}

export const createSpawnMapDistrictViews = (
  districtsById: Record<string, SnapshotDistrict>,
  playersById: Record<string, SnapshotPlayer>,
  ownerIdentities: ReadonlyMap<string, SpawnOwnerIdentity>,
  reservedIds: ReadonlySet<string>,
  occupiedInProgressIds: ReadonlySet<string> = new Set()
): SpawnMapDistrictView[] => Object.values(districtsById)
  .filter((district): district is SnapshotDistrict => Boolean(district?.id))
  .map((district) => {
    const districtId = String(district.id);
    const ownerPlayerId = optionalString(district.ownerPlayerId);
    const runtimePlayer = ownerPlayerId ? playersById[ownerPlayerId] : undefined;
    const identity = ownerPlayerId ? ownerIdentities.get(ownerPlayerId) : undefined;
    return {
      districtId,
      zone: String(district.zone ?? "residential"),
      label: String(district.name || districtId),
      status: occupiedInProgressIds.has(districtId) ? "occupying" : String(district.status ?? "neutral"),
      owner: ownerPlayerId ? {
        playerId: ownerPlayerId,
        displayName: identity?.displayName ?? optionalString(runtimePlayer?.name) ?? "Hráč",
        gangName: identity?.gangName ?? optionalString(runtimePlayer?.metadata?.gangName) ?? "Obsazený district",
        color: normalizeGangColor(identity?.gangColor ?? runtimePlayer?.color)
      } : null,
      reserved: reservedIds.has(districtId),
      spawnEligible: Boolean(findSharedCitySpawnCandidate(districtId)?.enabled),
      version: Number(district.version ?? 1)
    };
  })
  .sort((left, right) => districtSortValue(left.districtId) - districtSortValue(right.districtId)
    || left.districtId.localeCompare(right.districtId));

export const loadSpawnOwnerIdentities = async (
  database: PostgresQueryable,
  serverInstanceId: string,
  playerIds: string[]
): Promise<Map<string, SpawnOwnerIdentity>> => {
  if (playerIds.length === 0) return new Map();
  const result = await database.query<SpawnOwnerIdentityRow>(
    `SELECT membership.player_id,account.display_name,account.gang_name,membership.gang_color
     FROM empire_server_memberships membership
     JOIN empire_accounts account ON account.account_id=membership.account_id
     WHERE membership.server_instance_id=$1 AND membership.player_id=ANY($2::text[])`,
    [serverInstanceId, playerIds]
  );
  return new Map(result.rows.map((row) => [String(row.player_id), {
    displayName: String(row.display_name),
    gangName: String(row.gang_name),
    gangColor: optionalString(row.gang_color)
  }]));
};

export const optionalString = (value: unknown): string | null => {
  const normalized = value == null ? "" : String(value).trim();
  return normalized || null;
};

const normalizeGangColor = (value: unknown): string => {
  const color = optionalString(value);
  return color && /^#[0-9a-f]{6}$/iu.test(color) ? color : "#ef4444";
};

const districtSortValue = (districtId: string): number => {
  const parsed = Number.parseInt(districtId.replace(/^district:/u, ""), 10);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
};
