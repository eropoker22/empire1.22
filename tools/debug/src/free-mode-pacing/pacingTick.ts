import {
  calculateIncomeByPlayerId,
  checkVictory,
  completeCraftProcessing,
  completeProduction,
  runScheduledElimination,
  type CoreEvent,
  type CoreGameState,
  type GameCoreContext
} from "@empire/game-core";

export const moveStateToTickBeforeNextRun = (state: CoreGameState, targetTick: number): CoreGameState => ({
  ...state,
  root: {
    ...state.root,
    tick: Math.max(0, targetTick - 1)
  },
  serverInstance: {
    ...state.serverInstance,
    currentTick: Math.max(0, targetTick - 1)
  }
});

export const runPacingTick = (
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
  const eliminationResult = runScheduledElimination(processingResult.nextState, context);
  const victoryResult = checkVictory(eliminationResult.nextState, context);

  return {
    nextState: victoryResult.nextState,
    events: [...processingResult.events, ...eliminationResult.events]
  };
};

export const applyIncomeCatchup = (
  state: CoreGameState,
  context: GameCoreContext,
  extraTicks: number
): CoreGameState => {
  if (extraTicks <= 0) return state;
  const incomeByPlayerId = calculateIncomeByPlayerId(state, context);
  let nextResourceStates = state.resourceStatesById;
  let changed = false;

  for (const [playerId, income] of Object.entries(incomeByPlayerId)) {
    const player = state.playersById[playerId];
    if (player?.status !== "active") continue;
    const resourceState = state.resourceStatesById[player.resourceStateId];
    if (!resourceState) continue;
    nextResourceStates = {
      ...nextResourceStates,
      [resourceState.id]: {
        ...resourceState,
        balances: Object.fromEntries(
          Object.entries({
            ...resourceState.balances,
            ...income
          }).map(([key]) => [
            key,
            Number(resourceState.balances[key] || 0) + Number(income[key] || 0) * extraTicks
          ])
        ),
        lastUpdatedTick: state.root.tick,
        version: resourceState.version + 1
      }
    };
    changed = true;
  }

  return changed ? { ...state, resourceStatesById: nextResourceStates } : state;
};
