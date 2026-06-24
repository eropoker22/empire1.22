import type { PlayerFrontierSummaryView } from "@empire/shared-types";
import type { CoreGameState } from "../entities/game-state";
import {
  calculatePlayerFrontier,
  validateMapAction
} from "../rules";
import {
  hasValidAttackAuthorization,
  validateOccupyEmptyDistrictAuthorization
} from "../validation/spyIntel";

export const createPlayerFrontierSummaryView = (
  state: CoreGameState,
  playerId: string
): PlayerFrontierSummaryView | null => {
  if (!state.playersById[playerId]) {
    return null;
  }

  const frontier = calculatePlayerFrontier(state, playerId);
  const emptyNeighborDistrictIds = frontier.emptyDistrictIds;
  const enemyNeighborDistrictIds = frontier.enemyDistrictIds;

  return {
    state: frontier.state,
    emptyNeighborDistrictIds,
    allyNeighborDistrictIds: frontier.allyDistrictIds,
    enemyNeighborDistrictIds,
    lockedNeighborDistrictIds: frontier.lockedDistrictIds,
    canExpand: emptyNeighborDistrictIds.length > 0,
    canSpyEmptyFrontier: emptyNeighborDistrictIds.some((districtId) =>
      canUseAction(state, playerId, districtId, "spy")
    ),
    canRobEmptyFrontier: emptyNeighborDistrictIds.some((districtId) =>
      canUseAction(state, playerId, districtId, "rob")
    ),
    canOccupyWithValidSpy: emptyNeighborDistrictIds.some((districtId) =>
      canUseAction(state, playerId, districtId, "occupy")
    ),
    canAttackNeighborEnemy: enemyNeighborDistrictIds.some((districtId) =>
      canUseAction(state, playerId, districtId, "attack")
    ),
    explanationKey: `frontier.${frontier.state}`
  };
};

const canUseAction = (
  state: CoreGameState,
  playerId: string,
  targetDistrictId: string,
  action: "spy" | "rob" | "occupy" | "attack"
): boolean => {
  const originDistrictId = findOwnedAdjacentOrigin(state, playerId, targetDistrictId);
  return validateMapAction(state, {
    actorPlayerId: playerId,
    targetDistrictId,
    originDistrictId,
    action
  }, {
    hasAttackAuthorization: () => hasValidAttackAuthorization(state, playerId, targetDistrictId),
    hasOccupyAuthorization: () =>
      validateOccupyEmptyDistrictAuthorization(state, playerId, targetDistrictId)
  }).allowed;
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
