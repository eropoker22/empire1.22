import {
  getRumorTemplates,
  renderRumorContentTemplate,
  type RumorTemplate
} from "@empire/game-config";
import type {
  CityFeedCategory,
  CityFeedEvent,
  CityFeedIntelType,
  CityFeedSeverity,
  CityFeedSourceType,
  CityFeedTruthiness,
  CityFeedVisibility,
  RumorAgeBand,
  RumorAudience,
  RumorCategory,
  RumorConfidence,
  RumorDirection,
  RumorIntensityBand,
  SafeRumorSignal
} from "@empire/shared-types";
import type { LobbyClubBalanceConfig } from "../../contracts";
import type { GameCoreContext } from "../../engine/context";
import type { CoreGameState } from "../../entities";
import { applyDayNightRumorTruthChancePct, shouldGenerateDayNightRumor } from "../day-night/dayNight";
import { deterministicRollPct } from "../../utils/math";
import { getLobbyClubMetadata, getOwnedLobbyClubs } from "../../handlers/lobbyClubMetadata";
import { applyFactionRumorTruthChancePct, getFactionPassiveModifiers } from "../factions/factionRules";

export const CITY_FEED_DEFAULT_LIMIT = 50;

type EventPayload = Record<string, unknown>;

export interface ResolveRumorEventInput {
  id?: string;
  sourceEventId?: string;
  sourceType: CityFeedSourceType;
  category?: CityFeedCategory;
  severity?: CityFeedSeverity;
  truthiness?: CityFeedTruthiness;
  intelType?: CityFeedIntelType;
  visibility?: CityFeedVisibility;
  audience?: RumorAudience;
  confidence?: RumorConfidence;
  rumorCategory?: RumorCategory;
  playerId?: string;
  targetPlayerId?: string;
  actorPlayerId?: string;
  actorAllianceId?: string;
  districtId?: string;
  zone?: string;
  createdAtTick?: number;
  expiresAtTick?: number;
  message?: string;
  messageKey?: string;
  templateId?: string;
  payload?: EventPayload;
  truthChancePct?: number;
  isTrue?: boolean;
  negative?: boolean;
  sourceBuildingType?: string;
  intensityBand?: RumorIntensityBand;
  direction?: RumorDirection;
  marketCategory?: string;
}

export interface RumorPipelineContext {
  config?: GameCoreContext["config"];
  lobbyClubConfig?: LobbyClubBalanceConfig;
  limit?: number;
  seed?: string;
}

export interface ResolvedRumorEvent {
  event: CityFeedEvent | null;
  suppressed: boolean;
  lobbyClubReductionPct: number;
}

export const RUMOR_FEED_CONFIG = Object.freeze({
  recentTemplateSuppressionCount: 8,
  categoryCooldownTicks: 2,
  staleAfterRatio: 0.55,
  defaultExpiresAfterSeconds: 1_800,
  modeExpirationMultiplier: {
    free: 1,
    war: 0.7
  } as Record<string, number>
});

