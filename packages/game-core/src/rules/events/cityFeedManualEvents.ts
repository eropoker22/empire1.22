import type {
  CityFeedCategory,
  CityFeedEvent,
  CityFeedIntelType,
  CityFeedSeverity,
  CityFeedSourceType,
  CityFeedTruthiness,
  CityFeedVisibility
} from "@empire/shared-types";

export interface CreateCityFeedEventInput {
  sourceEventId: string;
  sourceType: CityFeedSourceType;
  category: CityFeedCategory;
  severity?: CityFeedSeverity;
  truthiness?: CityFeedTruthiness;
  intelType?: CityFeedIntelType;
  visibility?: CityFeedVisibility;
  playerId?: string;
  targetPlayerId?: string;
  districtId?: string;
  zone?: string;
  createdAtTick: number;
  message?: string;
  messageKey?: string;
  payload?: Record<string, unknown>;
}

export const createCityFeedEvent = (input: CreateCityFeedEventInput): CityFeedEvent => {
  const sourceEventId = safeKey(input.sourceEventId || `${input.sourceType}:${input.createdAtTick}`);
  const messageKey = input.messageKey || input.sourceType;
  return {
    id: `city-feed:${sourceEventId}`,
    sourceEventId,
    sourceType: input.sourceType,
    category: input.category,
    severity: input.severity || "low",
    truthiness: input.truthiness || "unconfirmed",
    intelType: input.intelType || (input.truthiness === "confirmed" ? "confirmed_event" : "rumor"),
    visibility: input.visibility || "all",
    playerId: input.playerId,
    targetPlayerId: input.targetPlayerId,
    districtId: input.districtId,
    zone: input.zone,
    createdAtTick: Math.max(0, Math.floor(Number(input.createdAtTick || 0))),
    message: input.message || "",
    messageKey: `rumor.${messageKey}`,
    payload: input.payload
  };
};

export const createMarketCityFeedEvent = (input: {
  sourceEventId: string;
  playerId?: string;
  createdAtTick: number;
  severity?: CityFeedSeverity;
  payload?: Record<string, unknown>;
}): CityFeedEvent =>
  createCityFeedEvent({
    ...input,
    sourceType: "market",
    category: "economy",
    truthiness: "unconfirmed",
    intelType: "rumor",
    messageKey: "black_market"
  });

export const createRobberyCityFeedEvent = (input: {
  sourceEventId: string;
  playerId?: string;
  targetPlayerId?: string;
  districtId?: string;
  createdAtTick: number;
  severity?: CityFeedSeverity;
  payload?: Record<string, unknown>;
}): CityFeedEvent =>
  createCityFeedEvent({
    ...input,
    sourceType: "robbery",
    category: "rumor",
    truthiness: "unconfirmed",
    intelType: "rumor",
    messageKey: "robbery"
  });

export const createTrapCityFeedEvent = (input: {
  sourceEventId: string;
  playerId?: string;
  districtId?: string;
  createdAtTick: number;
  payload?: Record<string, unknown>;
}): CityFeedEvent =>
  createCityFeedEvent({
    sourceEventId: `atmosphere:${input.districtId || "city"}:${input.createdAtTick}`,
    sourceType: "system",
    category: "atmosphere",
    severity: "low",
    truthiness: "unconfirmed",
    intelType: "rumor",
    visibility: "all",
    playerId: input.playerId,
    districtId: input.districtId,
    createdAtTick: input.createdAtTick,
    messageKey: "atmosphere",
    payload: { rumorCategory: "atmosphere" }
  });

const safeKey = (value: string): string =>
  String(value || "event")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9:._-]/g, "");

