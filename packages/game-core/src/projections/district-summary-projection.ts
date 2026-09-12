import type { DistrictSummaryView } from "@empire/shared-types";
import type { CoreGameState } from "../entities/game-state";
import { hasRevealedDistrictTypeIntel, validateOccupyEmptyDistrictAuthorization } from "../validation/spyIntel";

/**
 * Responsibility: Builds lightweight district summaries for map/list client views.
 * Belongs here: read-only server-side shaping from authoritative state.
 * Does not belong here: UI rendering or command validation.
 */
export const createDistrictSummaryViews = (
  state: CoreGameState,
  playerId: string
): DistrictSummaryView[] =>
  state.root.districtIds
    .map((districtId) => state.districtsById[districtId])
    .filter((district) => district !== undefined)
    .map((district) => {
      const owner = district.status !== "destroyed" && district.ownerPlayerId ? state.playersById[district.ownerPlayerId] : null;
      const displayName = typeof owner?.metadata?.displayName === "string" ? owner.metadata.displayName.trim() : "";
      const intelKnown = district.ownerPlayerId === playerId
        || hasRevealedDistrictTypeIntel(state, playerId, district.id);

      return {
        districtId: district.id,
        name: district.name,
        zone: district.zone,
        ownerPlayerId: district.status === "destroyed" ? null : district.ownerPlayerId,
        ownerName: owner ? displayName || owner.name : null,
        ownerColor: district.status === "destroyed" || !district.ownerPlayerId
          ? null
          : state.playersById[district.ownerPlayerId]?.color ?? null,
        isOwnedByPlayer: district.status === "destroyed" ? false : district.ownerPlayerId === playerId,
        intelKnown,
        occupyIntelValid: validateOccupyEmptyDistrictAuthorization(state, playerId, district.id) === true,
        status: district.status,
        adjacentDistrictIds: district.adjacentDistrictIds,
        heat: district.status === "destroyed" ? 0 : district.heat,
        influence: district.status === "destroyed" ? 0 : district.influence,
        stabilizingUntilTick: district.stabilizingUntilTick ?? null,
        filledSlotCount: intelKnown
          ? district.buildingIds
              .map((buildingId) => state.buildingsById[buildingId])
              .filter((building) => building !== undefined && building.status !== "destroyed").length
          : 0,
        slotCount: district.slotCount
      };
    });