export const resolveRumorEvent = (
  input: ResolveRumorEventInput,
  state: CoreGameState,
  context: RumorPipelineContext = {}
): ResolvedRumorEvent => {
  const lobbyClubReductionPct = resolveLobbyClubNegativeRumorReductionPct({
    state,
    playerId: input.targetPlayerId || input.playerId,
    config: context.lobbyClubConfig,
    tick: state.root.tick
  });
  const signal = projectSafeRumorSignal(input, state, context);

  if (!signal || containsForbiddenTrapHint(input)) {
    return { event: null, suppressed: true, lobbyClubReductionPct };
  }

  const audience = resolveRumorAudience(input, signal);
  const visibility = visibilityForAudience(audience, input.visibility);
  const sourceSeed = context.seed || `${state.serverInstance.worldSeed}:${signal.sourceEventId}:${audience}`;

  if (!isRumorEligible(input, signal, state, context, sourceSeed, lobbyClubReductionPct)) {
    return { event: null, suppressed: true, lobbyClubReductionPct };
  }

  const template = selectRumorTemplate({
    input,
    signal,
    audience,
    state,
    seed: sourceSeed
  });
  if (!template) {
    return { event: null, suppressed: true, lobbyClubReductionPct };
  }

  const createdAtTick = Math.max(0, Math.floor(Number(input.createdAtTick ?? state.root.tick) || 0));
  const expiresAtTick = input.expiresAtTick ?? createdAtTick + resolveExpirationTicks(template, context);
  const sourceEventId = `${signal.sourceEventId}:${audience}:${signal.category}`;
  const message = renderRumorContentTemplate(template, createTemplateContext(signal, template, state));

  return {
    event: {
      id: input.id || `city-feed:${safeKey(sourceEventId)}`,
      sourceEventId,
      sourceType: input.sourceType,
      category: resolveCityFeedCategory(signal, input),
      severity: severityFromIntensity(signal.intensityBand, input.severity),
      truthiness: truthinessFromConfidence(signal.confidence),
      intelType: intelTypeFromConfidence(signal.confidence, signal.category),
      visibility,
      playerId: input.playerId,
      targetPlayerId: input.targetPlayerId,
      districtId: signal.districtId,
      zone: input.zone || signal.zoneId,
      createdAtTick,
      expiresAtTick,
      freshness: "fresh",
      priority: resolvePriority(template, signal),
      audience,
      confidence: signal.confidence,
      rumorCategory: signal.category,
      templateId: template.id,
      actorPlayerId: signal.actorVisibility === "player" ? signal.actorPlayerId : undefined,
      actorAllianceId: signal.actorVisibility === "alliance" ? signal.actorAllianceId : undefined,
      sourceBuildingType: signal.sourceBuildingType,
      message,
      messageKey: template.id,
      payload: sanitizeRumorPayload({
        ...(input.payload ?? {}),
        rumorCategory: signal.category,
        confidence: signal.confidence,
        audience,
        intensityBand: signal.intensityBand,
        ageBand: signal.ageBand,
        direction: signal.direction,
        sourceBuildingType: signal.sourceBuildingType,
        marketCategory: signal.marketCategory
      })
    },
    suppressed: false,
    lobbyClubReductionPct
  };
};

export const applyRumorEventToState = (
  state: CoreGameState,
  input: ResolveRumorEventInput,
  context: RumorPipelineContext = {}
): CoreGameState => {
  const resolved = resolveRumorEvent(input, state, context);
  return resolved.event ? appendResolvedCityFeedEvents(state, [resolved.event], context.limit) : state;
};

export const appendResolvedCityFeedEvents = (
  state: CoreGameState,
  events: readonly CityFeedEvent[],
  limit = CITY_FEED_DEFAULT_LIMIT
): CoreGameState => {
  if (events.length <= 0) return state;
  const existing = pruneExpiredEvents(state.cityFeedEventsById ?? {}, state.root.tick);
  const sourceKeys = new Set(Object.values(existing).map((event) => event.sourceEventId || event.id));
  const nextEntries = { ...existing };
  let changed = Object.keys(existing).length !== Object.keys(state.cityFeedEventsById ?? {}).length;

  for (const event of events) {
    const sourceKey = event.sourceEventId || event.id;
    if (!event.id || sourceKeys.has(sourceKey)) continue;
    if (isSuppressedByRecentSimilarEvent(event, nextEntries, state.root.tick)) continue;
    sourceKeys.add(sourceKey);
    nextEntries[event.id] = sanitizeCityFeedEvent(event);
    changed = true;
  }

  if (!changed) return state;
  const trimmed = Object.fromEntries(
    Object.values(nextEntries)
      .sort(compareCityFeedEvents)
      .slice(0, Math.max(1, limit))
      .map((event) => [event.id, event])
  );
  return { ...state, cityFeedEventsById: trimmed };
};

export const applyResolvedRumorEventsToState = (
  state: CoreGameState,
  inputs: readonly ResolveRumorEventInput[],
  context: RumorPipelineContext = {}
): CoreGameState => {
  let nextState = state;
  for (const input of inputs) {
    nextState = applyRumorEventToState(nextState, input, context);
  }
  return nextState;
};

