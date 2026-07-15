import type { District, PlayerSpyOperationState } from "@empire/shared-types";
import type { CoreGameState } from "../entities";

export const createPlayerSpyOperationState = (playerId: string): PlayerSpyOperationState => ({
  playerId,
  version: 1,
  slots: [
    { slotId: "spy-1", availableAtTick: 0, lastMissionId: null },
    { slotId: "spy-2", availableAtTick: 0, lastMissionId: null }
  ]
});

export const migrateConflictState = (state: CoreGameState): CoreGameState => {
  const districtsById = Object.fromEntries(Object.entries(state.districtsById).map(([districtId, district]) => [
    districtId,
    typeof district.securityRevision === "number"
      ? district
      : { ...district, securityRevision: district.version }
  ]));
  const existingSpyStates = state.playerSpyOperationStatesByPlayerId ?? {};
  const playerSpyOperationStatesByPlayerId = Object.fromEntries(
    Object.keys(state.playersById).map((playerId) => [
      playerId,
      existingSpyStates[playerId] ?? createPlayerSpyOperationState(playerId)
    ])
  );

  return { ...state, districtsById, playerSpyOperationStatesByPlayerId };
};

export const getDistrictSecurityRevision = (district: District): number =>
  district.securityRevision ?? district.version;

export const bumpDistrictSecurityRevision = <TDistrict extends District>(district: TDistrict): TDistrict => ({
  ...district,
  securityRevision: getDistrictSecurityRevision(district) + 1
});
