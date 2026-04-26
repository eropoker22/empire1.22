import type {
  AttackDistrictCommand,
  DistrictAttackTargetView
} from "@empire/shared-types";
import type { CoreGameState } from "../entities/game-state";
import { validateAttack } from "../validation";

/**
 * Responsibility: Builds attack target options for one selected source district.
 * Belongs here: server-side read shaping that reuses authoritative attack validation.
 * Does not belong here: client UI rendering or transport delivery.
 */
export const createDistrictAttackTargetViews = (
  state: CoreGameState,
  playerId: string,
  sourceDistrictId: string
): DistrictAttackTargetView[] => {
  const sourceDistrict = state.districtsById[sourceDistrictId];

  if (!sourceDistrict || sourceDistrict.ownerPlayerId !== playerId) {
    return [];
  }

  return sourceDistrict.adjacentDistrictIds
    .map((districtId) => state.districtsById[districtId])
    .filter((district) => district !== undefined)
    .map((targetDistrict) => {
      const previewCommand: AttackDistrictCommand = {
        id: `preview:attack:${sourceDistrict.id}:${targetDistrict.id}`,
        type: "attack-district",
        mode: state.serverInstance.mode,
        playerId,
        serverInstanceId: state.serverInstance.id,
        issuedAt: new Date(0).toISOString(),
        payload: {
          districtId: targetDistrict.id,
          sourceDistrictId: sourceDistrict.id
        },
        clientRequestId: null
      };
      const errors = validateAttack(state, previewCommand);

      return {
        districtId: targetDistrict.id,
        name: targetDistrict.name,
        ownerPlayerId: targetDistrict.ownerPlayerId,
        status: targetDistrict.status,
        enabled: errors.length === 0,
        disabledReason: errors[0]?.message ?? null
      };
    });
};
