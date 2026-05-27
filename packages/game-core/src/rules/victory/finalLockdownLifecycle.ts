import {
  PRODUCTION_GAME_LIFECYCLE_PHASES,
  type EliminationState,
  type FinalLockdownState
} from "@empire/shared-types";
import type { CoreGameState } from "../../entities";
import type { CoreEvent } from "../../events";
import { CORE_EVENT_TYPES, createEvent } from "../../events";
import type { GameCoreContext } from "../../engine/context";
import { appendResolvedCityFeedEvents } from "../events/rumorPipeline";
import {
  isTickInEliminationQuietHours,
  resolveEliminationConfig,
  resolveQuietHoursResumeTick
} from "../elimination/eliminationConfig";
import {
  createFinalLockdownStartedFeedEvent,
  createFinalLockdownStartedNotification
} from "./finalLockdownMessages";
import { resolveFinalLockdown } from "./finalLockdownResolution";

export interface FinalLockdownLifecycleResult {
  nextState: CoreGameState;
  events: CoreEvent[];
}

export const runFinalLockdownLifecycle = (
  state: CoreGameState,
  context: GameCoreContext
): FinalLockdownLifecycleResult => {
  const config = context.config.balance.finalLockdown;
  if (!config?.enabled || state.matchResult) return { nextState: state, events: [] };

  const activePlayerIds = state.root.playerIds.filter((playerId) => state.playersById[playerId]?.status === "active");
  let nextState = state;
  const events: CoreEvent[] = [];

  if (!nextState.finalLockdownState && activePlayerIds.length <= config.triggerActivePlayers) {
    const started = startFinalLockdown(nextState, context, activePlayerIds);
    nextState = started.nextState;
    events.push(...started.events);
  }

  if (!nextState.finalLockdownState || nextState.finalLockdownState.status === "resolved") {
    return { nextState, events };
  }

  const advanced = advanceFinalLockdown(nextState, context);
  nextState = advanced.nextState;
  if (advanced.events.length > 0) events.push(...advanced.events);

  return { nextState, events };
};

export const isFinalLockdownPausedByQuietHours = (
  state: CoreGameState,
  context: GameCoreContext,
  tick = state.root.tick
): boolean => {
  const finalConfig = context.config.balance.finalLockdown;
  const eliminationConfig = resolveEliminationConfig(context.config);
  if (!finalConfig?.pauseDuringQuietHours || !eliminationConfig?.quietHours) return false;
  return isTickInEliminationQuietHours(state, eliminationConfig, tick, context.config.tickRateMs);
};

export const resolveFinalLockdownQuietHoursResumeTick = (
  state: CoreGameState,
  context: GameCoreContext,
  tick = state.root.tick
): number | null => {
  const finalConfig = context.config.balance.finalLockdown;
  const eliminationConfig = resolveEliminationConfig(context.config);
  if (!finalConfig?.pauseDuringQuietHours || !eliminationConfig?.quietHours) return null;
  return resolveQuietHoursResumeTick(state, eliminationConfig, tick, context.config.tickRateMs);
};

export const estimateFinalLockdownEndTick = (
  state: CoreGameState,
  context: GameCoreContext
): number | null => {
  const finalState = state.finalLockdownState;
  if (!finalState || finalState.status === "inactive" || finalState.status === "resolved") return null;
  let remaining = Math.max(0, finalState.remainingActiveTicks);
  let tick = state.root.tick;
  const maxIterations = Math.max(remaining * 4, remaining + ticksPerDay(context));
  for (let index = 0; remaining > 0 && index < maxIterations; index += 1) {
    tick += 1;
    if (!isFinalLockdownPausedByQuietHours(state, context, tick)) remaining -= 1;
  }
  return remaining <= 0 ? tick : state.root.tick + finalState.remainingActiveTicks;
};