export const createPassiveBuildingRumorInput = (input: {
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  source: "restaurant" | "convenience_store" | "strip_club" | "vip_lounge";
  rumor: {
    type: string;
    text: string;
    truthChancePct?: number;
    isTrue?: boolean;
    verifiedIntel?: boolean;
  };
  severity?: CityFeedSeverity;
  category?: CityFeedCategory;
  negative?: boolean;
}): ResolveRumorEventInput => {
  const rumorCategory = mapBuildingRumorCategory(input.source, input.rumor.type);
  return {
    sourceEventId: `${input.source}:${input.building.id}:${input.state.root.tick}:${safeKey(input.rumor.type)}`,
    sourceType: "building_action",
    category: rumorCategory === "atmosphere" ? "atmosphere" : input.category || "rumor",
    severity: input.severity || "medium",
    confidence: input.rumor.verifiedIntel ? "credible" : undefined,
    truthiness: input.rumor.verifiedIntel ? "unconfirmed" : undefined,
    intelType: input.negative ? "scandal" : "rumor",
    visibility: "all",
    audience: "selected_district",
    playerId: input.building.ownerPlayerId,
    actorPlayerId: input.building.ownerPlayerId,
    districtId: input.building.districtId,
    createdAtTick: input.state.root.tick,
    message: input.rumor.text,
    truthChancePct: input.rumor.truthChancePct,
    isTrue: input.rumor.isTrue,
    negative: input.negative,
    rumorCategory,
    sourceBuildingType: input.source,
    payload: {
      buildingTypeId: input.building.buildingTypeId,
      rumorType: input.rumor.type,
      sourceBuilding: input.source
    }
  };
};

export const computeRumorFreshness = (event: CityFeedEvent, currentTick: number): RumorAgeBand => {
  if (event.expiresAtTick !== undefined && event.expiresAtTick <= currentTick) return "stale";
  const createdAtTick = Math.max(0, Number(event.createdAtTick || 0));
  const expiresAtTick = Math.max(createdAtTick + 1, Number(event.expiresAtTick ?? createdAtTick + 1));
  const ageRatio = Math.max(0, currentTick - createdAtTick) / Math.max(1, expiresAtTick - createdAtTick);
  if (ageRatio >= RUMOR_FEED_CONFIG.staleAfterRatio) return "stale";
  if (ageRatio >= 0.25) return "recent";
  return "fresh";
};

export const compareCityFeedEvents = (left: CityFeedEvent, right: CityFeedEvent): number =>
  (right.priority ?? 0) - (left.priority ?? 0)
  || right.createdAtTick - left.createdAtTick
  || left.id.localeCompare(right.id);

const projectSafeRumorSignal = (
  input: ResolveRumorEventInput,
  state: CoreGameState,
  context: RumorPipelineContext
): SafeRumorSignal | null => {
  if (containsForbiddenTrapHint(input)) return null;
  const sourceEventId = safeKey(input.sourceEventId || `${input.sourceType}:${state.root.tick}:${hashText(input.message || input.messageKey || "")}`);
  const category = input.rumorCategory || mapRumorCategory(input);
  if (!category) return null;
  const sourceSeed = context.seed || `${state.serverInstance.worldSeed}:${sourceEventId}`;
  const confidence = resolveConfidence(input, sourceSeed, state, context);
  const createdAtTick = Math.max(0, Math.floor(Number(input.createdAtTick ?? state.root.tick) || 0));
  const expiresAfterTicks = secondsToTicks(
    RUMOR_FEED_CONFIG.defaultExpiresAfterSeconds,
    context.config?.tickRateMs
  );
  const occurredAt = tickIso(createdAtTick, context);
  const expiresAt = tickIso(input.expiresAtTick ?? createdAtTick + expiresAfterTicks, context);

  return {
    sourceEventId,
    category,
    districtId: input.districtId,
    zoneId: input.zone,
    actorPlayerId: input.actorPlayerId || input.playerId,
    actorAllianceId: input.actorAllianceId || stringValue(input.payload?.allianceId),
    actorVisibility: resolveActorVisibility(input),
    intensityBand: input.intensityBand || intensityFromSeverity(input.severity),
    ageBand: "fresh",
    direction: input.direction || directionFromPayload(input.payload),
    confidence,
    occurredAt,
    expiresAt,
    sourceBuildingType: input.sourceBuildingType || stringValue(input.payload?.sourceBuilding || input.payload?.buildingTypeId),
    marketCategory: input.marketCategory || stringValue(input.payload?.marketCategory)
  };
};

const isRumorEligible = (
  input: ResolveRumorEventInput,
  signal: SafeRumorSignal,
  state: CoreGameState,
  context: RumorPipelineContext,
  sourceSeed: string,
  lobbyClubReductionPct: number
): boolean => {
  if (signal.confidence === "confirmed") return true;
  if (input.confidence) return true;
  if (input.sourceType === "spy" && signal.category === "espionage") return true;
  const negative = Boolean(input.negative || input.intelType === "scandal");
  if (negative && lobbyClubReductionPct > 0) {
    const publishRoll = deterministicRollPct(`${sourceSeed}:lobby-negative-rumor-publish`);
    if (publishRoll < lobbyClubReductionPct) return false;
  }
  return shouldGenerateDayNightRumor({
    state,
    context: context.config ? { config: context.config } : undefined,
    sourceKey: signal.sourceEventId
  });
};

