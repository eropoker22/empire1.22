import type { CoreGameState } from "@empire/game-core";

/** Runtime seats already activated from membership reservations. Defeat retains a
 * seat; only completed early departure releases it. Historical IDs remain intact.
 * Unactivated reservations/setup memberships are counted by the durable join gate. */
export const countRuntimeOccupiedSeats = (state: CoreGameState): number =>
  new Set(state.root.playerIds.filter(id => state.playersById[id] && state.playersById[id].status !== "left")).size;
