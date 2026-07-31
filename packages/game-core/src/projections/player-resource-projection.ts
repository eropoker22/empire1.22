import type { CoreGameState } from "../entities/game-state";

export const calculatePlayerProjectedInfluence = (
  state: CoreGameState,
  playerId: string
): number => Object.values(state.districtsById)
  .filter((district) => (
    district.ownerPlayerId === playerId
    && district.status !== "destroyed"
  ))
  .reduce((total, district) => total + Math.max(0, Number(district.influence || 0)), 0);

export const calculatePlayerDisplayedInfluence = (
  state: CoreGameState,
  playerId: string
): number => Math.floor(calculatePlayerProjectedInfluence(state, playerId));