const selectRumorTemplate = (input: {
  input: ResolveRumorEventInput;
  signal: SafeRumorSignal;
  audience: RumorAudience;
  state: CoreGameState;
  seed: string;
}): RumorTemplate | null => {
  if (input.input.templateId) {
    const direct = getRumorTemplates({
      category: input.signal.category,
      confidence: input.signal.confidence,
      audience: input.audience,
      sourceBuildingType: input.signal.sourceBuildingType,
      intensityBand: input.signal.intensityBand
    }).find((template) => template.id === input.input.templateId);
    if (direct && canRenderTemplate(direct, input.signal, input.state)) return direct;
  }
  const candidates = getCandidateTemplates(input.signal, input.audience)
    .filter((template) => canRenderTemplate(template, input.signal, input.state));
  if (candidates.length <= 0) return null;
  const recentIds = Object.values(input.state.cityFeedEventsById ?? {})
    .filter((event) => event.audience === input.audience || event.visibility === visibilityForAudience(input.audience))
    .sort(compareCityFeedEvents)
    .slice(0, RUMOR_FEED_CONFIG.recentTemplateSuppressionCount)
    .map((event) => event.templateId)
    .filter(Boolean);
  const preferred = candidates.filter((template) => !recentIds.includes(template.id));
  const pool = preferred.length > 0 ? preferred : candidates;
  const totalWeight = pool.reduce((sum, template) => sum + Math.max(0.1, Number(template.weight ?? 1)), 0);
  const roll = deterministicRollPct(`${input.seed}:template`) / 100 * totalWeight;
  let cursor = 0;
  for (const template of pool) {
    cursor += Math.max(0.1, Number(template.weight ?? 1));
    if (roll <= cursor) return template;
  }
  return pool[pool.length - 1] ?? null;
};

const getCandidateTemplates = (
  signal: SafeRumorSignal,
  audience: RumorAudience
): RumorTemplate[] => {
  const exact = getRumorTemplates({
    category: signal.category,
    confidence: signal.confidence,
    audience,
    sourceBuildingType: signal.sourceBuildingType,
    intensityBand: signal.intensityBand
  });
  if (exact.length > 0) return exact;
  return getRumorTemplates({
    category: signal.category,
    confidence: "rumor",
    audience,
    intensityBand: signal.intensityBand
  });
};

const canRenderTemplate = (
  template: RumorTemplate,
  signal: SafeRumorSignal,
  state: CoreGameState
): boolean => {
  if (template.revealsPlayerName && signal.actorVisibility !== "player") return false;
  if (template.revealsAllianceName && signal.actorVisibility !== "alliance") return false;
  if (template.revealsDistrictName && !signal.districtId) return false;
  if (template.revealsPlayerName && !resolvePlayerName(state, signal.actorPlayerId)) return false;
  if (template.revealsAllianceName && !resolveAllianceName(state, signal.actorAllianceId)) return false;
  return true;
};

const createTemplateContext = (
  signal: SafeRumorSignal,
  template: RumorTemplate,
  state: CoreGameState
): Record<string, string> => ({
  districtName: template.revealsDistrictName && signal.districtId
    ? state.districtsById[signal.districtId]?.name || "jedné z horkých čtvrtí"
    : "",
  zoneName: signal.zoneId || "",
  playerName: template.revealsPlayerName && signal.actorVisibility === "player"
    ? resolvePlayerName(state, signal.actorPlayerId)
    : "",
  allianceName: template.revealsAllianceName && signal.actorVisibility === "alliance"
    ? resolveAllianceName(state, signal.actorAllianceId)
    : "",
  marketCategory: signal.marketCategory || "zboží"
});

