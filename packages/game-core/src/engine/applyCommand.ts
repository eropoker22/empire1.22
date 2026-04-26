import type { CorePlayerCommand } from "../commands";
import type { CoreError } from "../errors";
import type { CoreGameState } from "../entities";
import type { CoreEvent } from "../events";
import type { GameCoreContext } from "./context";
import { routeCommand } from "./commandRouter";

/**
 * Responsibility: Canonical command application entry point for the game core.
 * Belongs here: orchestration of routing, validation, and pure state transitions.
 * Does not belong here: transport concerns, persistence, or UI rendering.
 */
export const applyCommand = (
  state: CoreGameState,
  command: CorePlayerCommand,
  context: GameCoreContext
): { nextState: CoreGameState; events: CoreEvent[]; errors: CoreError[] } => routeCommand(state, command, context);
