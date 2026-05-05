import type { PoliceState } from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import { resolveWantedLevel } from "../rules/police/wantedLevel";

/**
 * Responsibility: Shared player police-state helpers for command handlers.
 * Belongs here: server-authored heat and wanted-level state derivation.
 * Does not belong here: raid scheduling or UI labels.
 */
export const createPlayerPoliceState = (
  player: CoreGameState["playersById"][string],
  tick: number
): PoliceState => ({
  id: player.policeStateId,
  ownerPlayerId: player.id,
  heat: 0,
  wantedLevel: 0,
  lastDecayTick: tick,
  activeFlags: [],
  version: 1
});

export { resolveWantedLevel };

export const increasePlayerPoliceHeat = (
  state: CoreGameState,
  player: CoreGameState["playersById"][string],
  heatGain: number,
  tick: number
): PoliceState => {
  const currentPoliceState = state.policeStatesById[player.policeStateId] ?? createPlayerPoliceState(player, tick);
  const nextHeat = Math.max(0, Number(currentPoliceState.heat || 0) + Math.max(0, heatGain));

  return {
    ...currentPoliceState,
    heat: nextHeat,
    wantedLevel: resolveWantedLevel(nextHeat),
    version: currentPoliceState.version + (state.policeStatesById[currentPoliceState.id] ? 1 : 0)
  };
};
