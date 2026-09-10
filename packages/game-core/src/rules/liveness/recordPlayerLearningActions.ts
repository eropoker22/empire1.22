import type { CoreGameState } from "../../entities";
/** Durable facts of accepted gameplay, scoped to the player attempt. */
export function recordPlayerLearningAction(state: CoreGameState, playerId: string, commandType: string): CoreGameState {
  const action = commandType === "spy-district" ? "spy"
    : ["place-trap", "relocate-trap"].includes(commandType) ? "trap" : null;
  const player = state.playersById[playerId];
  if (!action || !player) return state;
  const previous = Array.isArray(player.metadata?.learningActions) ? player.metadata.learningActions : [];
  if (previous.includes(action)) return state;
  return { ...state, playersById: { ...state.playersById, [playerId]: { ...player,
    metadata: { ...player.metadata, learningActions: [...previous, action] }, version: player.version + 1 } } };
}
