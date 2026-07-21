import {
  PRODUCTION_GAME_LIFECYCLE_PHASES,
  type FinalLockdownState,
  type MatchRankingEntry
} from "@empire/shared-types";
import type { CoreGameState } from "../../entities";
import type { CoreEvent } from "../../events";
import { CORE_EVENT_TYPES, createEvent } from "../../events";
import type { GameCoreContext } from "../../engine/context";
import { appendResolvedCityFeedEvents } from "../events/rumorPipeline";
import { createFinalEmpireRanking } from "./finalEmpireScore";
import {
  createFinalLockdownResolvedFeedEvent,
  createFinalLockdownResolvedNotification
} from "./finalLockdownMessages";

export interface FinalLockdownResolutionResult {
  nextState: CoreGameState;
  events: CoreEvent[];
}

export const resolveFinalLockdown = (
  state: CoreGameState,
  context: GameCoreContext,
  finalState: FinalLockdownState
): FinalLockdownResolutionResult => {
  const ranking = createFinalEmpireRanking(state, context);
  const winner = ranking[0] ?? null;
  const topRankCount = Math.max(1, Math.floor(Number(context.config.balance.finalLockdown?.topRankCount ?? 3)));
  const activeRanking = createActiveRanking(ranking);
  const eliminatedRanking = createEliminatedRanking(state, ranking.length);
  const topPlayerIds = ranking.slice(0, topRankCount).map((entry) => entry.playerId);
  const matchResultId = state.root.matchResultId ?? `match:${state.serverInstance.id}:${state.root.tick}`;
  const victoryStateId = state.root.victoryStateId ?? `victory:${state.serverInstance.id}`;
  const endedAt = context.clock?.nowIso() ?? state.serverInstance.startedAt;
  const notifications = ranking.map((score, index) =>
    createFinalLockdownResolvedNotification(state, score.playerId, index + 1, score.score, endedAt)
  );
  const stateWithFeed = appendResolvedCityFeedEvents(state, [
    createFinalLockdownResolvedFeedEvent(state, ranking.slice(0, topRankCount))
  ]);

  return {
    nextState: {
      ...stateWithFeed,
      serverInstance: {
        ...stateWithFeed.serverInstance,
        status: "ended",
        endedAt,
        version: stateWithFeed.serverInstance.version + 1
      },
      root: {
        ...stateWithFeed.root,
        phase: PRODUCTION_GAME_LIFECYCLE_PHASES.resolved,
        victoryStateId,
        matchResultId,
        notificationIds: [...stateWithFeed.root.notificationIds, ...notifications.map((notification) => notification.id)],
        version: stateWithFeed.root.version + 1
      },
      finalLockdownState: {
        ...finalState,
        finalTopPlayerIds: topPlayerIds
      },
      victoryState: {
        id: victoryStateId,
        serverInstanceId: state.serverInstance.id,
        status: "resolved",
        victoryType: "final_lockdown",
        leaderPlayerId: winner?.playerId ?? null,
        leaderAllianceId: null,
        progressPayload: createFinalLockdownProgressPayload(finalState, ranking.slice(0, topRankCount), state.root.tick),
        resolvedAtTick: state.root.tick,
        version: (state.victoryState?.version ?? 0) + 1
      },
      matchResult: {
        id: matchResultId,
        serverInstanceId: state.serverInstance.id,
        endedAt,
        winnerPlayerId: winner?.playerId ?? null,
        winnerAllianceId: null,
        ranking: [...activeRanking, ...eliminatedRanking],
        reason: "final_lockdown_score"
      },
      notificationsById: {
        ...stateWithFeed.notificationsById,
        ...Object.fromEntries(notifications.map((notification) => [notification.id, notification]))
      }
    },
    events: [
      createEvent(CORE_EVENT_TYPES.finalLockdownResolved, {
        winnerPlayerId: winner?.playerId ?? null,
        topPlayerIds,
        ranking: activeRanking,
        resolvedAtTick: state.root.tick
      }),
      ...notifications.map((notification) => createEvent(CORE_EVENT_TYPES.notificationCreated, {
        notificationId: notification.id,
        playerId: notification.recipientId,
        category: notification.category
      }))
    ]
  };
};

const createActiveRanking = (ranking: ReturnType<typeof createFinalEmpireRanking>): MatchRankingEntry[] =>
  ranking.map((score, index) => ({
    subjectType: "player",
    subjectId: score.playerId,
    rank: index + 1,
    score: Math.round(score.score * 100) / 100,
    scoreBreakdown: score.scoreBreakdown
  }));

const createEliminatedRanking = (state: CoreGameState, activeRankCount: number): MatchRankingEntry[] =>
  state.root.playerIds
    .filter((playerId) => state.playersById[playerId]?.status !== "active")
    .map((playerId) => ({
      subjectType: "player" as const,
      subjectId: playerId,
      rank: Math.max(activeRankCount + 1, Number(state.playersById[playerId]?.metadata?.finalPlacement ?? activeRankCount + 1)),
      score: Number(state.playersById[playerId]?.metadata?.scoreAtElimination ?? 0),
      scoreBreakdown: state.playersById[playerId]?.metadata?.scoreBreakdownAtElimination as Record<string, number>
        ?? { finalPlacement: Number(state.playersById[playerId]?.metadata?.finalPlacement ?? 0) }
    }))
    .sort((left, right) => left.rank - right.rank || left.subjectId.localeCompare(right.subjectId));

const createFinalLockdownProgressPayload = (
  finalState: FinalLockdownState,
  topScores: ReturnType<typeof createFinalEmpireRanking>,
  resolvedAtTick: number
): Record<string, unknown> => ({
  reason: "final_lockdown_score",
  finalLockdown: {
    startedAtTick: finalState.startedAtTick,
    resolvedAtTick,
    activeElapsedTicks: finalState.activeElapsedTicks,
    activeDurationTicks: finalState.activeDurationTicks,
    topPlayerIds: topScores.map((score) => score.playerId)
  },
  finalTop3: topScores.map((score, index) => ({
    playerId: score.playerId,
    rank: index + 1,
    score: Math.round(score.score * 100) / 100,
    scoreBreakdown: score.scoreBreakdown
  }))
});
