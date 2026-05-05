import type { CoreGameState } from "../entities";
import type { CoreEvent } from "../events";
import type { GameCoreContext } from "./context";
import { collectIncome } from "../rules/economy/collectIncome";
import { completeCraftProcessing } from "../rules/production/completeCraftProcessing";
import { completeProduction } from "../rules/production/completeProduction";
import { releaseExpiredPoliceConsequences } from "../rules/police/policeConsequenceExpiry";
import { expirePendingRaids } from "../rules/police/raidLifecycle";
import { triggerRaid } from "../rules/police/triggerRaid";
import { checkVictory } from "../rules/victory/checkVictory";
import { appendCityFeedEventsFromCoreEvents } from "../rules/events";

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
  const releasedPoliceState = releaseExpiredPoliceConsequences(advancedState);
  const incomeState = collectIncome(releasedPoliceState, context);
  const producedState = completeProduction(incomeState, context);
  const processingResult = completeCraftProcessing(producedState, context);
  const lifecycleResult = expirePendingRaids(processingResult.nextState, context);
  const policeResult = triggerRaid(lifecycleResult.nextState, context);
  const victoryResult = checkVictory(policeResult.nextState, context);
  const events = [...processingResult.events, ...lifecycleResult.events, ...policeResult.events];

  return {
    nextState: appendCityFeedEventsFromCoreEvents(victoryResult.nextState, events),
    events
  };
};
