import * as crypto from "node:crypto";

export const PLAYER_ENTRY_POLICY = Object.freeze({
  allowRejoinAfterEarlyLeave: false,
  earlyLeaveWindowMs: 60 * 60 * 1000
});

export const PLAYER_FACTIONS = [
  "mafian", "kartel", "kult", "tajna-organizace", "hackeri", "motorkarsky-gang", "soukroma-armada", "korporace"
] as const;

export const PLAYER_GANG_COLORS = [
  "#22d3ee", "#3b82f6", "#8b5cf6", "#ec4899", "#ef4444", "#f97316", "#eab308", "#22c55e"
] as const;

const AVATAR_COUNTS: Record<string, number> = {
  mafian: 9,
  kartel: 9,
  kult: 9,
  "tajna-organizace": 9,
  hackeri: 9,
  "motorkarsky-gang": 9,
  "soukroma-armada": 9,
  korporace: 9
};

export const isPlayerFaction = (value: string): boolean => (PLAYER_FACTIONS as readonly string[]).includes(value);

export const isPlayerAvatar = (factionId: string, avatarId: string): boolean => {
  const match = /^([a-z0-9-]+):([1-9][0-9]?)$/u.exec(avatarId);
  return Boolean(match && match[1] === factionId && Number(match[2]) <= (AVATAR_COUNTS[factionId] ?? 0));
};

export const isPlayerGangColor = (value: string): boolean =>
  (PLAYER_GANG_COLORS as readonly string[]).includes(value.toLowerCase());

export const normalizePlayerUsername = (value: string): string =>
  value.normalize("NFKC").trim().toLocaleLowerCase("en-US");

export const validPlayerUsername = (value: string): boolean => /^[\p{L}\p{N}_-]{3,32}$/u.test(value);
export const validGangName = (value: string): boolean => value.length >= 2 && value.length <= 40 && !/[<>\u0000-\u001f\u007f]/u.test(value);

export const hashEntryRequest = (value: unknown): string =>
  crypto.createHash("sha256").update(JSON.stringify(sort(value))).digest("hex");

export const createServerPlayerId = (serverInstanceId: string, accountId: string): string =>
  `player:${crypto.createHash("sha256").update(`${serverInstanceId}:${accountId}`).digest("hex").slice(0, 24)}`;

const sort = (value: unknown): unknown => Array.isArray(value) ? value.map(sort)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, sort(item)]))
    : value;
