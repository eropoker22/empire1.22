import type { CoreGameState } from "../entities";

export const selectPlayerById = (state: CoreGameState, playerId: string) =>
  state.playersById[playerId] ?? null;

export const selectTick = (state: CoreGameState): number => state.root.tick;