const resolveConfidence = (
  input: ResolveRumorEventInput,
  seed: string,
  state: CoreGameState,
  context: RumorPipelineContext
): RumorConfidence => {
  if (input.confidence) return input.confidence;
  if (input.truthiness === "confirmed") return "confirmed";
  if (input.truthiness === "false_possible" || input.intelType === "false_lead") return "false_possible";
  if (input.intelType === "suspicion" || input.intelType === "warning") return "suspicion";
  if (input.intelType === "scandal") return "rumor";
  if (input.truthChancePct !== undefined || typeof input.isTrue === "boolean") {
    if (input.isTrue === false || Number(input.truthChancePct) <= 0) return "false_possible";
    const baseChance = typeof input.isTrue === "boolean" ? (input.isTrue ? 72 : 6) : Number(input.truthChancePct || 0);
    const dayNightChance = applyDayNightRumorTruthChancePct(baseChance, state, context.config ? { config: context.config } : undefined);
    const truthChancePct = Number(context.config && input.playerId
      ? applyFactionRumorTruthChancePct(dayNightChance, getFactionPassiveModifiers(state, input.playerId, { config: context.config }))
      : dayNightChance);
    const roll = deterministicRollPct(`${seed}:confidence`);
    if (roll < Math.min(8, Math.max(0, 100 - truthChancePct) / 4)) return "false_possible";
    if (roll < Math.max(12, truthChancePct * 0.28)) return "credible";
    if (roll < Math.max(28, truthChancePct * 0.55)) return "suspicion";
    return "rumor";
  }
  if (input.truthiness === "unconfirmed") return "rumor";
  return "credible";
};

const mapRumorCategory = (input: ResolveRumorEventInput): RumorCategory | null => {
  if (input.rumorCategory) return input.rumorCategory;
  const buildingType = stringValue(input.payload?.buildingTypeId);
  const actionId = stringValue(input.payload?.actionId);
  const rumorType = stringValue(input.payload?.rumorType);
  if (input.sourceType === "attack" || input.sourceType === "district_capture" || input.sourceType === "district_occupy") return "attack_activity";
  if (input.sourceType === "spy") return "espionage";
  if (input.sourceType === "police_warning" || input.sourceType === "police_raid") return "police_heat";
  if (input.sourceType === "market") return "market";
  if (input.sourceType === "robbery") return "heist_robbery";
  if (input.sourceType === "trap") return null;
  if (buildingType === "stock_exchange") return "market";
  if (buildingType === "city_hall") return "downtown_power";
  if (buildingType === "central_bank") return "economy";
  if (buildingType === "armory" || actionId.includes("craft") || actionId.includes("fortify")) return "weapons_materials";
  if (rumorType) return mapBuildingRumorCategory(stringValue(input.payload?.sourceBuilding) || "restaurant", rumorType);
  if (input.category === "police") return "police_heat";
  if (input.category === "economy") return "economy";
  if (input.category === "district") return "attack_activity";
  if (input.category === "atmosphere") return "atmosphere";
  return "economy";
};

const mapBuildingRumorCategory = (source: string, type: string): RumorCategory => {
  const normalized = type.trim().toLowerCase();
  if (isTrapRumorType(normalized)) return "atmosphere";
  if (["civilian_movement", "night_movement", "courier_trace"].includes(normalized)) return "population_movement";
  if (["suspicious_delivery", "suspicious_purchase", "storage_movement", "storage", "storage_hint"].includes(normalized)) return "weapons_materials";
  if (["weak_defense", "hidden_weakness"].includes(normalized)) return "district_defense";
  if (["attack_preparation", "planned_attack", "revenge_plan", "attacks", "small_conflict", "robbery_preparation"].includes(normalized)) return "attack_activity";
  if (["police_interest", "police_patrol", "police", "police_warning", "police_district_heat", "police_pressure_medium", "police_pressure_high", "police_false_lead", "police_post_raid_scandal"].includes(normalized)) return "police_heat";
  if (["dirty_cash_movement", "laundering", "money", "casino_money", "financial_deal", "economic_activity"].includes(normalized)) return "economy";
  if (["relationships", "political_pressure", "meeting_leak"].includes(normalized)) return source === "lobby_club" ? "alliance_activity" : "downtown_power";
  if (["smuggling_route", "drug_distribution"].includes(normalized)) return "heist_robbery";
  return "atmosphere";
};

const resolveRumorAudience = (
  input: ResolveRumorEventInput,
  signal: SafeRumorSignal
): RumorAudience => {
  if (input.audience) return input.audience;
  if (input.visibility === "player") return "current_player";
  if (input.visibility === "alliance") return "alliance";
  if (signal.category === "police_heat" && input.category === "police") return "police";
  if (signal.category === "final_lockdown" || input.visibility === "all") return "global_city";
  if (signal.districtId) return "selected_district";
  return "global_city";
};

