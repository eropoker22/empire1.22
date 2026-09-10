import type { PlayerFactionId } from "../entities/faction";
import type { PlayerId } from "../ids/entity-id";
import type { FinalLockdownStatus } from "../entities/victory-state";

export interface FinalLockdownLeaderboardEntryView {
  playerId: PlayerId;
  playerName: string;
  factionId: PlayerFactionId;
  score: number;
  rank: number;
  controlledDistricts: number;
  downtownDistricts: number;
  activeBuildings: number;
  heat: number;
  isCurrentPlayer: boolean;
  scoreBreakdown: Record<string, number>;
}

export interface FinalLockdownCurrentPlayerView {
  controlledDistricts: number;
  downtownDistricts: number;
  activeBuildings: number;
  heat: number;
  heatPenalty: number;
  scoreBreakdown: Record<string, number>;
}

export interface FinalLockdownReadModel {
  startConditions?: {
    registrationClosed: boolean; registrationClosesAt: string | null; registrationBaselinePlayers: number | null;
    effectiveSurvivorThreshold: number | null; activePlayers: number;
    earliestStartTick: number | null; latestStartTick: number | null;
    waitingFor: "registration" | "earliest_start" | "survivors" | "confirmation";
    singleSurvivorMayStartEarly: boolean;
  };
  pauseDuringQuietHours?: boolean;
  result?: { endedAt: string; winnerPlayerId: PlayerId | null; currentPlayerRank: number | null;
    ranking: Array<{ playerId: PlayerId; playerName: string; rank: number; score: number }> } | null;
  currentPlayerScoreContributions?: Record<string, number> | null;
  startRuleDescription?: string;
  enabled: boolean;
  status: FinalLockdownStatus;
  active: boolean;
  pausedByQuietHours: boolean;
  startedAtTick: number | null;
  activeElapsedTicks: number;
  activeDurationTicks: number;
  remainingActiveTicks: number;
  topRankCount: number;
  currentPlayerRank: number | null;
  currentPlayerFinalScore: number | null;
  currentPlayer: FinalLockdownCurrentPlayerView | null;
  currentPlayerScoreBreakdown: Record<string, number> | null;
  scoreGapToTop3: number | null;
  scoreGapToFirst: number | null;
  leaderboardTop3: FinalLockdownLeaderboardEntryView[];
  quietHoursResumeTick: number | null;
  endsAtEstimatedTick: number | null;
}
