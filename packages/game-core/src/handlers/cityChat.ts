import type { CityChatMessage, SendCityChatMessageCommand } from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import type { CoreError } from "../errors";
import { CORE_EVENT_TYPES, createEvent, type CoreEvent } from "../events";
import type { GameCoreContext } from "../engine/context";

export const CITY_CHAT_MAX_MESSAGE_LENGTH = 240;
export const CITY_CHAT_RETENTION = 100;
const CITY_CHAT_RATE_LIMIT_MS = 2_000;

type CityChatResult = {
  nextState: CoreGameState;
  events: CoreEvent[];
  errors: CoreError[];
};

export const handleSendCityChatMessage = (
  state: CoreGameState,
  command: SendCityChatMessageCommand,
  context: GameCoreContext
): CityChatResult => {
  const player = state.playersById[command.playerId];
  if (!player || player.status !== "active") {
    return rejected(state, "CITY_CHAT_NOT_ALLOWED", "Městský chat je dostupný jen aktivním hráčům.");
  }

  const body = normalizeCityChatBody(command.payload.body);
  if (!body) return rejected(state, "CITY_CHAT_EMPTY", "Napiš zprávu do městského chatu.");
  if (body.length > CITY_CHAT_MAX_MESSAGE_LENGTH) {
    return rejected(state, "CITY_CHAT_TOO_LONG", `Zpráva může mít nejvýše ${CITY_CHAT_MAX_MESSAGE_LENGTH} znaků.`);
  }

  const nowIso = context.clock?.nowIso?.() ?? new Date().toISOString();
  if (!canSendCityChatMessage(state, player.id, nowIso)) {
    return rejected(state, "CITY_CHAT_RATE_LIMITED", "Další zprávu můžeš poslat za dvě sekundy.");
  }

  const message: CityChatMessage = {
    id: `city-chat:${command.id}`,
    authorPlayerId: player.id,
    body,
    createdAt: nowIso,
    version: 1
  };
  const messages = [...Object.values(state.cityChatMessagesById ?? {}), message]
    .sort(compareCityChatMessages)
    .slice(-CITY_CHAT_RETENTION);

  return {
    nextState: {
      ...state,
      cityChatMessagesById: Object.fromEntries(messages.map((entry) => [entry.id, entry])),
      root: { ...state.root, version: state.root.version + 1 }
    },
    events: [createEvent(CORE_EVENT_TYPES.cityChatMessageSent, {
      messageId: message.id,
      authorPlayerId: player.id
    })],
    errors: []
  };
};

const normalizeCityChatBody = (value: unknown): string =>
  String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();

const canSendCityChatMessage = (
  state: CoreGameState,
  playerId: string,
  nowIso: string
): boolean => {
  const now = Date.parse(nowIso);
  const lastMessageAt = Object.values(state.cityChatMessagesById ?? {})
    .filter((message) => message.authorPlayerId === playerId)
    .reduce((latest, message) => Math.max(latest, Date.parse(message.createdAt) || 0), 0);
  return !Number.isFinite(now) || now - lastMessageAt >= CITY_CHAT_RATE_LIMIT_MS;
};

const compareCityChatMessages = (left: CityChatMessage, right: CityChatMessage): number =>
  (Date.parse(left.createdAt) || 0) - (Date.parse(right.createdAt) || 0)
  || left.id.localeCompare(right.id);

const rejected = (
  state: CoreGameState,
  code: string,
  message: string
): CityChatResult => ({
  nextState: state,
  events: [],
  errors: [{ code, message } as CoreError]
});
