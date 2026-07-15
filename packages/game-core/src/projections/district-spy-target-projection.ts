import type {
  DistrictSpyTargetView,
  SpyDistrictCommand
} from "@empire/shared-types";
import type { CoreGameState } from "../entities/game-state";
import type { ConflictBalanceConfig } from "../contracts";
import { getPlayerSpyOperationState, validateSpy } from "../validation";

/**
 * Responsibility: Builds spy target options for one selected source district.
 * Belongs here: server-side read shaping that reuses authoritative spy validation.
 * Does not belong here: client rendering or result prediction.
 */
export const createDistrictSpyTargetViews = (
  state: CoreGameState,
  playerId: string,
  sourceDistrictId: string,
  issuedAt = new Date().toISOString(),
  conflictConfig?: ConflictBalanceConfig
): DistrictSpyTargetView[] => {
  const sourceDistrict = state.districtsById[sourceDistrictId];

  if (!sourceDistrict || sourceDistrict.ownerPlayerId !== playerId) {
    return [];
  }

  return sourceDistrict.adjacentDistrictIds
    .map((districtId) => state.districtsById[districtId])
    .filter((district) => district !== undefined)
    .map((targetDistrict) => {
      const previewCommand: SpyDistrictCommand = {
        id: `preview:spy:${sourceDistrict.id}:${targetDistrict.id}`,
        type: "spy-district",
        mode: state.serverInstance.mode,
        playerId,
        serverInstanceId: state.serverInstance.id,
        issuedAt,
        payload: {
          districtId: targetDistrict.id,
          sourceDistrictId: sourceDistrict.id
        },
        clientRequestId: null
      };
      const errors = validateSpy(state, previewCommand);
      const operationState = getPlayerSpyOperationState(state, playerId);

      return {
        districtId: targetDistrict.id,
        name: targetDistrict.name,
        ownerPlayerId: targetDistrict.ownerPlayerId,
        status: targetDistrict.status,
        enabled: errors.length === 0,
        disabledReason: errors[0]?.message ?? null,
        targetSecurityRevision: targetDistrict.securityRevision,
        authorizationTtlTicks: Math.max(0, Number(conflictConfig?.spyAuthorizationTtlTicks ?? 0)),
        slots: operationState.slots.map((slot) => ({
          slotId: slot.slotId,
          availableAtTick: slot.availableAtTick,
          available: slot.availableAtTick <= state.root.tick,
          lastMissionId: slot.lastMissionId
        }))
      };
    });
};