const startFinalLockdown = (
  state: CoreGameState,
  context: GameCoreContext,
  activePlayerIds: string[]
): FinalLockdownLifecycleResult => {
  const config = context.config.balance.finalLockdown!;
  const pausedByQuietHours = isFinalLockdownPausedByQuietHours(state, context);
  const finalLockdownState: FinalLockdownState = {
    id: `final-lockdown:${state.serverInstance.id}`,
    serverInstanceId: state.serverInstance.id,
    status: pausedByQuietHours ? "paused" : "active",
    startedAtTick: state.root.tick,
    activeElapsedTicks: 0,
    activeDurationTicks: config.activeDurationTicks,
    remainingActiveTicks: config.activeDurationTicks,
    lastUpdatedTick: state.root.tick,
    pausedByQuietHours,
    resolvedAtTick: null,
    finalTopPlayerIds: [],
    version: 1
  };
  const feedEvent = createFinalLockdownStartedFeedEvent(state);
  const notifications = activePlayerIds.map((playerId) => createFinalLockdownStartedNotification(state, playerId));
  const stateWithFeed = appendResolvedCityFeedEvents(state, [feedEvent]);
  const nextState: CoreGameState = {
    ...stateWithFeed,
    root: {
      ...stateWithFeed.root,
      phase: PRODUCTION_GAME_LIFECYCLE_PHASES.finalLockdown,
      notificationIds: [...stateWithFeed.root.notificationIds, ...notifications.map((notification) => notification.id)],
      version: stateWithFeed.root.version + 1
    },
    eliminationState: stopEliminations(stateWithFeed),
    finalLockdownState,
    notificationsById: {
      ...stateWithFeed.notificationsById,
      ...Object.fromEntries(notifications.map((notification) => [notification.id, notification]))
    }
  };

  return {
    nextState,
    events: [
      createEvent(CORE_EVENT_TYPES.finalLockdownStarted, {
        activePlayerIds,
        startedAtTick: state.root.tick,
        activeDurationTicks: config.activeDurationTicks
      }),
      ...notifications.map((notification) => createEvent(CORE_EVENT_TYPES.notificationCreated, {
        notificationId: notification.id,
        playerId: notification.recipientId,
        category: notification.category
      }))
    ]
  };
};

const advanceFinalLockdown = (
  state: CoreGameState,
  context: GameCoreContext
): FinalLockdownLifecycleResult => {
  const finalState = state.finalLockdownState!;
  const currentTick = state.root.tick;
  const activeElapsedTicks = Math.min(
    finalState.activeDurationTicks,
    finalState.activeElapsedTicks + countActiveTicks(state, context, finalState.lastUpdatedTick, currentTick)
  );
  const remainingActiveTicks = Math.max(0, finalState.activeDurationTicks - activeElapsedTicks);
  const pausedByQuietHours = isFinalLockdownPausedByQuietHours(state, context, currentTick);
  const status = remainingActiveTicks <= 0 ? "resolved" : pausedByQuietHours ? "paused" : "active";
  const nextFinalState: FinalLockdownState = {
    ...finalState,
    status,
    activeElapsedTicks,
    remainingActiveTicks,
    lastUpdatedTick: currentTick,
    pausedByQuietHours,
    resolvedAtTick: status === "resolved" ? currentTick : null,
    version: finalState.version + 1
  };

  if (status !== "resolved") {
    return {
      nextState: {
        ...state,
        root: {
          ...state.root,
          phase: PRODUCTION_GAME_LIFECYCLE_PHASES.finalLockdown
        },
        eliminationState: stopEliminations(state),
        finalLockdownState: nextFinalState
      },
      events: []
    };
  }

  return resolveFinalLockdown(state, context, nextFinalState);
};

const countActiveTicks = (
  state: CoreGameState,
  context: GameCoreContext,
  fromTick: number,
  toTick: number
): number => {
  let elapsed = 0;
  for (let tick = Math.max(0, fromTick + 1); tick <= toTick; tick += 1) {
    if (!isFinalLockdownPausedByQuietHours(state, context, tick)) elapsed += 1;
  }
  return elapsed;
};

const stopEliminations = (state: CoreGameState): EliminationState => {
  const existing = state.eliminationState;
  if (existing) {
    return existing.nextEliminationTick === null && existing.deferredFromTick === null
      ? existing
      : {
          ...existing,
          nextEliminationTick: null,
          deferredFromTick: null,
          version: existing.version + 1
        };
  }
  return {
    id: `${state.serverInstance.id}:elimination`,
    serverInstanceId: state.serverInstance.id,
    lastEliminationTick: null,
    lastScheduledEliminationTick: null,
    nextEliminationTick: null,
    deferredFromTick: null,
    eliminationCount: 0,
    eliminatedPlayerIds: [],
    lastEliminatedPlayerId: null,
    lastEliminationReason: null,
    version: 1
  };
};

const ticksPerDay = (context: GameCoreContext): number =>
  Math.ceil((24 * 60 * 60 * 1000) / Math.max(1, context.config.tickRateMs));
