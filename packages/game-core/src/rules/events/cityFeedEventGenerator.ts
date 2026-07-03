import type { CityFeedEvent, CityFeedSeverity, CityFeedSourceType } from "@empire/shared-types";
import type { CoreGameState } from "../../entities";
import type { CoreEvent } from "../../events";
import { createBuildingActionFeedEvents, createCraftFeedEvents } from "./buildingCityFeedEvents";
import { createPoliceCityFeedEvents } from "./policeCityFeedEvents";
import type { GameCoreContext } from "../../engine/context";
import {
  appendResolvedCityFeedEvents,
  CITY_FEED_DEFAULT_LIMIT,
  resolveRumorEvent,
  type RumorPipelineContext
} from "./rumorPipeline";

type EventPayload = Record<string, unknown>;

export const createCityFeedEventsFromCoreEvents = (
  state: CoreGameState,
  events: readonly CoreEvent[]
): CityFeedEvent[] =>
  events
    .flatMap((event) => createCityFeedEventsFromCoreEvent(state, event))
    .filter((event): event is CityFeedEvent => Boolean(event));

export const appendCityFeedEventsFromCoreEvents = (
  state: CoreGameState,
  events: readonly CoreEvent[],
  limit = CITY_FEED_DEFAULT_LIMIT,
  context?: Pick<GameCoreContext, "config">
): CoreGameState => appendCityFeedEvents(state, createCityFeedEventsFromCoreEvents(state, events), limit, context);

export const appendCityFeedEvents = (
  state: CoreGameState,
  events: readonly CityFeedEvent[],
  limit = CITY_FEED_DEFAULT_LIMIT,
  context?: Pick<GameCoreContext, "config">
): CoreGameState => {
  if (events.length <= 0) return state;
  const pipelineContext: RumorPipelineContext = {
    limit,
    config: context?.config,
    lobbyClubConfig: context?.config.balance.lobbyClub
  };
  const resolvedEvents = events.flatMap((event) => {
    const resolved = resolveRumorEvent({
      ...event,
      message: event.message,
      payload: event.payload
    }, state, pipelineContext);
    return resolved.event ? [resolved.event] : [];
  });
  return appendResolvedCityFeedEvents(state, resolvedEvents, limit);
};

export const createCityFeedEventsFromCoreEvent = (
  state: CoreGameState,
  event: CoreEvent
): CityFeedEvent[] => {
  const payload = safePayload(event.payload);
  const districtId = stringValue(payload.districtId || payload.targetDistrictId);

  switch (event.type) {
    case "district-attacked":
      return [createFeedEvent(state, event, {
        sourceType: "attack",
        category: "combat",
        severity: resolveAttackSeverity(payload),
        truthiness: "confirmed",
        intelType: "confirmed_event",
        visibility: "all",
        playerId: stringValue(payload.attackerPlayerId),
        districtId,
        messageKey: booleanValue(payload.districtCaptured) ? "attack_success" : "attack_fail",
        payload: publicAttackPayload(payload)
      })];
    case "district-captured":
      return [createFeedEvent(state, event, {
        sourceType: stringValue(payload.actionType) === "occupy-district" ? "district_occupy" : "district_capture",
        category: "district",
        severity: "high",
        truthiness: "confirmed",
        intelType: "confirmed_event",
        visibility: "all",
        playerId: stringValue(payload.attackerPlayerId),
        targetPlayerId: stringValue(payload.previousOwnerPlayerId),
        districtId,
        messageKey: stringValue(payload.actionType) === "occupy-district" ? "occupy_success" : "district_capture",
        templateId: stringValue(payload.streetNewsTemplateId),
        payload: stringValue(payload.actionType) === "occupy-district" ? publicOccupyPayload(payload) : undefined
      })];
    case "district-occupy-resolved":
      return [createFeedEvent(state, event, {
        sourceType: "district_occupy",
        category: "district",
        severity: stringValue(payload.result) === "failure" ? "medium" : "high",
        truthiness: "confirmed",
        intelType: "confirmed_event",
        visibility: "all",
        playerId: stringValue(payload.attackerPlayerId),
        targetPlayerId: stringValue(payload.previousOwnerPlayerId),
        districtId,
        messageKey: stringValue(payload.result) === "failure" ? "occupy_failure" : "occupy_success",
        templateId: stringValue(payload.streetNewsTemplateId),
        payload: publicOccupyPayload(payload)
      })];
    case "district-spied":
      if (!["failed", "critical_failed"].includes(stringValue(payload.result) || "")) return [];
      return [createFeedEvent(state, event, {
        sourceType: "spy",
        category: "rumor",
        severity: "low",
        truthiness: "unconfirmed",
        intelType: "suspicion",
        visibility: "all",
        audience: "selected_district",
        playerId: stringValue(payload.attackerPlayerId),
        districtId,
        messageKey: "police_warning",
        rumorCategory: "espionage",
        payload: { publicSummary: "spy_activity" }
      })];
    case "police-warning-issued":
    case "police-raid-triggered":
    case "police-raid-resolved": {
      return createPoliceCityFeedEvents(state, event, payload);
    }
    case "trap-triggered":
      return [];
    case "building-action-resolved":
      return createBuildingActionFeedEvents(state, event, payload);
    case "item-crafted":
      return createCraftFeedEvents(state, event, payload);
    case "market-transaction-resolved":
      return [createFeedEvent(state, event, {
        sourceType: "market",
        category: "economy",
        severity: stringValue(payload.marketType) === "black" || numericValue(payload.heatAdded) > 0 ? "medium" : "low",
        truthiness: "confirmed",
        intelType: "confirmed_event",
        visibility: "player",
        playerId: stringValue(payload.playerId),
        messageKey: stringValue(payload.marketType) === "black" ? "black_market" : "market",
        payload: {
          transactionId: stringValue(payload.transactionId),
          transactionType: stringValue(payload.transactionType),
          resourceId: stringValue(payload.resourceId),
          amount: numericValue(payload.amount),
          marketType: stringValue(payload.marketType),
          paymentType: stringValue(payload.paymentType),
          unitPrice: numericValue(payload.unitPrice),
          totalPrice: numericValue(payload.totalPrice),
          heatAdded: numericValue(payload.heatAdded),
          policeSuspicionAdded: numericValue(payload.policeSuspicionAdded),
          marketCategory: stringValue(payload.resourceId)
        }
      })];
    default:
      return [];
  }
};

