import type {
  CityFeedCategory,
  CityFeedEvent,
  CityFeedIntelType,
  CityFeedSeverity,
  CityFeedSourceType,
  CityFeedTruthiness,
  CityFeedVisibility
} from "@empire/shared-types";
import type { LobbyClubBalanceConfig } from "../../contracts";
import type { GameCoreContext } from "../../engine/context";
import type { CoreGameState } from "../../entities";
import { applyDayNightRumorTruthChancePct, shouldGenerateDayNightRumor } from "../day-night/dayNight";
import { deterministicRollPct } from "../../utils/math";
import { getLobbyClubMetadata, getOwnedLobbyClubs } from "../../handlers/lobbyClubMetadata";

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
  playerId?: string;
  targetPlayerId?: string;
  districtId?: string;
  zone?: string;
  createdAtTick?: number;
  message: string;
  messageKey?: string;
  payload?: EventPayload;
  truthChancePct?: number;
  isTrue?: boolean;
  negative?: boolean;
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

export const resolveRumorEvent = (
  input: ResolveRumorEventInput,
  state: CoreGameState,
  context: RumorPipelineContext = {}
): ResolvedRumorEvent => {
  const sourceEventId = safeKey(input.sourceEventId || `${input.sourceType}:${state.root.tick}:${hashText(input.message)}`);
  const sourceType = input.sourceType;
  const sourceSeed = context.seed || `${state.serverInstance.worldSeed}:${sourceEventId}`;
  const trapSuspicion = isTrapSuspicion(input);
  const confirmedHardEvent = input.truthiness === "confirmed" && !trapSuspicion;
  const truthChancePct = applyDayNightRumorTruthChancePct(input.truthChancePct, state, context.config ? { config: context.config } : undefined);
  const truthiness = resolveTruthiness({ ...input, truthChancePct }, sourceSeed, trapSuspicion, confirmedHardEvent);
  const intelType = resolveIntelType(input, truthiness, trapSuspicion, confirmedHardEvent);
  const category = trapSuspicion ? "rumor" : input.category || resolveDefaultCategory(sourceType);
  const negative = isNegativeRumor(input, intelType, category);
  const lobbyClubReductionPct = confirmedHardEvent
    ? 0
    : resolveLobbyClubNegativeRumorReductionPct({
        state,
        playerId: input.targetPlayerId || input.playerId,
        config: context.lobbyClubConfig,
        tick: state.root.tick
      });

  if (negative && lobbyClubReductionPct > 0) {
    const publishRoll = deterministicRollPct(`${sourceSeed}:lobby-negative-rumor-publish`);
    if (publishRoll < lobbyClubReductionPct) {
      return { event: null, suppressed: true, lobbyClubReductionPct };
    }
  }
  if (!confirmedHardEvent && !shouldGenerateDayNightRumor({
    state,
    context: context.config ? { config: context.config } : undefined,
    sourceKey: sourceEventId
  })) {
    return { event: null, suppressed: true, lobbyClubReductionPct };
  }

  const severity = negative && lobbyClubReductionPct > 0
    ? maybeReduceSeverity(input.severity || "low", lobbyClubReductionPct, `${sourceSeed}:lobby-negative-rumor-severity`)
    : input.severity || "low";
  const payload = sanitizeRumorPayload({
    ...(input.payload ?? {}),
    intelType,
    truthChancePct,
    lobbyClubReductionPct: lobbyClubReductionPct || undefined,
    trapSuspicion: trapSuspicion || undefined
  }, trapSuspicion);

  return {
    event: {
      id: input.id || `city-feed:${sourceEventId}`,
      sourceEventId,
      sourceType,
      category,
      severity,
      truthiness,
      intelType,
      visibility: input.visibility || "all",
      playerId: input.playerId,
      targetPlayerId: input.targetPlayerId,
      districtId: input.districtId,
      zone: input.zone,
      createdAtTick: Math.max(0, Math.floor(Number(input.createdAtTick ?? state.root.tick) || 0)),
      message: trapSuspicion ? sanitizeTrapSuspicionMessage(input.message, input.districtId, state) : input.message,
      messageKey: input.messageKey,
      payload
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
  const existing = state.cityFeedEventsById ?? {};
  const sourceKeys = new Set(Object.values(existing).map((event) => event.sourceEventId || event.id));
  const nextEntries = { ...existing };
  let changed = false;

  for (const event of events) {
    const sourceKey = event.sourceEventId || event.id;
    if (!event.id || sourceKeys.has(sourceKey)) continue;
    sourceKeys.add(sourceKey);
    nextEntries[event.id] = event;
    changed = true;
  }

  if (!changed) return state;
  const trimmed = Object.fromEntries(
    Object.values(nextEntries)
      .sort((left, right) => right.createdAtTick - left.createdAtTick || right.id.localeCompare(left.id))
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
  const trapSuspicion = isTrapRumorType(input.rumor.type);
  return {
    sourceEventId: `${input.source}:${input.building.id}:${input.state.root.tick}:${safeKey(input.rumor.type)}:${Math.abs(hashText(input.rumor.text))}`,
    sourceType: "building_action",
    category: input.category || "rumor",
    severity: input.severity || (trapSuspicion ? "low" : "medium"),
    truthiness: input.rumor.verifiedIntel ? "unconfirmed" : undefined,
    intelType: trapSuspicion ? "suspicion" : input.negative ? "scandal" : "rumor",
    visibility: "all",
    playerId: input.building.ownerPlayerId,
    districtId: input.building.districtId,
    createdAtTick: input.state.root.tick,
    message: input.rumor.text,
    messageKey: `rumor.${input.source}`,
    truthChancePct: trapSuspicion
      ? Math.min(25, Number(input.rumor.truthChancePct || 0))
      : input.rumor.truthChancePct,
    isTrue: input.rumor.isTrue,
    negative: input.negative || trapSuspicion || isNegativeRumorType(input.rumor.type),
    payload: {
      buildingId: input.building.id,
      buildingTypeId: input.building.buildingTypeId,
      rumorType: input.rumor.type,
      sourceBuilding: input.source
    }
  };
};

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

const resolveTruthiness = (
  input: ResolveRumorEventInput,
  seed: string,
  trapSuspicion: boolean,
  confirmedHardEvent: boolean
): CityFeedTruthiness => {
  if (confirmedHardEvent) return "confirmed";
  if (trapSuspicion) return deterministicRollPct(`${seed}:trap-truthiness`) < Math.min(25, Number(input.truthChancePct || 0))
    ? "unconfirmed"
    : "false_possible";
  if (input.truthiness === "false_possible") return "false_possible";
  if (typeof input.isTrue === "boolean") return input.isTrue ? "unconfirmed" : "false_possible";
  if (input.truthChancePct !== undefined) {
    return deterministicRollPct(`${seed}:truthiness`) < Number(input.truthChancePct || 0) ? "unconfirmed" : "false_possible";
  }
  return input.truthiness || "unconfirmed";
};

const resolveIntelType = (
  input: ResolveRumorEventInput,
  truthiness: CityFeedTruthiness,
  trapSuspicion: boolean,
  confirmedHardEvent: boolean
): CityFeedIntelType => {
  if (confirmedHardEvent) return "confirmed_event";
  if (trapSuspicion) return "suspicion";
  if (input.intelType) return input.intelType;
  if (input.sourceType === "police_warning") return "warning";
  if (truthiness === "false_possible") return "false_lead";
  return "rumor";
};

const isNegativeRumor = (
  input: ResolveRumorEventInput,
  intelType: CityFeedIntelType,
  category: CityFeedCategory
): boolean =>
  Boolean(input.negative)
  || intelType === "scandal"
  || isNegativeRumorType(String(input.payload?.rumorType || input.payload?.inspectionType || ""))
  || (category === "rumor" && ["high", "extreme"].includes(String(input.severity)));

const isTrapSuspicion = (input: ResolveRumorEventInput): boolean =>
  isTrapRumorType(String(input.payload?.rumorType || input.intelType || ""))
  || (input.sourceType === "trap" && input.truthiness !== "confirmed");

const isTrapRumorType = (type: string): boolean =>
  ["possible_trap", "trap_suspicion", "traps", "trap"].includes(String(type || "").trim().toLowerCase());

const isNegativeRumorType = (type: string): boolean =>
  [
    "scandal",
    "public_scandal",
    "relationships",
    "police",
    "police_interest",
    "police_warning",
    "police_pressure_medium",
    "police_pressure_high",
    "police_district_heat",
    "police_false_lead",
    "police_post_raid_scandal",
    "dirty_cash_movement",
    "laundering",
    "leaked_documents",
    "data_leak",
    "possible_trap",
    "trap_suspicion",
    "traps"
  ].includes(String(type || "").trim().toLowerCase());

const resolveDefaultCategory = (sourceType: CityFeedSourceType): CityFeedCategory => {
  if (sourceType === "police_raid" || sourceType === "police_warning") return "police";
  if (sourceType === "attack" || sourceType === "trap") return "combat";
  if (sourceType === "market") return "economy";
  if (sourceType === "district_capture") return "district";
  return "rumor";
};

const maybeReduceSeverity = (severity: CityFeedSeverity, reductionPct: number, seed: string): CityFeedSeverity => {
  if (deterministicRollPct(seed) >= reductionPct / 2) return severity;
  if (severity === "extreme") return "high";
  if (severity === "high") return "medium";
  if (severity === "medium") return "low";
  return "low";
};

const sanitizeRumorPayload = (payload: EventPayload, trapSuspicion: boolean): EventPayload => {
  const next = { ...payload };
  delete next.isTrue;
  delete next.trapId;
  delete next.trapType;
  delete next.activeTrap;
  delete next.hasActiveTrap;
  delete next.trapDetected;
  delete next.discoveredTrap;
  delete next.trapDiscovered;
  if (trapSuspicion) {
    next.rumorType = "trap_suspicion";
  }
  return Object.fromEntries(Object.entries(next).filter(([, value]) => value !== undefined));
};

const sanitizeTrapSuspicionMessage = (
  message: string,
  districtId: string | undefined,
  state: CoreGameState
): string => {
  const district = districtId ? state.districtsById[districtId]?.name || "jednom z bloků" : "jednom z bloků";
  const lower = message.toLowerCase();
  if (!lower.includes("past") && !lower.includes("trap")) return message;
  return `V ${district} se ztrácí lidi a zdroj tvrdí, že tam něco nesedí. Může to být jen kouřová clona.`;
};

const safeKey = (value: string): string =>
  String(value || "event")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9:._-]/g, "");

const hashText = (value: string): number =>
  Array.from(value).reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) | 0, 0);
