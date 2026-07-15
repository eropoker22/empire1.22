import type { CorePlayerCommand } from "../commands";
import type { CoreError } from "../errors";
import type { CoreGameState } from "../entities";
import type { CoreEvent } from "../events";
import type { GameCoreContext } from "./context";
import { routeCommand } from "./commandRouter";
import { appendCityFeedEventsFromCoreEvents } from "../rules/events";

/**
 * Responsibility: Canonical command application entry point for the game core.
 * Belongs here: orchestration of routing, validation, and pure state transitions.
 * Does not belong here: transport concerns, persistence, or UI rendering.
 */
export const applyCommand = (
  state: CoreGameState,
  command: CorePlayerCommand,
  context: GameCoreContext
): { nextState: CoreGameState; events: CoreEvent[]; errors: CoreError[] } => {
  const result = routeCommand(state, command, context);
  if (result.errors.length > 0) {
    return result;
  }
  const nowIso = context.clock?.nowIso?.();
  const player = result.nextState.playersById[command.playerId];
  const stateWithPresence = player && nowIso
    ? {
        ...result.nextState,
        playersById: {
          ...result.nextState.playersById,
          [player.id]: {
            ...player,
            metadata: { ...(player.metadata ?? {}), lastSeenAt: nowIso }
          }
        }
      }
    : result.nextState;
  return {
    ...result,
    nextState: appendCityFeedEventsFromCoreEvents(stateWithPresence, result.events, undefined, context)
  };
};
