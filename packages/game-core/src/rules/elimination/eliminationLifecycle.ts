import type { CityFeedEvent, EliminationState, Notification, PlayerId } from "@empire/shared-types";
import type { CoreGameState } from "../../entities";
import { CORE_EVENT_TYPES, createEvent, type CoreEvent } from "../../events";
import type { GameCoreContext } from "../../engine/context";
import { compareEliminationScores, createPlayerEliminationScore, type PlayerEliminationScore } from "./eliminationScore";
import { resolveEliminationConfig, resolveQuietHoursResumeTick } from "./eliminationConfig";
import { appendResolvedCityFeedEvents } from "../events/rumorPipeline";
import { applyDefeatedDistrictPolicy } from "./eliminationDistrictPolicy";

export interface EliminationResult {
  eliminatedPlayerId: PlayerId;
  finalPlacement: number;
  score: PlayerEliminationScore;
  scheduledTick: number;
  nextEliminationTick: number;
  activePlayersRemaining: number;
}

export const runScheduledElimination = (
  state: CoreGameState,
  context: GameCoreContext
): { nextState: CoreGameState; events: CoreEvent[]; result: EliminationResult | null } => {
  const config = resolveEliminationConfig(context.config);
  if (!config?.enabled) return { nextState: state, events: [], result: null };

  const currentTick = state.root.tick;
  const stateRecord = state.eliminationState ?? createInitialEliminationState(state, config.firstEliminationTick);
  const scheduledTick = stateRecord.nextEliminationTick ?? config.firstEliminationTick;
  if (currentTick < scheduledTick || stateRecord.lastEliminationTick === currentTick) {
    return { nextState: { ...state, eliminationState: stateRecord }, events: [], result: null };
  }

  const activePlayerIds = state.root.playerIds.filter((playerId) => state.playersById[playerId]?.status === "active");
  if (activePlayerIds.length <= config.minActivePlayers) {
    return { nextState: { ...state, eliminationState: stopEliminationState(stateRecord) }, events: [], result: null };
  }

  const deferredFromTick = stateRecord.deferredFromTick ?? null;
  const quietHoursResumeTick = deferredFromTick === null
    ? resolveQuietHoursResumeTick(state, config, scheduledTick, context.config.tickRateMs)
    : null;
  if (quietHoursResumeTick !== null && currentTick < quietHoursResumeTick) {
    return {
      nextState: {
        ...state,
        eliminationState: deferEliminationState(stateRecord, scheduledTick, quietHoursResumeTick)
      },
      events: [],
      result: null
    };
  }
  const effectiveScheduledTick = deferredFromTick ?? scheduledTick;

  const weakest = activePlayerIds
    .map((playerId) => createPlayerEliminationScore(state, playerId, context))
    .sort(compareEliminationScores)[0];
  const finalPlacement = activePlayerIds.length;
  const nextEliminationTick = currentTick + config.intervalTicks;
  const eliminatedPlayer = state.playersById[weakest.playerId];
  const notification = createEliminationNotification(state, weakest.playerId, currentTick);
  const feedEvent = createEliminationFeedEvent(state, weakest, currentTick);
  const eliminationState = updateEliminationState(stateRecord, weakest.playerId, currentTick, effectiveScheduledTick, nextEliminationTick);
  const neutralizedState = appendResolvedCityFeedEvents(
    applyDefeatedDistrictPolicy(state, weakest.playerId, config),
    [feedEvent]
  );
  const nextState: CoreGameState = {
    ...neutralizedState,
    playersById: {
      ...neutralizedState.playersById,
      [weakest.playerId]: {
        ...eliminatedPlayer,
        status: config.eliminatedPlayerStatus,
        metadata: {
          ...(eliminatedPlayer.metadata ?? {}),
          eliminatedAtTick: currentTick,
          eliminationReason: "scheduled_weakest_player",
          finalPlacement
        },
        version: eliminatedPlayer.version + 1
      }
    },
    notificationsById: {
      ...neutralizedState.notificationsById,
      [notification.id]: notification
    },
    cityFeedEventsById: neutralizedState.cityFeedEventsById,
    root: {
      ...neutralizedState.root,
      notificationIds: [...neutralizedState.root.notificationIds, notification.id]
    },
    eliminationState
  };
  const result: EliminationResult = {
    eliminatedPlayerId: weakest.playerId,
    finalPlacement,
    score: weakest,
    scheduledTick: effectiveScheduledTick,
    nextEliminationTick,
    activePlayersRemaining: activePlayerIds.length - 1
  };

  return {
    nextState,
    events: [
      createEvent(CORE_EVENT_TYPES.playerEliminated, {
        playerId: weakest.playerId,
        playerName: weakest.playerName,
        eliminatedAtTick: currentTick,
        finalPlacement,
        reason: "scheduled_weakest_player",
        score: weakest.score,
        controlledDistricts: weakest.controlledDistricts,
        nextEliminationTick,
        activePlayersRemaining: activePlayerIds.length - 1
      }),
      createEvent(CORE_EVENT_TYPES.notificationCreated, {
        notificationId: notification.id,
        playerId: weakest.playerId,
        category: notification.category
      })
    ],
    result
  };
};

