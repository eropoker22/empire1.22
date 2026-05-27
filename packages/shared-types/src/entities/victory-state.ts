import type {
  AllianceId,
  MatchResultId,
  PlayerId,
  ServerInstanceId
} from "../ids/entity-id";

/**
 * Responsibility: Shared contract for live victory progress and final instance results.
 * Belongs here: status, leader references, ranking summaries, and end reason.
 * Does not belong here: hidden tie-break internals or win prediction caches.
 */
export interface VictoryState {
  id: string;
  serverInstanceId: ServerInstanceId;
  status: VictoryStatus;
  victoryType: string;
  leaderPlayerId: PlayerId | null;
  leaderAllianceId: AllianceId | null;
  progressPayload: Record<string, unknown>;
  resolvedAtTick: number | null;
  version: number;
}

export interface MatchResult {
  id: MatchResultId;
  serverInstanceId: ServerInstanceId;
  endedAt: string;
  winnerPlayerId: PlayerId | null;
  winnerAllianceId: AllianceId | null;
  ranking: MatchRankingEntry[];
  reason: string;
}

export interface MatchRankingEntry {
  subjectType: "player" | "alliance";
  subjectId: string;
  rank: number;
  score: number;
  scoreBreakdown?: Record<string, unknown>;
}

export type VictoryStatus = "ongoing" | "locked" | "resolved";

export type FinalLockdownStatus = "inactive" | "active" | "paused" | "resolved";

export interface FinalLockdownState {
  id: string;
  serverInstanceId: ServerInstanceId;
  status: FinalLockdownStatus;
  startedAtTick: number | null;
  activeElapsedTicks: number;
  activeDurationTicks: number;
  remainingActiveTicks: number;
  lastUpdatedTick: number;
  pausedByQuietHours: boolean;
  resolvedAtTick: number | null;
  finalTopPlayerIds: PlayerId[];
  version: number;
}
