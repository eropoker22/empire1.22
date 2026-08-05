import type { ActionCommand } from "./action-command";

export interface SendCityChatMessagePayload {
  body: string;
}

export type SendCityChatMessageCommand = ActionCommand<"send-city-chat-message", SendCityChatMessagePayload>;
