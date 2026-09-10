import type { AllianceChatMessage } from "@empire/shared-types";
import type { CoreGameState } from "../entities";

const ALLIANCE_CHAT_RATE_LIMIT_MS = 2_000;
const ALLIANCE_CHAT_RETENTION = 100;

export const normalizeAllianceChatBody = (value: unknown): string =>
  String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const appendRetainedAllianceMessage = (
  state: CoreGameState,
  message: AllianceChatMessage
): CoreGameState["allianceChatMessagesById"] => {
  const allMessages = [...Object.values(state.allianceChatMessagesById ?? {}), message];
  const retainedIds = new Set(allMessages
    .filter((entry) => entry.allianceId === message.allianceId)
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    .slice(0, ALLIANCE_CHAT_RETENTION)
    .map((entry) => entry.id));
  return Object.fromEntries(allMessages.filter((entry) =>
    entry.allianceId !== message.allianceId || retainedIds.has(entry.id)
  ).map((entry) => [entry.id, entry]));
};

export const validateAllianceChatRate = (
  state: CoreGameState,
  allianceId: string,
  playerId: string,
  nowIso: string
): boolean => {
  const now = Date.parse(nowIso);
  const lastMessageAt = Object.values(state.allianceChatMessagesById ?? {})
    .filter((message) => message.allianceId === allianceId && message.authorPlayerId === playerId)
    .reduce((latest, message) => Math.max(latest, Date.parse(message.createdAt) || 0), 0);
  return !Number.isFinite(now) || now - lastMessageAt >= ALLIANCE_CHAT_RATE_LIMIT_MS;
};

