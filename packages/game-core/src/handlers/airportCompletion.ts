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
      riskPct: config.expressImport.customsRiskPct
    };
    nextState = addAirportHeatAndRumor(nextState, building, config.expressImport.customsHeatGain, true, lobbyClubConfig);
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

