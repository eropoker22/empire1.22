import type { CityFeedEvent, RunBuildingActionCommand } from "@empire/shared-types";
import type { AirportBalanceConfig, BuildingActionBalanceConfig, FixedBuildingBalanceConfig, PowerStationBalanceConfig, SmugglingTunnelBalanceConfig, WarehouseBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import { deterministicUnitInterval } from "../utils/math";
import { getWarehouseCapacityForResource, resolveWarehouseStorageCapacity } from "./warehouseBuilding";

export type AirportImportCategory = "materials" | "rareComponents" | "weapons" | "defenseItems";

interface PendingAirportImport {
  importId: string;
  category: AirportImportCategory;
  startedAtTick: number;
  completesAtTick: number;
  shipment: Record<string, number>;
}

interface AirportCustomsEvent {
  type: string;
  tick: number;
  label: string;
  riskPct: number;
  rumorText?: string;
}

interface AirportMetadata {
  pendingImports: PendingAirportImport[];
  blackCharterExpiresAtTick?: number;
  blackCharterOffer?: {
    items: string[];
    discountPct: number;
    purchaseCustomsRiskPct: number;
  };
  evacuationCorridorExpiresAtTick?: number;
  discountDisabledUntilTick?: number;
  nextImportCostPenaltyPct?: number;
  lastCustomsInspectionTick?: number;
  lastImportShipment?: {
    tick: number;
    category: AirportImportCategory;
    requestedItems: Record<string, number>;
    acceptedItems: Record<string, number>;
    lostItems: Record<string, number>;
    customsTriggered: boolean;
  };
  customsEvents: AirportCustomsEvent[];
}

export interface AirportActionResolution {
  balances: Record<string, number>;
  buildingMetadata: Record<string, unknown>;
  heatGain: number;
  influenceChange: number;
  outputGain: Record<string, number>;
  inputCost: Record<string, number>;
  effectModifiers?: BuildingActionBalanceConfig["effectModifiers"];
  reportText: string;
  airportResult: Record<string, unknown>;
}

export const getAirportMetadata = (
  building: CoreGameState["buildingsById"][string],
  tick = 0
): AirportMetadata => cleanupAirportMetadata(readAirportMetadata(building), tick);

export const applyAirportIncomeModifiers = (input: {
  config: AirportBalanceConfig;
  building: CoreGameState["buildingsById"][string];
  cleanPerHour: number;
  dirtyPerHour: number;
  heatPerDay: number;
  influencePerDay: number;
}): FixedBuildingBalanceConfig => {
  if (input.building.buildingTypeId !== input.config.buildingTypeId) {
    return {
      cleanPerHour: input.cleanPerHour,
      dirtyPerHour: input.dirtyPerHour,
      heatPerDay: input.heatPerDay,
      influencePerDay: input.influencePerDay,
      maxLevel: 1
    };
  }
  return {
    cleanPerHour: input.cleanPerHour,
    dirtyPerHour: input.dirtyPerHour,
    heatPerDay: input.heatPerDay,
    influencePerDay: input.influencePerDay,
    maxLevel: 1
  };
};

export const resolveAirportImportDiscountPct = (input: {
  state: CoreGameState | Record<string, any>;
  playerId: string | null | undefined;
  config?: AirportBalanceConfig;
  marketType: "normal" | "black" | "player" | "emergency";
  category: string;
  tick?: number;
}): number => {
  const building = getOwnedAirport(input.state, input.playerId, input.config);
  if (!building || !input.config) return 0;
  const tick = Number(input.tick ?? (input.state as CoreGameState).root?.tick ?? (input.state as any).serverInstance?.currentTick ?? 0);
  const metadata = getAirportMetadata(building as CoreGameState["buildingsById"][string], tick);
  if (Number(metadata.discountDisabledUntilTick || 0) > tick) return 0;
  if (input.marketType === "black") return input.config.importDiscount.blackMarketItemsPct;
  const base = input.category === "materials"
    ? input.config.importDiscount.materialsPct + (hasOwnedBuilding(input.state, input.playerId, "shopping_mall") ? input.config.importDiscount.shoppingMallMaterialsSynergyPct : 0)
    : input.category === "rareComponents"
      ? input.config.importDiscount.rareComponentsPct
      : input.category === "weapons"
        ? input.config.importDiscount.weaponsPct
        : input.category === "defenseItems"
          ? input.config.importDiscount.defenseItemsPct
          : input.config.importDiscount.drugsAndBoostsPct;
  return Math.max(0, base);
};

export const resolveAirportCustomsRiskPct = (input: {
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  config: AirportBalanceConfig;
  smugglingTunnelConfig?: SmugglingTunnelBalanceConfig;
  tick: number;
}): number => {
  const player = input.building.ownerPlayerId ? input.state.playersById[input.building.ownerPlayerId] : undefined;
  const policeState = player ? input.state.policeStatesById[player.policeStateId] : undefined;
  const metadata = getAirportMetadata(input.building, input.tick);
  const heatRisk = Number(policeState?.heat || 0) > input.config.customsInspection.heatThreshold
    ? input.config.customsInspection.heatRiskPct
    : 0;
  const tunnelRisk = input.smugglingTunnelConfig && input.building.ownerPlayerId && getOwnedBuildingCount(input.state, input.building.ownerPlayerId, input.smugglingTunnelConfig.buildingTypeId) >= input.config.customsInspection.smugglingTunnelThreshold
    ? input.config.customsInspection.smugglingTunnelRiskPct
    : 0;
  const corridorRisk = Number(metadata.evacuationCorridorExpiresAtTick || 0) > input.tick
    ? input.config.evacuationCorridor.customsRiskPct
    : 0;
  const stockRisk = input.building.ownerPlayerId && hasOwnedBuilding(input.state, input.building.ownerPlayerId, "stock_exchange")
    ? input.config.customsInspection.stockExchangeSynergyRiskPct
    : 0;
  return Math.min(100, input.config.customsInspection.passiveRiskPct + heatRisk + tunnelRisk + corridorRisk + stockRisk);
};

export const resolveAirportAction = (input: {
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  action: BuildingActionBalanceConfig;
  balances: Record<string, number>;
  config: AirportBalanceConfig;
  tickRateMs: number;
  commandId: string;
  payload: RunBuildingActionCommand["payload"];
}): AirportActionResolution | null => {
  if (input.building.buildingTypeId !== input.config.buildingTypeId) return null;
  const metadata = getAirportMetadata(input.building, input.state.root.tick);
  const actionId = input.action.actionId;

  if (actionId === input.config.expressImport.actionId) {
    const category = resolveImportCategory(input.payload.targetCategory ?? input.payload.category, input.config.expressImport.targetCategories);
    const penaltyPct = Math.max(0, Number(metadata.nextImportCostPenaltyPct || 0));
    const cost = Math.ceil(input.config.expressImport.costCleanCash * (1 + penaltyPct / 100));
    const importId = `airport-import:${input.commandId}`;
    const completesAtTick = input.state.root.tick + Math.max(1, Math.ceil(input.config.expressImport.durationSeconds * 1000 / Math.max(1, input.tickRateMs)));
    const pendingImport: PendingAirportImport = {
      importId,
      category,
      startedAtTick: input.state.root.tick,
      completesAtTick,
      shipment: createImportShipment(category, input.config, `${input.commandId}:${input.state.root.tick}`)
    };
    const nextMetadata: AirportMetadata = {
      ...metadata,
      nextImportCostPenaltyPct: 0,
      pendingImports: [...metadata.pendingImports, pendingImport].slice(-4)
    };
    return {
      balances: {
        ...input.balances,
        cash: Math.max(0, Number(input.balances.cash || 0) - cost)
      },
      buildingMetadata: withAirportMetadata(input.building, nextMetadata),
      heatGain: input.config.expressImport.heatGain,
      influenceChange: 0,
      inputCost: { cash: cost },
      outputGain: {},
      reportText: `Expresní dovoz (${category}) přistane v ticku ${completesAtTick}.`,
      airportResult: {
        type: "express_import_started",
        category,
        importId,
        completesAtTick,
        costCleanCash: cost,
        nextImportCostPenaltyAppliedPct: penaltyPct,
        customsRiskPct: input.config.expressImport.customsRiskPct,
        shipmentPreview: pendingImport.shipment
      }
    };
  }

  if (actionId === input.config.blackCharter.actionId) {
    const expiresAtTick = input.state.root.tick + minutesToTicks(input.config.blackCharter.durationMinutes, input.tickRateMs);
    const nextMetadata: AirportMetadata = {
      ...metadata,
      blackCharterExpiresAtTick: expiresAtTick,
      blackCharterOffer: {
        items: [...input.config.blackCharter.offerItems],
        discountPct: input.config.blackCharter.specialOfferDiscountPct,
        purchaseCustomsRiskPct: input.config.blackCharter.purchaseCustomsRiskPct
      }
    };
    return {
      balances: {
        ...input.balances,
        "dirty-cash": Math.max(0, Number(input.balances["dirty-cash"] || 0) - input.config.blackCharter.costDirtyCash)
      },
      buildingMetadata: withAirportMetadata(input.building, nextMetadata),
      heatGain: input.config.blackCharter.heatGain,
      influenceChange: 0,
      inputCost: { "dirty-cash": input.config.blackCharter.costDirtyCash },
      outputGain: {},
      reportText: `Černý charter otevřel speciální Black Market nabídku do ticku ${expiresAtTick}.`,
      airportResult: {
        type: "black_charter_opened",
        activeUntilTick: expiresAtTick,
        items: input.config.blackCharter.offerItems,
        discountPct: input.config.blackCharter.specialOfferDiscountPct,
        purchaseCustomsRiskPct: input.config.blackCharter.purchaseCustomsRiskPct
      }
    };
  }

  if (actionId === input.config.evacuationCorridor.actionId) {
    const expiresAtTick = input.state.root.tick + minutesToTicks(input.config.evacuationCorridor.durationMinutes, input.tickRateMs);
    const nextMetadata: AirportMetadata = {
      ...metadata,
      evacuationCorridorExpiresAtTick: expiresAtTick
    };
    return {
      balances: {
        ...input.balances,
        cash: Math.max(0, Number(input.balances.cash || 0) - input.config.evacuationCorridor.costCleanCash)
      },
      buildingMetadata: withAirportMetadata(input.building, nextMetadata),
      heatGain: input.config.evacuationCorridor.heatGain,
      influenceChange: 0,
      inputCost: { cash: input.config.evacuationCorridor.costCleanCash },
      outputGain: {},
      reportText: `Evakuační koridor je aktivní do ticku ${expiresAtTick}.`,
      airportResult: {
        type: "evacuation_corridor_active",
        activeUntilTick: expiresAtTick,
        escapeChanceBonusPct: input.config.evacuationCorridor.escapeChanceBonusPct,
        equipmentLossReductionPct: input.config.evacuationCorridor.equipmentLossReductionPct,
        peopleLossReductionPct: input.config.evacuationCorridor.peopleLossReductionPct
      }
    };
  }

  return null;
};

export const validateAirportAction = (input: {
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  actionId: string;
  balances: Record<string, number>;
  config?: AirportBalanceConfig;
  payload: RunBuildingActionCommand["payload"];
}): string | null => {
  const config = input.config;
  if (!config || input.building.buildingTypeId !== config.buildingTypeId) return null;
  const metadata = getAirportMetadata(input.building, input.state.root.tick);
  if (input.actionId === config.expressImport.actionId) {
    const category = resolveImportCategoryOrNull(input.payload.targetCategory ?? input.payload.category, config.expressImport.targetCategories);
    if (!category) return "airport_invalid_import_category";
    const penaltyPct = Math.max(0, Number(metadata.nextImportCostPenaltyPct || 0));
    const cost = Math.ceil(config.expressImport.costCleanCash * (1 + penaltyPct / 100));
    if (Math.max(0, Number(input.balances.cash || 0)) < cost) return "airport_insufficient_clean_cash";
  }
  if (input.actionId === config.blackCharter.actionId) {
    if (Math.max(0, Number(input.balances["dirty-cash"] || 0)) < config.blackCharter.costDirtyCash) return "airport_insufficient_dirty_cash";
    if (Number(metadata.blackCharterExpiresAtTick || 0) > input.state.root.tick) return "airport_black_charter_active";
  }
  if (input.actionId === config.evacuationCorridor.actionId) {
    if (Math.max(0, Number(input.balances.cash || 0)) < config.evacuationCorridor.costCleanCash) return "airport_insufficient_clean_cash";
    if (Number(metadata.evacuationCorridorExpiresAtTick || 0) > input.state.root.tick) return "airport_evacuation_corridor_active";
  }
  return null;
};

export const completeAirportImportsAndCustoms = (
  state: CoreGameState,
  config: AirportBalanceConfig,
  warehouseConfig: WarehouseBalanceConfig | undefined,
  powerStationConfig: PowerStationBalanceConfig | undefined,
  smugglingTunnelConfig: SmugglingTunnelBalanceConfig | undefined,
  tickRateMs: number
): CoreGameState => {
  let nextState = state;
  for (const building of Object.values(nextState.buildingsById)) {
    if (building.buildingTypeId !== config.buildingTypeId || !building.ownerPlayerId || building.status !== "active") continue;
    let currentBuilding = nextState.buildingsById[building.id] ?? building;
    let metadata = getAirportMetadata(currentBuilding, nextState.root.tick);
    const completed = metadata.pendingImports.filter((entry) => entry.completesAtTick <= nextState.root.tick);
    if (completed.length > 0) {
      for (const pending of completed) {
        const completion = completePendingImport(nextState, currentBuilding, pending, config, warehouseConfig, powerStationConfig);
        nextState = completion.state;
        currentBuilding = nextState.buildingsById[building.id] ?? currentBuilding;
        metadata = {
          ...getAirportMetadata(currentBuilding, nextState.root.tick),
          lastImportShipment: completion.lastImportShipment,
          customsEvents: completion.customsEvent
            ? [...getAirportMetadata(currentBuilding, nextState.root.tick).customsEvents, completion.customsEvent].slice(-10)
            : getAirportMetadata(currentBuilding, nextState.root.tick).customsEvents
        };
      }
      metadata = {
        ...metadata,
        pendingImports: metadata.pendingImports.filter((entry) => entry.completesAtTick > nextState.root.tick)
      };
    }

    const intervalTicks = minutesToTicks(config.customsInspection.intervalMinutes, tickRateMs);
    if (Number(metadata.lastCustomsInspectionTick ?? 0) + intervalTicks <= nextState.root.tick) {
      const riskPct = resolveAirportCustomsRiskPct({ state: nextState, building: currentBuilding, config, smugglingTunnelConfig, tick: nextState.root.tick });
      const roll = deterministicUnitInterval(`${nextState.serverInstance.worldSeed}:airport-customs:${building.id}:${nextState.root.tick}`);
      metadata = { ...metadata, lastCustomsInspectionTick: nextState.root.tick };
      if (roll < riskPct / 100) {
        const consequence = applyCustomsInspectionConsequence(nextState, currentBuilding, config, riskPct, tickRateMs);
        nextState = consequence.state;
        currentBuilding = nextState.buildingsById[building.id] ?? currentBuilding;
        metadata = {
          ...metadata,
          ...consequence.metadataPatch,
          customsEvents: [...metadata.customsEvents, consequence.event].slice(-10)
        };
      }
    }

    currentBuilding = nextState.buildingsById[building.id] ?? currentBuilding;
    nextState = {
      ...nextState,
      buildingsById: {
        ...nextState.buildingsById,
        [building.id]: {
          ...currentBuilding,
          metadata: withAirportMetadata(currentBuilding, metadata),
          version: currentBuilding.version + 1
        }
      }
    };
  }
  return nextState;
};

export const resolveAirportEvacuationSupport = (input: {
  state: CoreGameState;
  playerId: string | null | undefined;
  config?: AirportBalanceConfig;
  tick: number;
}): { active: boolean; escapeChanceBonusPct: number; equipmentLossReductionPct: number; peopleLossReductionPct: number } => {
  const building = getOwnedAirport(input.state, input.playerId, input.config);
  if (!building || !input.config) return { active: false, escapeChanceBonusPct: 0, equipmentLossReductionPct: 0, peopleLossReductionPct: 0 };
  const metadata = getAirportMetadata(building, input.tick);
  const active = Number(metadata.evacuationCorridorExpiresAtTick || 0) > input.tick;
  return {
    active,
    escapeChanceBonusPct: active ? input.config.evacuationCorridor.escapeChanceBonusPct : 0,
    equipmentLossReductionPct: active ? input.config.evacuationCorridor.equipmentLossReductionPct : 0,
    peopleLossReductionPct: active ? input.config.evacuationCorridor.peopleLossReductionPct : 0
  };
};

const completePendingImport = (
  state: CoreGameState,
  building: CoreGameState["buildingsById"][string],
  pending: PendingAirportImport,
  config: AirportBalanceConfig,
  warehouseConfig?: WarehouseBalanceConfig,
  powerStationConfig?: PowerStationBalanceConfig
): { state: CoreGameState; lastImportShipment: NonNullable<AirportMetadata["lastImportShipment"]>; customsEvent?: AirportCustomsEvent } => {
  const player = state.playersById[building.ownerPlayerId ?? ""];
  if (!player) {
    return {
      state,
      lastImportShipment: { tick: state.root.tick, category: pending.category, requestedItems: pending.shipment, acceptedItems: {}, lostItems: pending.shipment, customsTriggered: false }
    };
  }
  const customsTriggered = deterministicUnitInterval(`${state.serverInstance.worldSeed}:${pending.importId}:customs`) < config.expressImport.customsRiskPct / 100;
  const shipment = customsTriggered
    ? scaleShipment(pending.shipment, 1 - config.expressImport.customsShipmentPenaltyPct / 100)
    : pending.shipment;
  const playerResourceState = state.resourceStatesById[player.resourceStateId] ?? {
    id: player.resourceStateId,
    ownerType: "player" as const,
    ownerId: player.id,
    balances: {},
    incomeModifiers: {},
    lastUpdatedTick: state.root.tick,
    version: 1
  };
  const capacity = warehouseConfig
    ? resolveWarehouseStorageCapacity(state, player.id, warehouseConfig, powerStationConfig)
    : null;
  const acceptedItems: Record<string, number> = {};
  const lostItems: Record<string, number> = {};
  const nextBalances = { ...playerResourceState.balances };

  for (const [itemId, amount] of Object.entries(shipment)) {
    const requested = Math.max(0, Math.floor(Number(amount || 0)));
    const cap = capacity ? getWarehouseCapacityForResource(capacity, itemId) : Number.POSITIVE_INFINITY;
    const current = Math.max(0, Number(nextBalances[itemId] || 0));
    const accepted = Number.isFinite(cap) ? Math.max(0, Math.min(requested, cap - current)) : requested;
    if (accepted > 0) {
      nextBalances[itemId] = current + accepted;
      acceptedItems[itemId] = accepted;
    }
    if (requested > accepted) {
      lostItems[itemId] = requested - accepted;
    }
  }

  let nextState: CoreGameState = {
    ...state,
    resourceStatesById: {
      ...state.resourceStatesById,
      [playerResourceState.id]: {
        ...playerResourceState,
        balances: nextBalances,
        lastUpdatedTick: state.root.tick,
        version: playerResourceState.version + (state.resourceStatesById[player.resourceStateId] ? 1 : 0)
      }
    }
  };
  let customsEvent: AirportCustomsEvent | undefined;
  if (customsTriggered) {
    customsEvent = {
      type: "express_import_customs_check",
      tick: state.root.tick,
      label: "Celní kontrola",
      riskPct: config.expressImport.customsRiskPct,
      rumorText: "Okolím Letiště se šíří drb o podezřelém nákladu, který celníci vytáhli z kontejneru."
    };
    nextState = addAirportHeatAndRumor(nextState, building, config.expressImport.customsHeatGain, customsEvent.rumorText);
  }
  return {
    state: nextState,
    customsEvent,
    lastImportShipment: {
      tick: state.root.tick,
      category: pending.category,
      requestedItems: pending.shipment,
      acceptedItems,
      lostItems,
      customsTriggered
    }
  };
};

const applyCustomsInspectionConsequence = (
  state: CoreGameState,
  building: CoreGameState["buildingsById"][string],
  config: AirportBalanceConfig,
  riskPct: number,
  tickRateMs: number
): { state: CoreGameState; metadataPatch: Partial<AirportMetadata>; event: AirportCustomsEvent } => {
  const roll = deterministicUnitInterval(`${state.serverInstance.worldSeed}:airport-customs-type:${building.id}:${state.root.tick}`);
  const type = ["held_container", "customs_stamp", "hangar_search", "lost_papers", "cargo_rumor"][Math.min(4, Math.floor(roll * 5))];
  const labels: Record<string, string> = {
    held_container: "Zadržený kontejner",
    customs_stamp: "Celní razítko",
    hangar_search: "Prohlídka hangáru",
    lost_papers: "Ztracené papíry",
    cargo_rumor: "Drb o nákladu"
  };
  let nextState = state;
  const metadataPatch: Partial<AirportMetadata> = {};
  let rumorText: string | undefined;
  if (type === "customs_stamp") {
    metadataPatch.discountDisabledUntilTick = state.root.tick + minutesToTicks(config.customsInspection.discountDisabledMinutes, tickRateMs);
  } else if (type === "hangar_search") {
    nextState = addAirportHeatAndRumor(nextState, building, config.customsInspection.hangarHeatGain);
  } else if (type === "lost_papers") {
    metadataPatch.nextImportCostPenaltyPct = config.customsInspection.nextImportCostPenaltyPct;
  } else if (type === "cargo_rumor") {
    rumorText = "V okolí Letiště se mluví o falešných papírech a nákladu, který zmizel dřív, než dorazil na manifest.";
    nextState = addAirportHeatAndRumor(nextState, building, 0, rumorText);
  }
  return {
    state: nextState,
    metadataPatch,
    event: { type, tick: state.root.tick, label: labels[type] ?? type, riskPct, rumorText }
  };
};

const addAirportHeatAndRumor = (
  state: CoreGameState,
  building: CoreGameState["buildingsById"][string],
  heatGain: number,
  rumorText?: string
): CoreGameState => {
  const district = state.districtsById[building.districtId];
  let nextState = district && heatGain > 0
    ? {
        ...state,
        districtsById: {
          ...state.districtsById,
          [district.id]: {
            ...district,
            heat: Math.max(0, Number(district.heat || 0) + heatGain),
            version: district.version + 1
          }
        }
      }
    : state;
  if (!rumorText) return nextState;
  const sourceEventId = `airport-customs:${building.id}:${state.root.tick}:${Math.abs(hashText(rumorText))}`;
  const event: CityFeedEvent = {
    id: `city-feed:${sourceEventId}`,
    sourceEventId,
    sourceType: "market",
    category: "rumor",
    severity: "medium",
    truthiness: "unconfirmed",
    visibility: "all",
    playerId: building.ownerPlayerId,
    districtId: building.districtId,
    createdAtTick: state.root.tick,
    message: rumorText,
    messageKey: "rumor.airport_customs",
    payload: { buildingTypeId: building.buildingTypeId, heatGain }
  };
  if (nextState.cityFeedEventsById?.[event.id]) return nextState;
  return {
    ...nextState,
    cityFeedEventsById: {
      ...(nextState.cityFeedEventsById ?? {}),
      [event.id]: event
    }
  };
};

const createImportShipment = (
  category: AirportImportCategory,
  config: AirportBalanceConfig,
  seed: string
): Record<string, number> => {
  const range = config.expressImport.shipmentValueRanges[category] ?? { min: 1200, max: 2000 };
  const value = Math.floor(interpolate(range.min, range.max, deterministicUnitInterval(`${seed}:value`)));
  if (category === "materials") {
    return splitValueIntoItems(value, [
      { itemId: "metal-parts", unitValue: 18, weight: 0.45 },
      { itemId: "chemicals", unitValue: 28, weight: 0.3 },
      { itemId: "biomass", unitValue: 16, weight: 0.25 }
    ]);
  }
  if (category === "rareComponents") {
    return splitValueIntoItems(value, [
      { itemId: "tech-core", unitValue: 85, weight: 0.75 },
      { itemId: "combat-module", unitValue: 160, weight: 0.25 }
    ]);
  }
  if (category === "weapons") {
    return splitValueIntoItems(value, [
      { itemId: "baseball-bat", unitValue: 90, weight: 0.24 },
      { itemId: "pistol", unitValue: 180, weight: 0.28 },
      { itemId: "grenade", unitValue: 220, weight: 0.2 },
      { itemId: "smg", unitValue: 420, weight: 0.22 },
      { itemId: "bazooka", unitValue: 900, weight: 0.06 }
    ]);
  }
  return splitValueIntoItems(value, [
    { itemId: "vest", unitValue: 160, weight: 0.28 },
    { itemId: "barricades", unitValue: 140, weight: 0.24 },
    { itemId: "cameras", unitValue: 260, weight: 0.22 },
    { itemId: "alarm", unitValue: 220, weight: 0.2 },
    { itemId: "defense-tower", unitValue: 800, weight: 0.06 }
  ]);
};

const splitValueIntoItems = (
  value: number,
  items: Array<{ itemId: string; unitValue: number; weight: number }>
): Record<string, number> =>
  Object.fromEntries(items.map((item) => [
    item.itemId,
    Math.max(1, Math.floor(value * item.weight / Math.max(1, item.unitValue)))
  ]));

const scaleShipment = (shipment: Record<string, number>, multiplier: number): Record<string, number> =>
  Object.fromEntries(Object.entries(shipment).map(([itemId, amount]) => [itemId, Math.max(0, Math.floor(Number(amount || 0) * multiplier))]));

const getOwnedAirport = (
  state: CoreGameState | Record<string, any>,
  playerId: string | null | undefined,
  config?: AirportBalanceConfig
): CoreGameState["buildingsById"][string] | undefined => {
  if (!config || !playerId) return undefined;
  return Object.values((state as CoreGameState).buildingsById ?? {}).find((building: any) =>
    building?.buildingTypeId === config.buildingTypeId
    && building?.ownerPlayerId === playerId
    && building?.status === "active"
  ) as CoreGameState["buildingsById"][string] | undefined;
};

const hasOwnedBuilding = (state: CoreGameState | Record<string, any>, playerId: string | null | undefined, buildingTypeId: string): boolean =>
  Boolean(playerId) && Object.values((state as CoreGameState).buildingsById ?? {}).some((building: any) =>
    building?.buildingTypeId === buildingTypeId && building?.ownerPlayerId === playerId && building?.status === "active"
  );

const getOwnedBuildingCount = (state: CoreGameState, playerId: string, buildingTypeId: string): number =>
  Object.values(state.buildingsById).filter((building) =>
    building.buildingTypeId === buildingTypeId && building.ownerPlayerId === playerId && building.status === "active"
  ).length;

const readAirportMetadata = (building: CoreGameState["buildingsById"][string]): AirportMetadata => {
  const raw = isRecord(building.metadata?.airport) ? building.metadata.airport : {};
  return {
    pendingImports: Array.isArray(raw.pendingImports) ? raw.pendingImports.filter(isRecord).map(readPendingImport).filter((entry): entry is PendingAirportImport => Boolean(entry)) : [],
    blackCharterExpiresAtTick: asOptionalTick(raw.blackCharterExpiresAtTick),
    blackCharterOffer: isRecord(raw.blackCharterOffer)
      ? {
          items: Array.isArray(raw.blackCharterOffer.items) ? raw.blackCharterOffer.items.map(String) : [],
          discountPct: Number(raw.blackCharterOffer.discountPct || 0),
          purchaseCustomsRiskPct: Number(raw.blackCharterOffer.purchaseCustomsRiskPct || 0)
        }
      : undefined,
    evacuationCorridorExpiresAtTick: asOptionalTick(raw.evacuationCorridorExpiresAtTick),
    discountDisabledUntilTick: asOptionalTick(raw.discountDisabledUntilTick),
    nextImportCostPenaltyPct: Number(raw.nextImportCostPenaltyPct || 0),
    lastCustomsInspectionTick: asOptionalTick(raw.lastCustomsInspectionTick),
    lastImportShipment: isRecord(raw.lastImportShipment)
      ? {
          tick: Math.floor(Number(raw.lastImportShipment.tick || 0)),
          category: resolveImportCategory(raw.lastImportShipment.category, ["materials", "rareComponents", "weapons", "defenseItems"]),
          requestedItems: readNumberRecord(raw.lastImportShipment.requestedItems),
          acceptedItems: readNumberRecord(raw.lastImportShipment.acceptedItems),
          lostItems: readNumberRecord(raw.lastImportShipment.lostItems),
          customsTriggered: Boolean(raw.lastImportShipment.customsTriggered)
        }
      : undefined,
    customsEvents: Array.isArray(raw.customsEvents) ? raw.customsEvents.filter(isRecord).map((entry) => ({ type: String(entry.type || ""), tick: Math.floor(Number(entry.tick || 0)), label: String(entry.label || entry.type || ""), riskPct: Number(entry.riskPct || 0), rumorText: entry.rumorText ? String(entry.rumorText) : undefined })).filter((entry) => entry.type) : []
  };
};

const cleanupAirportMetadata = (metadata: AirportMetadata, tick: number): AirportMetadata => ({
  ...metadata,
  blackCharterOffer: Number(metadata.blackCharterExpiresAtTick || 0) > tick ? metadata.blackCharterOffer : undefined,
  pendingImports: metadata.pendingImports.filter((entry) => entry.completesAtTick > tick || entry.completesAtTick === tick),
  customsEvents: metadata.customsEvents.slice(-10)
});

const readPendingImport = (entry: Record<string, unknown>): PendingAirportImport | null => {
  const category = resolveImportCategoryOrNull(entry.category, ["materials", "rareComponents", "weapons", "defenseItems"]);
  if (!category) return null;
  return {
    importId: String(entry.importId || ""),
    category,
    startedAtTick: Math.floor(Number(entry.startedAtTick || 0)),
    completesAtTick: Math.floor(Number(entry.completesAtTick || 0)),
    shipment: readNumberRecord(entry.shipment)
  };
};

const withAirportMetadata = (
  building: CoreGameState["buildingsById"][string],
  airport: AirportMetadata
): Record<string, unknown> => ({
  ...(building.metadata ?? {}),
  airport
});

const resolveImportCategory = (value: unknown, allowed: string[]): AirportImportCategory =>
  resolveImportCategoryOrNull(value, allowed) ?? "materials";

const resolveImportCategoryOrNull = (value: unknown, allowed: string[]): AirportImportCategory | null => {
  const normalized = String(value ?? "").trim();
  return allowed.includes(normalized) ? normalized as AirportImportCategory : null;
};

const readNumberRecord = (value: unknown): Record<string, number> =>
  isRecord(value)
    ? Object.fromEntries(
        Object.entries(value)
          .map(([key, amount]) => [key, Math.max(0, Math.floor(Number(amount || 0)))] as const)
          .filter((entry) => entry[1] > 0)
      )
    : {};

const asOptionalTick = (value: unknown): number | undefined => {
  const tick = Math.floor(Number(value || 0));
  return tick > 0 ? tick : undefined;
};

const minutesToTicks = (minutes: number, tickRateMs: number): number =>
  Math.max(1, Math.ceil(minutes * 60 * 1000 / Math.max(1, tickRateMs)));

const interpolate = (min: number, max: number, unit: number): number =>
  min + (max - min) * Math.max(0, Math.min(1, unit));

const hashText = (value: string): number =>
  Array.from(value).reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) | 0, 0);

const isRecord = (value: unknown): value is Record<string, any> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
