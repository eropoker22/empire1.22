import type { CoreGameState } from "../entities";
import type { CoreEvent } from "../events";
import type { CoreError } from "../errors";

/**
 * Responsibility: Placeholder handler for alliance join commands.
 * Belongs here: alliance membership transitions in the core.
 * Does not belong here: invitation transport or chat integration.
 */
export const handleJoinAlliance = (
  state: CoreGameState
): { nextState: CoreGameState; events: CoreEvent[]; errors: CoreError[] } => ({
  nextState: state,
  events: [],
  errors: []
});

