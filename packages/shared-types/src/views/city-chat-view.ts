import type { PlayerColorHex } from "../entities/player-color";
import type { PlayerId } from "../ids/entity-id";

export interface CityChatMessageView {
  messageId: string;
  authorPlayerId: PlayerId;
  authorName: string;
  authorGangName: string;
  authorColor: PlayerColorHex;
  body: string;
  createdAt: string;
}

export interface CityChatReadModel {
  currentPlayerId: PlayerId;
  messages: CityChatMessageView[];
  canSend: boolean;
  disabledReason: string | null;
  maxMessageLength: number;
}
