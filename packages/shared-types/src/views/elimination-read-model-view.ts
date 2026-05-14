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

export interface EliminationReadModel {
  enabled: boolean;
  intervalTicks: number;
  nextEliminationTick: number | null;
  ticksUntilNextElimination: number | null;
  eliminatedPlayerIds: PlayerId[];
  activePlayersRemaining: number;
  dangerZone: EliminationDangerZoneEntry[];
  currentPlayerStatus: EliminationRiskStatus;
  currentPlayerScore: number | null;
  currentPlayerRankFromBottom: number | null;
  playerStatus: PlayerStatus | null;
  lastElimination: {
    playerId: PlayerId;
    playerName: string;
    eliminatedAtTick: number;
    finalPlacement: number;
  } | null;
}
