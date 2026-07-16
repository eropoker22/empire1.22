import type { PlayerFactionId } from "../entities/faction";
import type { PlayerId } from "../ids/entity-id";

export interface LeaderboardEntryView {
  rank: number;
  playerId: PlayerId;
  name: string;
  factionId: PlayerFactionId;
  allianceTag: string | null;
  controlledDistricts: number;
  influence: number;
  score: number;
  status: "active" | "defeated";
  movement: number | null;
  isCurrentPlayer: boolean;
}

export interface LeaderboardReadModel {
  scoreMode: "final_empire_score";
  generatedAt: string;
  generatedAtTick: number;
  offset: number;
  limit: number;
  totalPlayers: number;
  entries: LeaderboardEntryView[];
  currentPlayer: LeaderboardEntryView | null;
}
