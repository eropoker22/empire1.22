import { runTick, type CoreGameState } from "@empire/game-core";

type TickContext = Parameters<typeof runTick>[1];

export const advanceStateToTick = (
  state: CoreGameState,
  targetTick: number,
  context: TickContext
): CoreGameState => {
  let nextState = state;
  while (nextState.root.tick < targetTick) {
    const tick = runTick(nextState, context).nextState;
    if (tick.root.tick <= nextState.root.tick) {
      throw new Error(`Game stopped advancing at tick ${nextState.root.tick} before target ${targetTick}.`);
    }
    nextState = tick;
  }
  return nextState;
};

export const advanceStateToTickWithEvents = (
  state: CoreGameState,
  targetTick: number,
  context: TickContext
): ReturnType<typeof runTick> => {
  let nextState = state;
  const events: ReturnType<typeof runTick>["events"] = [];
  while (nextState.root.tick < targetTick) {
    const tick = runTick(nextState, context);
    if (tick.nextState.root.tick <= nextState.root.tick) {
      throw new Error(`Game stopped advancing at tick ${nextState.root.tick} before target ${targetTick}.`);
    }
    nextState = tick.nextState;
    events.push(...tick.events);
  }
  return { nextState, events };
};

/**
 * Stages a deferred operation immediately before its due boundary, then lets
 * the canonical tick resolve that boundary. Use only when the skipped ticks
 * are not themselves part of the invariant under test.
 */
export const advanceStateAcrossDueTick = (
  state: CoreGameState,
  targetTick: number,
  context: TickContext
): ReturnType<typeof runTick> => {
  return runTick(stageStateImmediatelyBeforeTick(state, targetTick), context);
};

export const stageStateImmediatelyBeforeTick = (
  state: CoreGameState,
  targetTick: number
): CoreGameState => {
  const beforeDueTick = Math.max(state.root.tick, targetTick - 1);
  return beforeDueTick === state.root.tick
    ? state
    : {
        ...state,
        root: {
          ...state.root,
          tick: beforeDueTick,
          version: state.root.version + 1
        },
        serverInstance: {
          ...state.serverInstance,
          currentTick: beforeDueTick
        }
      };
};

export const advancePendingDistrictAction = (
  state: CoreGameState,
  context: TickContext,
  commandId?: string
): CoreGameState => {
  const operation = Object.values(state.pendingDistrictActionOperationsById ?? {})
    .find((candidate) => commandId === undefined || candidate.command.id === commandId);
  if (!operation) throw new Error(`Expected a pending district action${commandId ? ` for ${commandId}` : ""}.`);
  return advanceStateToTick(state, operation.resolveAtTick, context);
};

export const resolvePendingDistrictAction = (
  state: CoreGameState,
  context: TickContext,
  commandId?: string
): ReturnType<typeof runTick> => {
  const operation = Object.values(state.pendingDistrictActionOperationsById ?? {})
    .find((candidate) => commandId === undefined || candidate.command.id === commandId);
  if (!operation) throw new Error(`Expected a pending district action${commandId ? ` for ${commandId}` : ""}.`);
  return advanceStateToTickWithEvents(state, operation.resolveAtTick, context);
};

export const advancePendingOccupation = (
  state: CoreGameState,
  context: TickContext,
  commandId?: string
): CoreGameState => {
  const operation = Object.values(state.pendingOccupyOperationsById ?? {})
    .find((candidate) => commandId === undefined || candidate.commandId === commandId);
  if (!operation) throw new Error(`Expected a pending occupation${commandId ? ` for ${commandId}` : ""}.`);
  return advanceStateToTick(state, operation.resolveAtTick, context);
};

export const resolvePendingOccupation = (
  state: CoreGameState,
  context: TickContext,
  commandId?: string
): ReturnType<typeof runTick> => {
  const operation = Object.values(state.pendingOccupyOperationsById ?? {})
    .find((candidate) => commandId === undefined || candidate.commandId === commandId);
  if (!operation) throw new Error(`Expected a pending occupation${commandId ? ` for ${commandId}` : ""}.`);
  return advanceStateToTickWithEvents(state, operation.resolveAtTick, context);
};

export const advanceProductionLine = (
  state: CoreGameState,
  buildingId: string,
  recipeId: string,
  context: TickContext
): CoreGameState => {
  const line = state.buildingsById[buildingId]?.productionLines?.[recipeId];
  if (!line?.activeCompletesAtTick) {
    throw new Error(`Expected active ${recipeId} production in ${buildingId}.`);
  }
  return advanceStateToTick(state, line.activeCompletesAtTick, context);
};

export const advanceProductionUntilIdle = (
  state: CoreGameState,
  buildingId: string,
  recipeId: string,
  context: TickContext
): CoreGameState => {
  let nextState = state;
  for (let completedUnits = 0; completedUnits < 1_000; completedUnits += 1) {
    const line = nextState.buildingsById[buildingId]?.productionLines?.[recipeId];
    if (!line || line.queuedAmount <= 0) return nextState;
    if (!line.activeCompletesAtTick) {
      // A queued line with no active timer is blocked by its local output cap.
      return nextState;
    }
    if (line.activeCompletesAtTick <= nextState.root.tick) {
      // A due line that cannot settle is likewise blocked by its local output cap.
      return nextState;
    }
    nextState = advanceStateToTick(nextState, line.activeCompletesAtTick, context);
  }
  throw new Error(`Production ${recipeId} in ${buildingId} did not become idle.`);
};
