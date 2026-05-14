import type { AirportBalanceConfig, LobbyClubBalanceConfig, PowerStationBalanceConfig, SmugglingTunnelBalanceConfig, WarehouseBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import { deterministicUnitInterval } from "../utils/math";
import { getWarehouseCapacityForResource, resolveWarehouseStorageCapacity } from "./warehouseBuilding";
import type { AirportCustomsEvent, AirportMetadata, PendingAirportImport } from "./airportTypes";
import { getAirportMetadata, minutesToTicks, withAirportMetadata } from "./airportMetadata";
import { scaleShipment } from "./airportShipments";
import { addAirportHeatAndRumor, applyCustomsInspectionConsequence } from "./airportCustoms";
import { resolveAirportCustomsRiskPct } from "./airportRisk";

export const completeAirportImportsAndCustoms = (
  state: CoreGameState,
  config: AirportBalanceConfig,
  warehouseConfig: WarehouseBalanceConfig | undefined,
  powerStationConfig: PowerStationBalanceConfig | undefined,
  smugglingTunnelConfig: SmugglingTunnelBalanceConfig | undefined,
  tickRateMs: number,
  lobbyClubConfig?: LobbyClubBalanceConfig
): CoreGameState => {
  let nextState = state;
  for (const building of Object.values(nextState.buildingsById)) {
    if (building.buildingTypeId !== config.buildingTypeId || !building.ownerPlayerId || building.status !== "active") continue;
    let currentBuilding = nextState.buildingsById[building.id] ?? building;
    let metadata = getAirportMetadata(currentBuilding, nextState.root.tick);
    const completed = metadata.pendingImports.filter((entry) => entry.completesAtTick <= nextState.root.tick);
    if (completed.length > 0) {
      for (const pending of completed) {
        const completion = completePendingImport(nextState, currentBuilding, pending, config, warehouseConfig, powerStationConfig, lobbyClubConfig);
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
        const consequence = applyCustomsInspectionConsequence(nextState, currentBuilding, config, riskPct, tickRateMs, lobbyClubConfig);
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

const completePendingImport = (
  state: CoreGameState,
  building: CoreGameState["buildingsById"][string],
  pending: PendingAirportImport,
  config: AirportBalanceConfig,
  warehouseConfig?: WarehouseBalanceConfig,
  powerStationConfig?: PowerStationBalanceConfig,
  lobbyClubConfig?: LobbyClubBalanceConfig
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
      rumorText: formatExpressImportCustomsRumor(state, building)
    };
    nextState = addAirportHeatAndRumor(nextState, building, config.expressImport.customsHeatGain, customsEvent.rumorText, lobbyClubConfig);
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

const EXPRESS_IMPORT_CUSTOMS_RUMORS = [
  "Okolím Letiště prý proběhla tichá kontrola. Z kontejneru zmizel náklad a nikdo nechce říct čí.",
  "Celníci údajně vytáhli část zásilky dřív, než se stihla zapsat do skladu. Administrativa tentokrát běžela rychleji než zločin.",
  "Šeptá se, že expresní dovoz narazil na modré rukavice a drahé ticho.",
  "U rampy prý chybělo pár beden. Manifest se tváří čistěji než realita, což je jeho práce.",
  "Někdo tvrdí, že kontrola byla krátká, ale náklad po ní výrazně zhubnul. Dieta podle celní správy.",
  "Zdroj z letiště říká, že zásilka prošla, jen ne celá. Zbytek prý spolkl systém a odříhl si."
];

const formatExpressImportCustomsRumor = (
  state: CoreGameState,
  building: CoreGameState["buildingsById"][string]
): string => {
  const owner = building.ownerPlayerId ? state.playersById[building.ownerPlayerId] : undefined;
  const name = owner?.name?.trim() || owner?.id || "někdo s přístupem k runway";
  const index = Math.floor(deterministicUnitInterval(`${state.serverInstance.worldSeed}:express-import-rumor:${building.id}:${state.root.tick}`) * EXPRESS_IMPORT_CUSTOMS_RUMORS.length);
  const text = EXPRESS_IMPORT_CUSTOMS_RUMORS[index] ?? EXPRESS_IMPORT_CUSTOMS_RUMORS[0] ?? "";
  return `${text} V čekárně prý padlo jméno ${name}, ale nikdo za něj neručí. Letištní židle slyšely horší věci.`;
};
