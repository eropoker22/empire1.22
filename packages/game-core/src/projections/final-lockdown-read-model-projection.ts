import type { FinalLockdownReadModel, PlayerId } from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import type { GameCoreContext } from "../engine/context";
import {
  estimateFinalLockdownEndTick,
  resolveFinalLockdownQuietHoursResumeTick
} from "../rules/victory/finalLockdownLifecycle";
import { createFinalEmpireRanking } from "../rules/victory/finalEmpireScore";

export const createFinalLockdownReadModel = (
  state: CoreGameState,
  playerId: PlayerId,
  context?: GameCoreContext
): FinalLockdownReadModel => {
  const config = context?.config.balance.finalLockdown;
  if (!config?.enabled || !context) {
    return {
      enabled: false,
      status: "inactive",
      active: false,
      pausedByQuietHours: false,
      startedAtTick: null,
      activeElapsedTicks: 0,
      activeDurationTicks: 0,
      remainingActiveTicks: 0,
      topRankCount: 0,
      currentPlayerRank: null,
      currentPlayerFinalScore: null,
      currentPlayer: null,
      currentPlayerScoreBreakdown: null,
      scoreGapToTop3: null,
      scoreGapToFirst: null,
      leaderboardTop3: [],
      quietHoursResumeTick: null,
      endsAtEstimatedTick: null
    };
  }

  const finalState = state.finalLockdownState;
  const ranking = createFinalEmpireRanking(state, context);
  const currentPlayerIndex = ranking.findIndex((score) => score.playerId === playerId);
  const currentPlayerScore = currentPlayerIndex >= 0 ? ranking[currentPlayerIndex] : null;
  const topRankCount = Math.max(1, Math.floor(Number(config.topRankCount || 3)));
  const pausedByQuietHours = finalState?.pausedByQuietHours ?? false;
  const top3Threshold = ranking[Math.min(topRankCount, ranking.length) - 1] ?? null;
  const firstPlace = ranking[0] ?? null;

  return {
    enabled: true,
    status: finalState?.status ?? "inactive",
    active: finalState?.status === "active" || finalState?.status === "paused",
    pausedByQuietHours,
    startedAtTick: finalState?.startedAtTick ?? null,
    activeElapsedTicks: finalState?.activeElapsedTicks ?? 0,
    activeDurationTicks: finalState?.activeDurationTicks ?? config.activeDurationTicks,
    remainingActiveTicks: finalState?.remainingActiveTicks ?? config.activeDurationTicks,
    topRankCount,
    currentPlayerRank: currentPlayerIndex >= 0 ? currentPlayerIndex + 1 : null,
    currentPlayerFinalScore: currentPlayerScore ? roundScore(currentPlayerScore.score) : null,
    currentPlayer: currentPlayerScore
      ? {
          controlledDistricts: currentPlayerScore.controlledDistricts,
          downtownDistricts: currentPlayerScore.downtownDistricts,
          activeBuildings: currentPlayerScore.activeBuildings,
          heat: currentPlayerScore.heat,
          heatPenalty: roundScore(currentPlayerScore.heatPenalty),
          scoreBreakdown: currentPlayerScore.scoreBreakdown
        }
      : null,
    currentPlayerScoreBreakdown: currentPlayerScore?.scoreBreakdown ?? null,
    scoreGapToTop3: currentPlayerScore && top3Threshold && currentPlayerIndex + 1 > topRankCount
      ? roundScore(Math.max(0, top3Threshold.score - currentPlayerScore.score + 1))
      : currentPlayerScore
        ? 0
        : null,
    scoreGapToFirst: currentPlayerScore && firstPlace
      ? roundScore(Math.max(0, firstPlace.score - currentPlayerScore.score + (firstPlace.playerId === playerId ? 0 : 1)))
      : null,
    leaderboardTop3: ranking.slice(0, topRankCount).map((score, index) => ({
      playerId: score.playerId,
      playerName: score.playerName,
      factionId: score.factionId,
      score: roundScore(score.score),
      rank: index + 1,
      controlledDistricts: score.controlledDistricts,
      downtownDistricts: score.downtownDistricts,
      activeBuildings: score.activeBuildings,
      heat: score.heat,
      isCurrentPlayer: score.playerId === playerId,
      scoreBreakdown: score.scoreBreakdown
    })),
    quietHoursResumeTick: pausedByQuietHours
      ? resolveFinalLockdownQuietHoursResumeTick(state, context)
      : null,
    endsAtEstimatedTick: estimateFinalLockdownEndTick(state, context)
  };
};

const roundScore = (value: number): number =>
  Math.round(value * 100) / 100;
