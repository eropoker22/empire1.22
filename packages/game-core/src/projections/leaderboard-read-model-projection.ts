import type { LeaderboardEntryView, LeaderboardReadModel, PlayerId } from "@empire/shared-types";
import type { GameCoreContext } from "../engine/context";
import type { CoreGameState } from "../entities";
import { compareFinalEmpireScores, createPlayerFinalEmpireScore } from "../rules/victory/finalEmpireScore";

const DEFAULT_LIMIT = 20;

export const createLeaderboardReadModel = (
  state: CoreGameState,
  currentPlayerId: PlayerId,
  context: GameCoreContext,
  options: { offset?: number; limit?: number } = {}
): LeaderboardReadModel => {
  const offset = Math.max(0, Math.floor(Number(options.offset ?? 0)));
  const limit = Math.max(1, Math.min(100, Math.floor(Number(options.limit ?? DEFAULT_LIMIT))));
  const ranking = state.root.playerIds
    .filter((playerId) => {
      const status = state.playersById[playerId]?.status;
      return status === "active" || status === "defeated";
    })
    .map((playerId) => createPlayerFinalEmpireScore(state, playerId, context))
    .sort(compareFinalEmpireScores);
  const entries = ranking.map((score, index) => createEntry(state, score, index + 1, currentPlayerId));
  return {
    scoreMode: "final_empire_score",
    generatedAt: context.clock?.nowIso() ?? new Date(0).toISOString(),
    generatedAtTick: state.root.tick,
    offset,
    limit,
    totalPlayers: entries.length,
    entries: entries.slice(offset, offset + limit),
    currentPlayer: entries.find((entry) => entry.playerId === currentPlayerId) ?? null
  };
};

const createEntry = (
  state: CoreGameState,
  score: ReturnType<typeof createPlayerFinalEmpireScore>,
  rank: number,
  currentPlayerId: PlayerId
): LeaderboardEntryView => {
  const player = state.playersById[score.playerId]!;
  const alliance = player.allianceId ? state.alliancesById[player.allianceId] : null;
  const previousRank = Number(player.metadata?.leaderboardPreviousRank);
  return {
    rank,
    playerId: score.playerId,
    name: player.name,
    factionId: player.factionId,
    allianceTag: alliance?.status === "active" ? alliance.tag : null,
    controlledDistricts: score.controlledDistricts,
    influence: Math.max(0, Number(score.scoreBreakdown.districtInfluence ?? 0)),
    score: Math.round(score.score * 100) / 100,
    status: player.status === "defeated" ? "defeated" : "active",
    movement: Number.isInteger(previousRank) && previousRank > 0 ? previousRank - rank : null,
    isCurrentPlayer: score.playerId === currentPlayerId
  };
};
