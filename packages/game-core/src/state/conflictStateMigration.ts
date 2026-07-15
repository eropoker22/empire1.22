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
  const allianceDefenseContributionsById: CoreGameState["allianceDefenseContributionsById"] = Object.fromEntries(
    Object.entries(state.allianceDefenseContributionsById ?? {}).map(([contributionId, contribution]) => {
      const legacy = contribution as typeof contribution & { amount?: number };
      if (
        typeof contribution.originalAmount === "number"
        && typeof contribution.remainingAmount === "number"
        && typeof contribution.lostAmount === "number"
        && typeof contribution.returnedAmount === "number"
      ) {
        return [contributionId, contribution];
      }
      const amount = Math.max(0, Math.floor(Number(legacy.amount ?? 0)));
      const wasReturned = (legacy.status as string) === "returned";
      const status: typeof contribution.status = wasReturned
        ? "returned"
        : (legacy.status as string) === "destroyed"
          ? "depleted"
          : "active";
      return [contributionId, {
        ...contribution,
        originalAmount: amount,
        remainingAmount: wasReturned ? 0 : amount,
        lostAmount: (legacy.status as string) === "destroyed" ? amount : 0,
        returnedAmount: wasReturned ? amount : 0,
        status
      }];
    })
  );

  return {
    ...state,
    districtsById,
    playerSpyOperationStatesByPlayerId,
    allianceDefenseContributionsById,
    allianceDefenseCombatSnapshotsById: state.allianceDefenseCombatSnapshotsById ?? {}
  };
};

export const getDistrictSecurityRevision = (district: District): number =>
  district.securityRevision ?? district.version;

export const bumpDistrictSecurityRevision = <TDistrict extends District>(district: TDistrict): TDistrict => ({
  ...district,
  securityRevision: getDistrictSecurityRevision(district) + 1
});