const createFeedEvent = (
  state: CoreGameState,
  event: CoreEvent,
  input: Omit<CityFeedEvent, "id" | "createdAtTick" | "message" | "messageKey"> & { messageKey: string }
): CityFeedEvent => {
  const sourceEventId = createSourceEventId(event, input.sourceType, state.root.tick);
  return {
    id: `city-feed:${sourceEventId}`,
    sourceEventId,
    createdAtTick: state.root.tick,
    ...input,
    messageKey: `rumor.${input.messageKey}`,
    message: ""
  };
};

const createSourceEventId = (event: CoreEvent, sourceType: CityFeedSourceType, fallbackTick: number): string => {
  const payload = safePayload(event.payload);
  const directId = stringValue(payload.raidId || payload.notificationId || payload.reportId || payload.eventId);
  if (directId) return `${sourceType}:${directId}`;
  return [
    sourceType,
    event.type,
    stringValue(payload.playerId || payload.attackerPlayerId),
    stringValue(payload.districtId || payload.targetDistrictId),
    stringValue(payload.buildingId || payload.actionId),
    stringValue(payload.result || payload.outcomeTier),
    stringValue(payload.tick ?? fallbackTick)
  ].filter(Boolean).join(":");
};

const resolveAttackSeverity = (payload: EventPayload): CityFeedSeverity => {
  if (booleanValue(payload.districtDestroyed)) return "extreme";
  if (booleanValue(payload.districtCaptured)) return "high";
  return numericValue(payload.heatGained) >= 8 ? "medium" : "low";
};

const publicAttackPayload = (payload: EventPayload): EventPayload => ({
  attackSucceeded: booleanValue(payload.attackSucceeded),
  districtCaptured: booleanValue(payload.districtCaptured),
  districtDestroyed: booleanValue(payload.districtDestroyed),
  heatGained: numericValue(payload.heatGained)
});

const publicOccupyPayload = (payload: EventPayload): EventPayload => ({
  districtCaptured: booleanValue(payload.districtCaptured),
  heatGained: numericValue(payload.heatGained),
  populationLost: numericValue(payload.populationLost),
  populationRefunded: numericValue(payload.populationRefunded),
  result: stringValue(payload.result) || "success"
});

const safePayload = (value: unknown): EventPayload =>
  value && typeof value === "object" ? value as EventPayload : {};

const stringValue = (value: unknown): string | undefined => {
  const text = String(value ?? "").trim();
  return text || undefined;
};

const numericValue = (value: unknown): number => {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
};

const booleanValue = (value: unknown): boolean => value === true || value === "true";

