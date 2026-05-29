import type { OnboardingReadModel } from "@empire/shared-types";
import type { CoreGameState } from "../entities/game-state";
import { composeEntityId } from "../utils";
import { createDistrictAttackTargetViews } from "./district-attack-target-projection";
import { createDistrictSpyTargetViews } from "./district-spy-target-projection";
import { createEliminationReadModel } from "./elimination-read-model-projection";

const WIN_CONDITION_TEXT = "Přežít do Final Lockdownu a mít nejsilnější impérium. Území, budovy, zdroje i heat rozhodují skóre.";

/**
 * Responsibility: Safe, read-only hints for the onboarding UI.
 * Belongs here: shallow derivation from existing projections/state.
 * Does not belong here: income, heat, attack, spy, heist, or outcome rules.
 */
export const createOnboardingReadModel = (
  state: CoreGameState,
  playerId: string,
  context?: Parameters<typeof createEliminationReadModel>[2]
): OnboardingReadModel => {
  const ownedDistricts = Object.values(state.districtsById)
    .filter((district) => district.ownerPlayerId === playerId && district.status !== "destroyed")
    .sort((left, right) => state.root.districtIds.indexOf(left.id) - state.root.districtIds.indexOf(right.id));
  const firstOwnedDistrict = ownedDistricts[0] ?? null;
  const suggestedNeighborDistrictId = firstOwnedDistrict
    ? firstOwnedDistrict.adjacentDistrictIds.find((districtId) => {
        const district = state.districtsById[districtId];
        return district !== undefined && district.status !== "destroyed" && district.ownerPlayerId !== playerId;
      }) ?? null
    : null;
  const productionBuilding = ownedDistricts
    .flatMap((district) => district.buildingIds)
    .map((buildingId) => state.buildingsById[buildingId])
    .find((building) => building !== undefined
      && building.ownerPlayerId === playerId
      && building.status === "active"
      && state.resourceStatesById[composeEntityId("resource", building.id)] !== undefined
    );
  const canSpy = ownedDistricts.some((district) =>
    createDistrictSpyTargetViews(state, playerId, district.id).some((target) => target.enabled)
  );
  const canAttack = ownedDistricts.some((district) =>
    createDistrictAttackTargetViews(state, playerId, district.id).some((target) => target.enabled)
  );
  const elimination = createEliminationReadModel(state, playerId, context);
  const player = state.playersById[playerId] ?? null;

  return {
    playerId,
    playerStatus: player?.status ?? "active",
    hasOwnedDistrict: firstOwnedDistrict !== null,
    firstOwnedDistrictId: firstOwnedDistrict?.id ?? null,
    hasNeighborDistricts: suggestedNeighborDistrictId !== null,
    suggestedNeighborDistrictId,
    hasProductionBuilding: productionBuilding !== undefined,
    suggestedProductionBuildingId: productionBuilding?.id ?? null,
    canSpy,
    canRob: false,
    canAttack,
    heatAvailable: player !== null,
    dayNightAvailable: context !== undefined,
    eliminationAvailable: elimination.enabled,
    marketAvailable: false,
    allianceAvailable: Boolean(player?.allianceId) || Object.keys(state.alliancesById).length > 0,
    cityFeedAvailable: Object.keys(state.cityFeedEventsById ?? {}).length > 0,
    currentPlayerStatus: elimination.currentPlayerStatus,
    elimination: elimination.enabled
      ? {
          nextEliminationTick: elimination.nextEliminationTick,
          ticksUntilNextElimination: elimination.ticksUntilNextElimination,
          dangerZoneCount: elimination.dangerZone.length,
          activePlayersRemaining: elimination.activePlayersRemaining,
          currentPlayerStatus: elimination.currentPlayerStatus,
          eliminationsStopped: elimination.eliminationsStopped,
          isQuietHoursNow: elimination.isQuietHoursNow,
          quietHoursResumeTick: elimination.quietHoursResumeTick,
          deferredFromTick: elimination.deferredFromTick
        }
      : null,
    winConditionText: WIN_CONDITION_TEXT
  };
};
