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
    if (!district || district.status === "destroyed" || district.status === "locked") {
      summary.lockedDistrictIds.push(districtId);
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
  lockedDistrictIds: []
});
