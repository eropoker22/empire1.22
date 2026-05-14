import type { EliminationReadModel, PlayerId } from "@empire/shared-types";
import type { GameCoreContext } from "../engine/context";
import type { CoreGameState } from "../entities";
import { compareEliminationScores, createPlayerEliminationScore } from "../rules/elimination/eliminationScore";
import {
  isTickInEliminationQuietHours,
  resolveEliminationConfig,
  resolveNextEliminationTick,
  resolveQuietHoursResumeTick
} from "../rules/elimination/eliminationConfig";

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
  const rawNextEliminationTick = eliminationsStopped
    ? null
    : state.eliminationState?.nextEliminationTick
      ?? resolveNextEliminationTick(config, state.eliminationState?.lastEliminationTick ?? null);
  const quietHoursResumeTick = resolveReadModelQuietHoursResumeTick(state, config, rawNextEliminationTick, context);
  const nextEliminationTick = rawNextEliminationTick === null ? null : quietHoursResumeTick ?? rawNextEliminationTick;
  const ticksUntilNext = nextEliminationTick === null ? null : Math.max(0, nextEliminationTick - state.root.tick);
  const dangerZoneSize = eliminationsStopped ? 0 : Math.max(0, config.dangerZoneSize);
  const isQuietHoursNow = isTickInEliminationQuietHours(state, config, state.root.tick, context.config.tickRateMs);

  return {
    enabled: true,
    firstEliminationTick: config.firstEliminationTick,
    intervalTicks: config.intervalTicks,
    minActivePlayers: config.minActivePlayers,
    nextEliminationTick,
    ticksUntilNextElimination: ticksUntilNext,
    eliminationsStopped,
    quietHours: config.quietHours ?? null,
    isQuietHoursNow,
    quietHoursResumeTick: isQuietHoursNow
      ? resolveQuietHoursResumeTick(state, config, state.root.tick, context.config.tickRateMs)
      : quietHoursResumeTick,
    deferredFromTick: state.eliminationState?.deferredFromTick ?? null,
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
  firstEliminationTick: 0,
  intervalTicks: 0,
  minActivePlayers: 0,
  nextEliminationTick: null,
  ticksUntilNextElimination: null,
  eliminationsStopped: false,
  quietHours: null,
  isQuietHoursNow: false,
  quietHoursResumeTick: null,
  deferredFromTick: state.eliminationState?.deferredFromTick ?? null,
  eliminatedPlayerIds: state.eliminationState?.eliminatedPlayerIds ?? [],
  activePlayersRemaining,
  dangerZone: [],
  currentPlayerStatus: state.playersById[playerId]?.status === "defeated" ? "defeated" : "safe",
  currentPlayerScore: null,
  currentPlayerRankFromBottom: null,
  playerStatus: state.playersById[playerId]?.status ?? null,
  lastElimination: createLastElimination(state)
});

const resolveReadModelQuietHoursResumeTick = (
  state: CoreGameState,
  config: NonNullable<ReturnType<typeof resolveEliminationConfig>>,
  nextEliminationTick: number | null,
  context: GameCoreContext
): number | null => {
  if (nextEliminationTick === null) return null;
  if (state.eliminationState?.deferredFromTick !== undefined && state.eliminationState.deferredFromTick !== null) {
    return nextEliminationTick;
  }
  return resolveQuietHoursResumeTick(state, config, nextEliminationTick, context.config.tickRateMs);
};

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
