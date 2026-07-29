import type { GameplaySliceView } from "@empire/shared-types";

export const canUseOwnedDistrictBuilding = (
  slice: GameplaySliceView | null,
  buildingId: string
): boolean => {
  const district = slice?.district;
  if (!district) return false;

  const ownsDistrict = district.isOwnedByPlayer
    || district.ownerPlayerId === slice.player.playerId;
  return ownsDistrict
    && district.buildings.some((building) => building.buildingId === buildingId);
};
