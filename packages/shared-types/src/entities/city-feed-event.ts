import type { DistrictId, PlayerId } from "../ids/entity-id";

export type CityFeedSourceType =
  | "attack"
  | "spy"
  | "district_capture"
  | "police_warning"
  | "police_raid"
  | "market"
  | "building_action"
  | "robbery"
  | "trap"
  | "system";

export type CityFeedCategory = "combat" | "police" | "economy" | "rumor" | "district" | "system";
export type CityFeedSeverity = "low" | "medium" | "high" | "extreme";
export type CityFeedTruthiness = "confirmed" | "unconfirmed" | "false_possible";
export type CityFeedVisibility = "all" | "player" | "faction" | "alliance" | "admin";
export type CityFeedIntelType =
  | "confirmed_event"
  | "rumor"
  | "suspicion"
  | "scandal"
  | "warning"
  | "false_lead";

/**
 * Responsibility: Shared UI-safe event contract for city news and rumors.
 * Belongs here: public feed metadata, visibility, source idempotency, and safe text.
 * Does not belong here: combat, market, police, or ownership mutation rules.
 */
export interface CityFeedEvent {
  id: string;
  sourceEventId?: string;
  sourceType: CityFeedSourceType;
  category: CityFeedCategory;
  severity: CityFeedSeverity;
  truthiness: CityFeedTruthiness;
  intelType?: CityFeedIntelType;
  visibility: CityFeedVisibility;
  playerId?: PlayerId;
  targetPlayerId?: PlayerId;
  districtId?: DistrictId;
  zone?: string;
  createdAtTick: number;
  message: string;
  messageKey?: string;
  payload?: Record<string, unknown>;
}
