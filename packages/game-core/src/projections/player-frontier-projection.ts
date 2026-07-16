import type { PlayerFrontierSummaryView } from "@empire/shared-types";
import type { CoreGameState } from "../entities/game-state";
import {
  calculatePlayerFrontier,
  resolveAllianceCorridorRoutes,
  resolveUsableConflictOriginDistricts,
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
  const origins = resolveUsableConflictOriginDistricts(state, playerId, "spy");
  const corridorRoutes = resolveAllianceCorridorRoutes(state, playerId);
  const corridorTargets = corridorRoutes.map((route) => ({
    ...route,
    routeDistrictName: state.districtsById[route.routeDistrictId]?.name ?? route.routeDistrictId,
    routeOwnerName: state.playersById[route.routeOwnerPlayerId]?.name ?? route.routeOwnerPlayerId,
    routeVersion: state.districtsById[route.routeDistrictId]?.version ?? 0,
    targetDistrictName: state.districtsById[route.targetDistrictId]?.name ?? route.targetDistrictId
  }));
  const directProgress = emptyNeighborDistrictIds.some((districtId) => canUseAction(state, playerId, districtId, "spy"))
    || enemyNeighborDistrictIds.some((districtId) => canUseAction(state, playerId, districtId, "spy"));
  const corridorProgress = corridorRoutes.some((route) => canUseCorridorSpy(state, playerId, route));

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
    explanationKey: `frontier.${frontier.state}`,
    ownedDistrictIds: origins.ownedDistrictIds,
    activeOwnedDistrictIds: origins.activeOwnedDistrictIds,
    usableOriginDistrictIds: origins.usableOriginDistrictIds,
    temporarilyBlockedOriginDistrictIds: origins.temporarilyBlockedOriginDistrictIds,
    permanentlyInvalidOriginDistrictIds: origins.permanentlyInvalidOriginDistrictIds,
    destroyedNeighborDistrictIds: frontier.destroyedDistrictIds,
    corridorTargets,
    corridorAvailable: corridorProgress,
    canProgressNow: directProgress || corridorProgress,
    canProgressLater: origins.temporarilyBlockedOriginDistrictIds.length > 0,
    nextProgressAtTick: resolveNextOriginUnlockTick(state, playerId),
    recommendedAction: directProgress || corridorProgress ? "spy" : null,
    blockingReasons: directProgress || corridorProgress ? [] : ["NO_ACTIONABLE_FRONTIER"],
    lastStandActive: Number(state.playersById[playerId]?.lastStandProtectedUntilTick ?? 0) > state.root.tick
  };
};

const canUseCorridorSpy = (
  state: CoreGameState,
  playerId: string,
  route: ReturnType<typeof resolveAllianceCorridorRoutes>[number]
): boolean => validateMapAction(state, {
  actorPlayerId: playerId,
  targetDistrictId: route.targetDistrictId,
  originDistrictId: route.sourceDistrictId,
  routeDistrictId: route.routeDistrictId,
  expectedRouteVersion: state.districtsById[route.routeDistrictId]?.version,
  action: "spy"
}).allowed;

const resolveNextOriginUnlockTick = (state: CoreGameState, playerId: string): number | null => {
  const deadlines = Object.values(state.districtsById)
    .filter((district) => district.ownerPlayerId === playerId)
    .flatMap((district) => [district.stabilizingUntilTick, district.lockdownUntilTick])
    .filter((tick): tick is number => typeof tick === "number" && tick > state.root.tick)
    .sort((left, right) => left - right);
  return deadlines[0] ?? null;
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
