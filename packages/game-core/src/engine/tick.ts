import type { CoreGameState } from "../entities";
import type { CoreEvent } from "../events";
import type { GameCoreContext } from "./context";
import { completeCraftProcessing } from "../rules/production/completeCraftProcessing";
import { completeProduction } from "../rules/production/completeProduction";
import { checkVictory } from "../rules/victory/checkVictory";

/**
 * Responsibility: Canonical tick entry point for periodic server-side simulation.
 * Belongs here: orchestration of one logical tick pass over the authoritative state.
 * Does not belong here: timer scheduling or transport fanout.
 */
export const runTick = (
  state: CoreGameState,
  context: GameCoreContext
): { nextState: CoreGameState; events: CoreEvent[] } => {
  const advancedState: CoreGameState = {
    ...state,
    serverInstance: {
      ...state.serverInstance,
      currentTick: state.serverInstance.currentTick + 1
    },
    root: {
      ...state.root,
      tick: state.root.tick + 1
    }
  };
  const producedState = completeProduction(advancedState, context);
  const processingResult = completeCraftProcessing(producedState, context);
  const nextState = processingResult.nextState;

  checkVictory(nextState, context);

  return {
    nextState,
    events: processingResult.events
  };
};
