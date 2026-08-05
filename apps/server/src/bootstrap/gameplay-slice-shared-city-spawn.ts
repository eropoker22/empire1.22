import {
  createFreshSpawnBuildingMetadata,
  resolvePlayerStartingDistrictInfluence,
  type CoreGameState
} from "@empire/game-core";
import type { DistrictId } from "@empire/shared-types";
import {
  enabledSharedCitySpawnDistrictIds,
  findSharedCitySpawnCandidate
} from "./gameplay-slice-spawn-pool";

export const claimNextSharedCitySpawnDistrict = (
  state: CoreGameState,
  playerId: string,
  requestedDistrictId?: string | null
): DistrictId | null => {
  const existingOwnedSpawn = enabledSharedCitySpawnDistrictIds
    .map((districtId) => state.districtsById[districtId])
    .find((district) => district?.ownerPlayerId === playerId);

  if (existingOwnedSpawn) {
    return existingOwnedSpawn.id;
  }

  const candidateIds = requestedDistrictId && findSharedCitySpawnCandidate(requestedDistrictId)?.enabled
    ? [requestedDistrictId]
    : enabledSharedCitySpawnDistrictIds;

  const spawnDistrict = candidateIds
    .map((districtId) => state.districtsById[districtId])
    .find((district) =>
      district
      && !district.ownerPlayerId
      && district.status === "neutral"
      && district.zone !== "downtown"
    );

  if (!spawnDistrict) {
    return null;
  }

  spawnDistrict.ownerPlayerId = playerId;
  spawnDistrict.status = "claimed";
  spawnDistrict.influence = resolvePlayerStartingDistrictInfluence(state.playersById[playerId]);
  for (const buildingId of spawnDistrict.buildingIds) {
    const building = state.buildingsById[buildingId];
    if (building) {
      building.ownerPlayerId = playerId;
      building.metadata = createFreshSpawnBuildingMetadata(building, state.root.tick);
    }
  }

  return spawnDistrict.id;
};
