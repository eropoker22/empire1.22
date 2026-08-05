import type { CityChatReadModel, PlayerColorHex } from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import { CITY_CHAT_MAX_MESSAGE_LENGTH, CITY_CHAT_RETENTION } from "../handlers/cityChat";

export const createCityChatReadModel = (
  state: CoreGameState,
  playerId: string
): CityChatReadModel => {
  const player = state.playersById[playerId];
  const canSend = Boolean(player?.status === "active" && player.homeDistrictId);

  return {
    currentPlayerId: playerId,
    messages: Object.values(state.cityChatMessagesById ?? {})
      .sort((left, right) => (
        (Date.parse(left.createdAt) || 0) - (Date.parse(right.createdAt) || 0)
        || left.id.localeCompare(right.id)
      ))
      .slice(-CITY_CHAT_RETENTION)
      .map((message) => {
        const author = state.playersById[message.authorPlayerId];
        return {
          messageId: message.id,
          authorPlayerId: message.authorPlayerId,
          authorName: metadataText(author?.metadata, "displayName") || author?.name || "Hráč",
          authorGangName: metadataText(author?.metadata, "gangName") || author?.name || "Neznámý gang",
          authorColor: (author?.color || "#facc15") as PlayerColorHex,
          body: message.body,
          createdAt: message.createdAt
        };
      }),
    canSend,
    disabledReason: canSend ? null : "Nejdřív vyber svůj startovní district.",
    maxMessageLength: CITY_CHAT_MAX_MESSAGE_LENGTH
  };
};

const metadataText = (
  metadata: Record<string, unknown> | undefined,
  key: string
): string | null => {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 80) : null;
};
