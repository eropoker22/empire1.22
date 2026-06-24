import type { CityFeedEvent, CityFeedSeverity, CityFeedSourceType } from "@empire/shared-types";
import type { CoreGameState } from "../../entities";
import type { CoreEvent } from "../../events";

type EventPayload = Record<string, unknown>;

export const createBuildingActionFeedEvents = (
  state: CoreGameState,
  event: CoreEvent,
  payload: EventPayload
): CityFeedEvent[] => {
  const heatGain = numericValue(payload.heatGain);
  const outputGain = safePayload(payload.outputGain);
  const resourceDelta = safePayload(payload.resourceDelta);
  const dirtyCash = Math.max(
    numericValue(outputGain["dirty-cash"]),
    Math.abs(signedNumericValue(resourceDelta["dirty-cash"])),
    Math.abs(signedNumericValue(payload.dirtyCashDelta))
  );
  const actionId = stringValue(payload.actionId);
  const buildingTypeId = stringValue(payload.buildingTypeId);
  const streetDealerResult = safePayload(payload.streetDealerResult);
  const stockExchangeResult = safePayload(payload.stockExchangeResult);
  if (buildingTypeId === "stock_exchange" && actionId === "market_pressure") {
    const category = stringValue(stockExchangeResult.category) || "market";
    return [createDirectFeedEvent(state, event, {
      sourceType: "market",
      category: "economy",
      severity: "high",
      truthiness: "confirmed",
      intelType: "confirmed_event",
      visibility: "all",
      playerId: stringValue(payload.playerId),
      districtId: stringValue(payload.districtId),
      payload: {
        actionId,
        buildingTypeId,
        marketCategory: category,
        mode: stringValue(stockExchangeResult.mode),
        regularPriceModifierPct: signedNumericValue(stockExchangeResult.regularPriceModifierPct),
        blackMarketPriceModifierPct: signedNumericValue(stockExchangeResult.blackMarketPriceModifierPct),
        activeUntilTick: numericValue(stockExchangeResult.activeUntilTick)
      }
    })];
  }
  const significantBuildingAction = isSignificantBuildingAction(actionId, buildingTypeId);
  const streetDealerIncident = safePayload(streetDealerResult.incident);
  if (heatGain < 5 && dirtyCash < 500 && !significantBuildingAction && !streetDealerIncident.type) return [];

  return [createFeedEvent(state, event, {
    sourceType: "building_action",
    category: "economy",
    severity: heatGain >= 10 || dirtyCash >= 2000 || buildingTypeId === "drug_lab" || streetDealerIncident.type === "loose_talk" ? "high" : "medium",
    truthiness: "unconfirmed",
    intelType: "rumor",
    visibility: "all",
    playerId: stringValue(payload.playerId),
    districtId: stringValue(payload.districtId),
    messageKey: dirtyCash > 0 || buildingTypeId === "exchange" || buildingTypeId === "casino"
      ? "black_market"
      : "police_warning",
    payload: { actionId, buildingTypeId, dirtyCash, heatGain }
  })];
};

export const createCraftFeedEvents = (
  state: CoreGameState,
  event: CoreEvent,
  payload: EventPayload
): CityFeedEvent[] => {
  const outputResourceKey = stringValue(payload.outputResourceKey);
  if (!isSignificantCraftOutput(outputResourceKey)) return [];

  return [createFeedEvent(state, event, {
    sourceType: "building_action",
    category: "economy",
    severity: isWeaponOrDefenseOutput(outputResourceKey) ? "medium" : "high",
    truthiness: "unconfirmed",
    intelType: "rumor",
    visibility: "all",
    playerId: stringValue(payload.playerId),
    districtId: stringValue(payload.districtId),
    messageKey: isWeaponOrDefenseOutput(outputResourceKey) ? "police_warning" : "black_market",
    payload: {
      recipeId: stringValue(payload.recipeId),
      outputResourceKey,
      outputAmount: numericValue(payload.outputAmount)
    }
  })];
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

const createDirectFeedEvent = (
  state: CoreGameState,
  event: CoreEvent,
  input: Omit<CityFeedEvent, "id" | "createdAtTick" | "message" | "messageKey">
): CityFeedEvent => {
  const sourceEventId = createSourceEventId(event, input.sourceType, state.root.tick);
  return {
    id: `city-feed:${sourceEventId}`,
    sourceEventId,
    createdAtTick: state.root.tick,
    message: "",
    ...input
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

const isSignificantBuildingAction = (
  actionId: string | undefined,
  buildingTypeId: string | undefined
): boolean => {
  if (!actionId || !buildingTypeId) return false;
  if (buildingTypeId === "drug_lab") return actionId.startsWith("produce_");
  if (buildingTypeId === "armory") return actionId === "armory_fortify" || actionId === "armory_craft_weapons";
  if (buildingTypeId === "casino") return actionId === "quiet_backroom" || actionId === "vip_night";
  if (buildingTypeId === "exchange") return actionId === "good_rate";
  if (buildingTypeId === "street_dealers") return actionId === "start_drug_sale";
  if (buildingTypeId === "airport") return actionId === "black_charter" || actionId === "express_import";
  if (buildingTypeId === "city_hall") return actionId === "emergency_decree";
  return false;
};

const isSignificantCraftOutput = (resourceKey: string | undefined): boolean =>
  Boolean(resourceKey && (
    isWeaponOrDefenseOutput(resourceKey)
    || ["neon-dust", "pulse-shot", "velvet-smoke", "ghost-serum", "overdrive-x"].includes(resourceKey)
  ));

const isWeaponOrDefenseOutput = (resourceKey: string | undefined): boolean =>
  Boolean(resourceKey && ["pistol", "smg", "vest", "barricades", "alarm", "combat-module"].includes(resourceKey));

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

const signedNumericValue = (value: unknown): number => {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
};

