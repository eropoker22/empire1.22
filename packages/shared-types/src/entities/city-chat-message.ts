import type { PlayerId } from "../ids/entity-id";

export interface CityChatMessage {
  id: string;
  authorPlayerId: PlayerId;
  body: string;
  createdAt: string;
  version: number;
}
