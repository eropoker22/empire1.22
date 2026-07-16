import type { CoreGameState } from "../../entities";
import { arePlayersActiveAllies } from "./mapRelations";

export type PlayerFrontierState =
  | "open"
  | "allied_encircled"
  | "hostile_encircled"
  | "mixed_encircled"
  | "no_frontier";

export interface PlayerFrontierSummary {
  state: PlayerFrontierState;
  emptyDistrictIds: string[];
  allyDistrictIds: string[];
  enemyDistrictIds: string[];
  lockedDistrictIds: string[];
  destroyedDistrictIds: string[];
}

export interface AllianceCorridorRoute {
  sourceDistrictId: string;
  routeDistrictId: string;
  routeOwnerPlayerId: string;
  targetDistrictId: string;
  targetRelation: "empty" | "enemy";
}

export const calculatePlayerFrontier = (
  state: CoreGameState,
  playerId: string
): PlayerFrontierSummary => {
  const player = state.playersById[playerId];

  if (!player) {
    return emptyFrontier("no_frontier");
  }

  const ownedDistricts = Object.values(state.districtsById).filter(
    (district) => district.ownerPlayerId === playerId
      && district.status !== "destroyed"
      && district.status !== "locked"
      && !((district.lockdownUntilTick ?? 0) > state.root.tick)
  );
  const frontierIds = new Set<string>();

  for (const district of ownedDistricts) {
    for (const adjacentDistrictId of district.adjacentDistrictIds) {
      const adjacent = state.districtsById[adjacentDistrictId];
      if (adjacent && adjacent.ownerPlayerId !== playerId) {
        frontierIds.add(adjacent.id);
      }
    }
  }

  const summary = emptyFrontier("no_frontier");

  for (const districtId of frontierIds) {
    const district = state.districtsById[districtId];
    if (!district || district.status === "locked") {
      summary.lockedDistrictIds.push(districtId);
    } else if (district.status === "destroyed") {
      summary.destroyedDistrictIds.push(districtId);
    } else if (!district.ownerPlayerId) {
      summary.emptyDistrictIds.push(district.id);
    } else {
      const owner = state.playersById[district.ownerPlayerId];
      if (owner && arePlayersActiveAllies(state, player, owner)) {
        summary.allyDistrictIds.push(district.id);
      } else {
        summary.enemyDistrictIds.push(district.id);
      }
    }
  }

  if (summary.emptyDistrictIds.length > 0) {
    summary.state = "open";
  } else if (summary.allyDistrictIds.length > 0 && summary.enemyDistrictIds.length > 0) {
    summary.state = "mixed_encircled";
  } else if (summary.allyDistrictIds.length > 0) {
    summary.state = "allied_encircled";
  } else if (summary.enemyDistrictIds.length > 0) {
    summary.state = "hostile_encircled";
  }

  return summary;
};

export const resolveAllianceCorridorRoutes = (
  state: CoreGameState,
  playerId: string
): AllianceCorridorRoute[] => {
  const player = state.playersById[playerId];
  const frontier = calculatePlayerFrontier(state, playerId);
  if (!player || (frontier.state !== "allied_encircled" && frontier.state !== "mixed_encircled")) return [];
  const routes: AllianceCorridorRoute[] = [];
  const seen = new Set<string>();
  const sources = Object.values(state.districtsById)
    .filter((district) => district.ownerPlayerId === playerId && district.status !== "destroyed" && district.status !== "locked")
    .sort((left, right) => left.id.localeCompare(right.id));
  for (const source of sources) {
    for (const routeId of source.adjacentDistrictIds) {
      const route = state.districtsById[routeId];
      const routeOwner = route?.ownerPlayerId ? state.playersById[route.ownerPlayerId] : null;
      if (!route || !routeOwner || route.status === "destroyed" || route.status === "locked"
        || (route.stabilizingUntilTick ?? 0) > state.root.tick
        || !arePlayersActiveAllies(state, player, routeOwner)) continue;
      for (const targetId of route.adjacentDistrictIds) {
        const target = state.districtsById[targetId];
        if (!target || target.ownerPlayerId === playerId || target.status === "destroyed" || target.status === "locked") continue;
        if (source.adjacentDistrictIds.includes(target.id) && target.adjacentDistrictIds.includes(source.id)) continue;
        const targetOwner = target.ownerPlayerId ? state.playersById[target.ownerPlayerId] : null;
        if (targetOwner && arePlayersActiveAllies(state, player, targetOwner)) continue;
        const key = `${source.id}:${route.id}:${target.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const targetRelation = target.ownerPlayerId ? "enemy" : "empty";
        if (frontier.state === "mixed_encircled" && targetRelation === "enemy" && frontier.enemyDistrictIds.length > 0) continue;
        routes.push({
          sourceDistrictId: source.id,
          routeDistrictId: route.id,
          routeOwnerPlayerId: routeOwner.id,
          targetDistrictId: target.id,
          targetRelation
        });
      }
    }
  }
  return routes;
};

export const detectAlliedEncirclementAfterOccupy = (
  state: CoreGameState,
  occupyingPlayerId: string,
  targetDistrictId: string
): { requiresConsent: boolean; affectedPlayerIds: string[] } => {
  const actor = state.playersById[occupyingPlayerId];
  const target = state.districtsById[targetDistrictId];

  if (!actor || !target || target.ownerPlayerId) {
    return { requiresConsent: false, affectedPlayerIds: [] };
  }

  const alliedPlayerIds = Object.values(state.playersById)
    .filter((player) => player.id !== actor.id && arePlayersActiveAllies(state, actor, player))
    .map((player) => player.id);
  const affectedPlayerIds = alliedPlayerIds.filter((playerId) => {
    const before = calculatePlayerFrontier(state, playerId);
    if (before.state !== "open") {
      return false;
    }

    const simulatedState: CoreGameState = {
      ...state,
      districtsById: {
        ...state.districtsById,
        [target.id]: {
          ...target,
          ownerPlayerId: occupyingPlayerId,
          status: "claimed",
          version: target.version + 1
        }
      }
    };
    const after = calculatePlayerFrontier(simulatedState, playerId);
    return after.state === "allied_encircled";
  });

  return {
    requiresConsent: affectedPlayerIds.length > 0,
    affectedPlayerIds
  };
};

const emptyFrontier = (state: PlayerFrontierState): PlayerFrontierSummary => ({
  state,
  emptyDistrictIds: [],
  allyDistrictIds: [],
  enemyDistrictIds: [],
  lockedDistrictIds: [],
  destroyedDistrictIds: []
});
