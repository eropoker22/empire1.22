import type { PlayerId } from "../ids/entity-id";
import type { PlayerStatus } from "../entities/player";

export type EliminationRiskStatus = "safe" | "danger" | "critical" | "defeated";

export interface EliminationDangerZoneEntry {
  playerId: PlayerId;
  playerName: string;
  rankFromBottom: number;
  score: number;
  controlledDistricts: number;
  controlPercent: number;
  isCurrentPlayer: boolean;
}

export interface EliminationQuietHoursView {
  enabled: boolean;
  timeZone: string;
  startHour: number;
  endHour: number;
  behavior: "defer_to_window_end";
}

export interface EliminationReadModel {
  enabled: boolean;
  firstEliminationTick: number;
  intervalTicks: number;
  minActivePlayers: number;
  nextEliminationTick: number | null;
  ticksUntilNextElimination: number | null;
  eliminationsStopped: boolean;
  quietHours: EliminationQuietHoursView | null;
  isQuietHoursNow: boolean;
  quietHoursResumeTick: number | null;
  deferredFromTick: number | null;
  eliminatedPlayerIds: PlayerId[];
  activePlayersRemaining: number;
  dangerZone: EliminationDangerZoneEntry[];
  currentPlayerStatus: EliminationRiskStatus;
  currentPlayerScore: number | null;
  currentPlayerRankFromBottom: number | null;
  currentPlayerScoreBreakdown: Record<string, number> | null;
  playerStatus: PlayerStatus | null;
  lastElimination: {
    playerId: PlayerId;
    playerName: string;
    eliminatedAtTick: number;
    finalPlacement: number;
  } | null;
}