const createInitialEliminationState = (state: CoreGameState, firstEliminationTick: number): EliminationState => ({
  id: `${state.serverInstance.id}:elimination`,
  serverInstanceId: state.serverInstance.id,
  lastEliminationTick: null,
  lastScheduledEliminationTick: null,
  nextEliminationTick: firstEliminationTick,
  deferredFromTick: null,
  eliminationCount: 0,
  eliminatedPlayerIds: [],
  lastEliminatedPlayerId: null,
  lastEliminationReason: null,
  version: 1
});

const deferEliminationState = (
  state: EliminationState,
  scheduledTick: number,
  resumeTick: number
): EliminationState => (
  state.nextEliminationTick === resumeTick && state.deferredFromTick === scheduledTick
    ? state
    : {
        ...state,
        nextEliminationTick: resumeTick,
        deferredFromTick: scheduledTick,
        lastScheduledEliminationTick: scheduledTick,
        version: state.version + 1
      }
);

const stopEliminationState = (state: EliminationState): EliminationState =>
  state.nextEliminationTick === null && state.deferredFromTick === null
    ? state
    : {
        ...state,
        nextEliminationTick: null,
        deferredFromTick: null,
        version: state.version + 1
      };

const updateEliminationState = (
  state: EliminationState,
  playerId: PlayerId,
  eliminationTick: number,
  scheduledTick: number,
  nextEliminationTick: number
): EliminationState => ({
  ...state,
  lastEliminationTick: eliminationTick,
  lastScheduledEliminationTick: scheduledTick,
  nextEliminationTick,
  deferredFromTick: null,
  eliminationCount: state.eliminationCount + 1,
  eliminatedPlayerIds: [...new Set([...state.eliminatedPlayerIds, playerId])],
  lastEliminatedPlayerId: playerId,
  lastEliminationReason: "scheduled_weakest_player",
  version: state.version + 1
});

const createEliminationNotification = (
  state: CoreGameState,
  playerId: PlayerId,
  scheduledTick: number
): Notification => ({
  id: `notification:elimination:${scheduledTick}:${playerId}`,
  recipientType: "player",
  recipientId: playerId,
  category: "elimination.defeated",
  title: "Byl jsi vyřazen ze serveru",
  bodyKey: "elimination.defeated",
  payload: {
    body: "Po pravidelném vyhodnocení jsi byl nejslabší aktivní hráč. Tenhle server pro tebe končí jako prohra.",
    eliminatedAtTick: scheduledTick,
    serverInstanceId: state.serverInstance.id
  },
  createdAt: new Date(0).toISOString(),
  readAt: null
});

const createEliminationFeedEvent = (
  state: CoreGameState,
  score: PlayerEliminationScore,
  scheduledTick: number
): CityFeedEvent => {
  const messages = [
    `Město sežralo další impérium. ${score.playerName} vypadává ze serveru.`,
    `Slabí mizí z mapy. ${score.playerName} byl vyřazen z městské války.`,
    `Pravidelný řez dopadl. ${score.playerName} končí.`
  ];
  const index = Math.abs(hashText(`${score.playerId}:${scheduledTick}`)) % messages.length;
  return {
    id: `city-feed:elimination:${scheduledTick}:${score.playerId}`,
    sourceEventId: `elimination:${scheduledTick}:${score.playerId}`,
    sourceType: "system",
    category: "system",
    severity: "high",
    truthiness: "confirmed",
    intelType: "confirmed_event",
    visibility: "all",
    targetPlayerId: score.playerId,
    createdAtTick: state.root.tick,
    message: messages[index],
    messageKey: "system.player_eliminated",
    payload: {
      playerId: score.playerId,
      playerName: score.playerName,
      reason: "scheduled_weakest_player",
      score: score.score,
      controlledDistricts: score.controlledDistricts
    }
  };
};

const hashText = (value: string): number =>
  Array.from(value).reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 0);
