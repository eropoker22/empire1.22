import { PRODUCTION_GAME_LIFECYCLE_PHASES, type District, type Player } from "@empire/shared-types";
import type { CoreGameState } from "../../entities";
import type { DistrictRelation } from "./mapActionTypes";

export const areDistrictsAdjacent = (
  state: CoreGameState,
  districtId: string,
  neighborId: string
): boolean => {
  const district = state.districtsById[districtId];
  const neighbor = state.districtsById[neighborId];

  if (!district || !neighbor || district.id === neighbor.id) {
    return false;
  }

  return district.adjacentDistrictIds.includes(neighbor.id)
    && neighbor.adjacentDistrictIds.includes(district.id);
};

export const resolveDistrictRelation = (
  state: CoreGameState,
  actor: Player,
  target: District
): DistrictRelation => {
  if (target.status === "destroyed" || target.status === "locked") {
    return "blocked";
  }

  if (!target.ownerPlayerId) {
    return "empty";
  }

  if (target.ownerPlayerId === actor.id) {
    return "self";
  }

  const owner = state.playersById[target.ownerPlayerId];
  return owner && arePlayersActiveAllies(state, actor, owner) ? "ally" : "enemy";
};

export const isTargetAdjacentToOwnedDistrict = (
  state: CoreGameState,
  playerId: string,
  targetDistrictId: string
): boolean =>
  Object.values(state.districtsById).some((district) =>
    district.ownerPlayerId === playerId
    && areDistrictsAdjacent(state, district.id, targetDistrictId)
  );

export const arePlayersActiveAllies = (
  state: CoreGameState,
  left: Player,
  right: Player
): boolean => {
  if (!left.allianceId || left.allianceId !== right.allianceId) {
    return false;
  }

  const alliance = state.alliancesById[left.allianceId];
  return Boolean(
    alliance
    && alliance.status === "active"
    && alliance.memberIds.includes(left.id)
    && alliance.memberIds.includes(right.id)
  );
};

export const isDistrictLocked = (district: District): boolean =>
  district.status === "destroyed"
  || district.status === "locked"
  || Boolean(district.lockdownUntilTick);

export const isDowntownDistrict = (district: District): boolean =>
  String(district.zone || "").trim().toLowerCase() === "downtown";

export const isFinalLockdownActive = (state: CoreGameState): boolean =>
  state.root.phase === PRODUCTION_GAME_LIFECYCLE_PHASES.finalLockdown
  || state.finalLockdownState?.status === "active"
  || state.finalLockdownState?.status === "paused";

export const isDowntownOccupationLocked = (state: CoreGameState, district: District): boolean =>
  isDowntownDistrict(district) && !isFinalLockdownActive(state);
