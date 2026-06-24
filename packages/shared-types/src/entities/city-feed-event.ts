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

export type CityFeedCategory = "combat" | "police" | "economy" | "rumor" | "district" | "system" | "atmosphere";
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
export type RumorConfidence =
  | "confirmed"
  | "credible"
  | "suspicion"
  | "rumor"
  | "false_possible";
export type RumorAudience =
  | "current_player"
  | "alliance"
  | "selected_district"
  | "global_city"
  | "police";
export type RumorCategory =
  | "population_movement"
  | "weapons_materials"
  | "district_defense"
  | "attack_activity"
  | "espionage"
  | "heist_robbery"
  | "economy"
  | "police_heat"
  | "alliance_activity"
  | "market"
  | "downtown_power"
  | "final_lockdown"
  | "atmosphere";
export type RumorIntensityBand = "low" | "medium" | "high";
export type RumorAgeBand = "fresh" | "recent" | "stale";
export type RumorDirection = "increasing" | "decreasing" | "stable" | "unknown";

export interface SafeRumorSignal {
  sourceEventId: string;
  category: RumorCategory;
  districtId?: DistrictId;
  zoneId?: string;
  actorPlayerId?: PlayerId;
  actorAllianceId?: string;
  actorVisibility: "hidden" | "player" | "alliance";
  intensityBand: RumorIntensityBand;
  ageBand: RumorAgeBand;
  direction: RumorDirection;
  confidence: RumorConfidence;
  occurredAt: string;
  expiresAt: string;
  sourceBuildingType?: string;
  marketCategory?: string;
}

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
  expiresAtTick?: number;
  freshness?: RumorAgeBand;
  priority?: number;
  audience?: RumorAudience;
  confidence?: RumorConfidence;
  rumorCategory?: RumorCategory;
  templateId?: string;
  actorPlayerId?: PlayerId;
  actorAllianceId?: string;
  sourceBuildingType?: string;
  message: string;
  messageKey?: string;
  payload?: Record<string, unknown>;
}
