import type { CoreGameState } from "../../entities";
import type { GameCoreContext } from "../../engine/context";
import { calculatePlayerPolicePressure } from "./policePressure";

/**
 * Responsibility: Evaluates aggregate police pressure from authoritative state.
 * Belongs here: pure server-side police/heat evaluation.
 * Does not belong here: admin dashboard rendering or notification delivery.
 */
export const evaluatePolicePressure = (
  state: CoreGameState,
  context?: GameCoreContext
): number => {
  const playerIds = Object.keys(state.playersById);
  if (playerIds.length <= 0) {
    return 0;
  }

  return playerIds.reduce(
    (total, playerId) => total + calculatePlayerPolicePressure(state, playerId, context).aggregatePressure,
    0
  );
};

export const evaluatePlayerPolicePressure = (
  state: CoreGameState,
  playerId: string,
  context?: GameCoreContext
): number => calculatePlayerPolicePressure(state, playerId, context).aggregatePressure;