const visibilityForAudience = (
  audience: RumorAudience,
  explicit?: CityFeedVisibility
): CityFeedVisibility => {
  if (explicit) return explicit;
  if (audience === "current_player") return "player";
  if (audience === "alliance") return "alliance";
  return "all";
};

const resolveCityFeedCategory = (
  signal: SafeRumorSignal,
  input: ResolveRumorEventInput
): CityFeedCategory => {
  if (input.category === "system" && signal.confidence === "confirmed") return "system";
  if (signal.category === "atmosphere") return "atmosphere";
  if (signal.category === "police_heat" && signal.confidence === "confirmed") return "police";
  if (signal.category === "market" || signal.category === "economy") return input.category === "rumor" ? "rumor" : "economy";
  if (signal.category === "attack_activity" && signal.confidence === "confirmed") {
    return input.sourceType === "district_capture" || input.sourceType === "district_occupy" ? "district" : "combat";
  }
  return input.category === "police" ? "police" : "rumor";
};

const truthinessFromConfidence = (confidence: RumorConfidence): CityFeedTruthiness =>
  confidence === "confirmed" ? "confirmed" : confidence === "false_possible" ? "false_possible" : "unconfirmed";

const intelTypeFromConfidence = (
  confidence: RumorConfidence,
  category: RumorCategory
): CityFeedIntelType => {
  if (confidence === "confirmed") return "confirmed_event";
  if (confidence === "false_possible") return "false_lead";
  if (confidence === "suspicion") return "suspicion";
  if (category === "police_heat") return "warning";
  return "rumor";
};

const severityFromIntensity = (
  intensity: RumorIntensityBand,
  fallback?: CityFeedSeverity
): CityFeedSeverity => {
  if (fallback === "extreme") return "extreme";
  if (intensity === "high") return fallback === "low" ? "medium" : "high";
  if (intensity === "medium") return "medium";
  return fallback || "low";
};

const intensityFromSeverity = (severity?: CityFeedSeverity): RumorIntensityBand => {
  if (severity === "high" || severity === "extreme") return "high";
  if (severity === "medium") return "medium";
  return "low";
};

const directionFromPayload = (payload?: EventPayload): RumorDirection => {
  const raw = stringValue(payload?.direction || payload?.mode);
  if (raw.includes("increase") || raw.includes("up") || raw.includes("gain")) return "increasing";
  if (raw.includes("decrease") || raw.includes("down") || raw.includes("loss")) return "decreasing";
  return "unknown";
};

const resolveActorVisibility = (input: ResolveRumorEventInput): SafeRumorSignal["actorVisibility"] => {
  if (input.actorAllianceId || input.payload?.allianceId) return "alliance";
  if (input.actorPlayerId && input.confidence === "confirmed") return "player";
  if (input.truthiness === "confirmed" && input.playerId && (input.sourceType === "district_capture" || input.sourceType === "district_occupy")) return "player";
  return "hidden";
};

const resolvePriority = (template: RumorTemplate, signal: SafeRumorSignal): number => {
  if (signal.category === "final_lockdown") return 100;
  if (signal.category === "attack_activity" && signal.confidence === "confirmed") return 90;
  if (signal.category === "police_heat" && signal.confidence === "confirmed") return 90;
  if (signal.category === "atmosphere") return 1;
  const base = Number(template.priority ?? 30);
  if (signal.confidence === "confirmed") return Math.max(base, 70);
  if (signal.confidence === "credible") return Math.max(base, 50);
  if (signal.confidence === "false_possible") return Math.min(base, 10);
  return base;
};

const resolveExpirationTicks = (
  template: RumorTemplate,
  context: RumorPipelineContext
): number => {
  const seconds = Math.max(60, Number(template.expiresAfterSeconds || RUMOR_FEED_CONFIG.defaultExpiresAfterSeconds));
  const mode = context.config?.mode ?? "free";
  const multiplier = RUMOR_FEED_CONFIG.modeExpirationMultiplier[mode] ?? 1;
  return secondsToTicks(seconds * multiplier, context.config?.tickRateMs);
};

const secondsToTicks = (seconds: number, tickRateMs = 1_000): number =>
  Math.max(1, Math.ceil((Math.max(1, seconds) * 1000) / Math.max(1, tickRateMs)));

