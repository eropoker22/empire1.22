import type { EliminationReadModel, PlayerId } from "@empire/shared-types";
import type { GameCoreContext } from "../engine/context";
import type { CoreGameState } from "../entities";
import { compareEliminationScores, createPlayerEliminationScore } from "../rules/elimination/eliminationScore";
import { resolveEliminationConfig, resolveNextEliminationTick } from "../rules/elimination/eliminationConfig";

export const createEliminationReadModel = (
  state: CoreGameState,
  playerId: PlayerId,
  context?: GameCoreContext
): EliminationReadModel => {
  const config = context ? resolveEliminationConfig(context.config) : null;
  const activePlayerIds = state.root.playerIds.filter((id) => state.playersById[id]?.status === "active");
  const player = state.playersById[playerId] ?? null;
  if (!config?.enabled || !context) {
    return createDisabledReadModel(state, playerId, activePlayerIds.length);
  }

  const scores = activePlayerIds
    .map((id) => createPlayerEliminationScore(state, id, context))
    .sort(compareEliminationScores);
  const currentPlayerIndex = scores.findIndex((score) => score.playerId === playerId);
  const currentScore = currentPlayerIndex >= 0 ? scores[currentPlayerIndex] : null;
  const eliminationsStopped = activePlayerIds.length <= config.minActivePlayers;
  const nextEliminationTick = eliminationsStopped
    ? null
    : state.eliminationState?.nextEliminationTick
      ?? resolveNextEliminationTick(config, state.eliminationState?.lastEliminationTick ?? null);
  const ticksUntilNext = nextEliminationTick === null ? null : Math.max(0, nextEliminationTick - state.root.tick);
  const dangerZoneSize = eliminationsStopped ? 0 : Math.max(0, config.dangerZoneSize);

  return {
    enabled: true,
    intervalTicks: config.intervalTicks,
    nextEliminationTick,
    ticksUntilNextElimination: ticksUntilNext,
    eliminatedPlayerIds: state.eliminationState?.eliminatedPlayerIds ?? [],
    activePlayersRemaining: activePlayerIds.length,
    dangerZone: scores.slice(0, dangerZoneSize).map((score, index) => ({
      playerId: score.playerId,
      playerName: score.playerName,
      rankFromBottom: index + 1,
      score: Math.round(score.score * 100) / 100,
      controlledDistricts: score.controlledDistricts,
      controlPercent: calculateControlPercent(state, score.playerId),
      isCurrentPlayer: score.playerId === playerId
    })),
    currentPlayerStatus: resolveRiskStatus(player?.status ?? null, currentPlayerIndex, dangerZoneSize),
    currentPlayerScore: currentScore ? Math.round(currentScore.score * 100) / 100 : null,
    currentPlayerRankFromBottom: currentPlayerIndex >= 0 ? currentPlayerIndex + 1 : null,
    playerStatus: player?.status ?? null,
    lastElimination: createLastElimination(state)
  };
};

const createDisabledReadModel = (
  state: CoreGameState,
  playerId: PlayerId,
  activePlayersRemaining: number
): EliminationReadModel => ({
  enabled: false,
  intervalTicks: 0,
  nextEliminationTick: null,
  ticksUntilNextElimination: null,
  eliminatedPlayerIds: state.eliminationState?.eliminatedPlayerIds ?? [],
  activePlayersRemaining,
  dangerZone: [],
  currentPlayerStatus: state.playersById[playerId]?.status === "defeated" ? "defeated" : "safe",
  currentPlayerScore: null,
  currentPlayerRankFromBottom: null,
  playerStatus: state.playersById[playerId]?.status ?? null,
  lastElimination: createLastElimination(state)
});

const resolveRiskStatus = (
  status: string | null,
  rankIndex: number,
  dangerZoneSize: number
): EliminationReadModel["currentPlayerStatus"] => {
  if (status === "defeated") return "defeated";
  if (rankIndex < 0) return "safe";
  if (rankIndex === 0) return "critical";
  if (rankIndex < dangerZoneSize) return "danger";
  return "safe";
};

const calculateControlPercent = (state: CoreGameState, playerId: PlayerId): number => {
  const activeDistricts = Object.values(state.districtsById).filter((district) => district.status !== "destroyed");
  if (activeDistricts.length <= 0) return 0;
  const controlled = activeDistricts.filter((district) => district.ownerPlayerId === playerId).length;
  return Math.round((controlled / activeDistricts.length) * 10000) / 100;
};

const createLastElimination = (state: CoreGameState): EliminationReadModel["lastElimination"] => {
  const playerId = state.eliminationState?.lastEliminatedPlayerId;
  if (!playerId) return null;
  const player = state.playersById[playerId];
  return {
    playerId,
    playerName: player?.name ?? playerId,
    eliminatedAtTick: Number(player?.metadata?.eliminatedAtTick ?? state.eliminationState?.lastEliminationTick ?? 0),
    finalPlacement: Number(player?.metadata?.finalPlacement ?? 0)
  };
};
