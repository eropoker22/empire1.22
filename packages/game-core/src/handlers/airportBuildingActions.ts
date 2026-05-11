import type { RunBuildingActionCommand } from "@empire/shared-types";
import type { AirportBalanceConfig, BuildingActionBalanceConfig, FixedBuildingBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import type { AirportActionResolution, AirportMetadata, PendingAirportImport } from "./airportTypes";
import {
  getAirportMetadata,
  getOwnedAirport,
  hasOwnedBuilding,
  minutesToTicks,
  resolveImportCategory,
  resolveImportCategoryOrNull,
  withAirportMetadata
} from "./airportMetadata";
import { createImportShipment } from "./airportShipments";

export type { AirportActionResolution, AirportCustomsEvent, AirportImportCategory, AirportMetadata, PendingAirportImport } from "./airportTypes";
export { completeAirportImportsAndCustoms } from "./airportCompletion";
export { getAirportMetadata } from "./airportMetadata";
export { resolveAirportCustomsRiskPct } from "./airportRisk";

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