const isSuppressedByRecentSimilarEvent = (
  event: CityFeedEvent,
  existing: Record<string, CityFeedEvent>,
  currentTick: number
): boolean => {
  if (event.confidence === "confirmed" || event.priority === 100) return false;
  const cooldown = RUMOR_FEED_CONFIG.categoryCooldownTicks;
  return Object.values(existing).some((candidate) =>
    (candidate.expiresAtTick ?? Infinity) > currentTick
    && candidate.audience === event.audience
    && candidate.rumorCategory === event.rumorCategory
    && candidate.confidence === event.confidence
    && (candidate.districtId ?? "") === (event.districtId ?? "")
    && (candidate.sourceBuildingType ?? "") === (event.sourceBuildingType ?? "")
    && Math.abs(candidate.createdAtTick - event.createdAtTick) <= cooldown
  );
};

const pruneExpiredEvents = (
  events: Record<string, CityFeedEvent>,
  currentTick: number
): Record<string, CityFeedEvent> =>
  Object.fromEntries(Object.entries(events).filter(([, event]) =>
    event.expiresAtTick === undefined || event.expiresAtTick > currentTick
  ));

const sanitizeCityFeedEvent = (event: CityFeedEvent): CityFeedEvent => ({
  ...event,
  payload: sanitizeRumorPayload(event.payload ?? {})
});

const sanitizeRumorPayload = (payload: EventPayload): EventPayload => {
  return Object.fromEntries(
    Object.entries(payload)
      .filter(([, value]) => value !== undefined)
      .filter(([key]) => !isForbiddenPayloadKey(key))
      .filter(([key]) => !/trap/i.test(key))
  );
};

const isForbiddenPayloadKey = (key: string): boolean =>
  /trap|attackpower|defensepower|weapon|inventory|targetcommand|spyresult|population|dirtycash|cleancash|cash|heat|amount|count|cooldown|rng|chance|percent|pct/i.test(key);

const containsForbiddenTrapHint = (input: ResolveRumorEventInput): boolean => {
  if (input.sourceType === "trap") return true;
  const payload = input.payload ?? {};
  if (Object.keys(payload).some((key) => /trap/i.test(key))) return true;
  if (isTrapRumorType(stringValue(payload.rumorType || input.intelType))) return true;
  return /\btrap\b|past|pasti/i.test(input.message || "");
};

const isTrapRumorType = (type: string): boolean =>
  ["possible_trap", "trap_suspicion", "traps", "trap"].includes(String(type || "").trim().toLowerCase());

const resolveLobbyClubNegativeRumorReductionPct = (input: {
  state: CoreGameState;
  playerId: string | null | undefined;
  config?: LobbyClubBalanceConfig;
  tick: number;
}): number => {
  if (!input.config || !input.playerId) return 0;
  const clubs = getOwnedLobbyClubs(input.state, input.playerId, input.config);
  if (clubs.length <= 0) return 0;
  const baseReduction = clubs.length >= 2
    ? input.config.negativeRumorReduction.twoClubPct
    : input.config.negativeRumorReduction.oneClubPct;
  const backroom = clubs.some((club) => Number(getLobbyClubMetadata(club, input.tick).backroomPressureExpiresAtTick || 0) > input.tick)
    ? input.config.backroomPressure.negativeRumorReductionPct
    : 0;
  const media = clubs.some((club) => Number(getLobbyClubMetadata(club, input.tick).mediaScreenExpiresAtTick || 0) > input.tick)
    ? input.config.mediaScreen.negativeRumorReductionPct
    : 0;
  return Math.min(95, Math.max(0, baseReduction + backroom + media));
};

const tickIso = (tick: number, context: RumorPipelineContext): string => {
  if (!context.config?.tickRateMs) return new Date(0).toISOString();
  return new Date(Math.max(0, tick) * context.config.tickRateMs).toISOString();
};

const resolvePlayerName = (state: CoreGameState, playerId?: string): string =>
  playerId ? (state.playersById[playerId]?.name || playerId) : "";

const resolveAllianceName = (state: CoreGameState, allianceId?: string): string =>
  allianceId ? (state.alliancesById[allianceId]?.name || allianceId) : "";

const safeKey = (value: string): string =>
  String(value || "event")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9:._-]/g, "");

const stringValue = (value: unknown): string => String(value ?? "").trim();

const hashText = (value: string): number =>
  Array.from(value).reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) | 0, 0);
