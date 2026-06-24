import type { DistrictCapabilitiesView } from "@empire/shared-types";
import type { CoreGameState } from "../entities/game-state";
import {
  detectAlliedEncirclementAfterOccupy,
  validateMapAction,
  type MapAction,
  type MapActionBlockReason
} from "../rules";
import {
  hasValidAttackAuthorization,
  validateOccupyEmptyDistrictAuthorization
} from "../validation/spyIntel";

export const createDistrictCapabilitiesView = (
  state: CoreGameState,
  playerId: string,
  targetDistrictId: string
): DistrictCapabilitiesView => {
  const target = state.districtsById[targetDistrictId];
  const originDistrictId = findOwnedAdjacentOrigin(state, playerId, targetDistrictId);
  const reasons: DistrictCapabilitiesView["reasons"] = {};

  const canManage = Boolean(target && target.ownerPlayerId === playerId);
  const canSpy = evaluateAction(state, playerId, targetDistrictId, originDistrictId, "spy", reasons);
  const canRob = evaluateAction(state, playerId, targetDistrictId, originDistrictId, "rob", reasons);
  const canHeist = evaluateAction(state, playerId, targetDistrictId, originDistrictId, "heist", reasons);
  const canAttack = evaluateAction(state, playerId, targetDistrictId, originDistrictId, "attack", reasons);
  const canOccupy = evaluateAction(state, playerId, targetDistrictId, originDistrictId, "occupy", reasons);
  const canPlaceTrap = evaluateAction(state, playerId, targetDistrictId, undefined, "place_trap", reasons);

  return {
    canManage,
    canSpy,
    canRob,
    canHeist,
    canAttack,
    canOccupy,
    canPlaceTrap,
    canRelocateTrapHere: canManage,
    reasons
  };
};

const evaluateAction = (
  state: CoreGameState,
  playerId: string,
  targetDistrictId: string,
  originDistrictId: string | undefined,
  action: MapAction,
  reasons: DistrictCapabilitiesView["reasons"]
): boolean => {
  const result = validateMapAction(state, {
    actorPlayerId: playerId,
    targetDistrictId,
    originDistrictId,
    action
  }, {
    hasAttackAuthorization: () => hasValidAttackAuthorization(state, playerId, targetDistrictId),
    hasOccupyAuthorization: () =>
      validateOccupyEmptyDistrictAuthorization(state, playerId, targetDistrictId),
    detectConsentRequired: () =>
      detectAlliedEncirclementAfterOccupy(state, playerId, targetDistrictId)
  });

  if (!result.allowed && result.reasonCode) {
    reasons[action] = result.reasonCode;
  }

  return result.allowed;
};

const findOwnedAdjacentOrigin = (
  state: CoreGameState,
  playerId: string,
  targetDistrictId: string
): string | undefined => {
  const target = state.districtsById[targetDistrictId];
  if (!target) return undefined;

  return Object.values(state.districtsById)
    .find((district) =>
      district.ownerPlayerId === playerId
      && district.adjacentDistrictIds.includes(target.id)
      && target.adjacentDistrictIds.includes(district.id)
    )?.id;
};
