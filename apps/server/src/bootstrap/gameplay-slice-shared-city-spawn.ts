import type { CoreGameState } from "@empire/game-core";
import type { DistrictId } from "@empire/shared-types";
import { sharedCitySpawnDistrictIds } from "./gameplay-slice-shared-city-map-constants";

export const claimNextSharedCitySpawnDistrict = (
  state: CoreGameState,
  playerId: string
): DistrictId | null => {
  const spawnDistrict = sharedCitySpawnDistrictIds
    .map((districtId) => state.districtsById[districtId])
    .find((district) => district && !district.ownerPlayerId && district.status === "neutral");

  if (!spawnDistrict) {
    return null;
  }

  spawnDistrict.ownerPlayerId = playerId;
  spawnDistrict.status = "claimed";
  for (const buildingId of spawnDistrict.buildingIds) {
    const building = state.buildingsById[buildingId];
    if (building) {
      building.ownerPlayerId = playerId;
    }
  }

  return spawnDistrict.id;
};
