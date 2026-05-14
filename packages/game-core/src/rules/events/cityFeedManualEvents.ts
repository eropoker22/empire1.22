import { resolveRumorTemplate, type RumorTextTemplateKey } from "@empire/game-config";
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
  messageKey?: RumorTextTemplateKey;
  payload?: Record<string, unknown>;
}

export const createCityFeedEvent = (input: CreateCityFeedEventInput): CityFeedEvent => {
  const sourceEventId = safeKey(input.sourceEventId || `${input.sourceType}:${input.createdAtTick}`);
  const messageKey = input.messageKey || resolveDefaultMessageKey(input.sourceType);
  const district = input.districtId || "jedné z horkých čtvrtí";
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
    message: input.message || resolveRumorTemplate(messageKey, hashText(sourceEventId), { district }),
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
    ...input,
    sourceType: "trap",
    category: "rumor",
    severity: "low",
    truthiness: "false_possible",
    intelType: "suspicion",
    messageKey: "trap"
  });

const resolveDefaultMessageKey = (sourceType: CityFeedSourceType): RumorTextTemplateKey => {
  if (sourceType === "police_raid") return "police_raid";
  if (sourceType === "police_warning") return "police_warning";
  if (sourceType === "district_capture") return "district_capture";
  if (sourceType === "trap") return "trap";
  if (sourceType === "robbery") return "robbery";
  if (sourceType === "market") return "black_market";
  if (sourceType === "attack") return "attack_success";
  return "police_warning";
};

const safeKey = (value: string): string =>
  String(value || "event")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9:._-]/g, "");

const hashText = (value: string): number =>
  Array.from(value).reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 0);
