import type { DrugLabProductionBuildingView, DrugLabProductionLineView } from "@empire/shared-types";
import type { DrugLabRecipeId, ResolvedGameModeConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import {
  DRUG_LAB_BUILDING_TYPE_ID,
} from "../handlers/drugLabProductionShared";
import { getWarehouseCapacityForResource, resolveWarehouseStorageCapacity } from "../handlers/warehouseBuilding";

const LABELS: Record<string, string> = {
  chemicals: "Chemicals",
  biomass: "Biomass",
  "neon-dust": "Neon Dust",
  "pulse-shot": "Pulse Shot",
  "velvet-smoke": "Velvet Smoke"
};

export const createDrugLabProductionBuildingView = (input: {
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  playerId: string;
  config?: ResolvedGameModeConfig;
  tickRateMs?: number;
}): DrugLabProductionBuildingView | null => {
  const drugLab = input.config?.balance.drugLab;
  if (input.building.buildingTypeId !== DRUG_LAB_BUILDING_TYPE_ID || !drugLab) return null;
  const player = input.state.playersById[input.playerId];
  const balances = player ? input.state.resourceStatesById[player.resourceStateId]?.balances ?? {} : {};
  const storage = player && input.config?.balance.warehouse
    ? resolveWarehouseStorageCapacity(input.state, player.id, input.config.balance.warehouse)
    : null;
  const isOwner = input.building.ownerPlayerId === input.playerId && input.building.status === "active";
  const lines = (Object.entries(drugLab.recipes) as Array<[DrugLabRecipeId, typeof drugLab.recipes[DrugLabRecipeId]]>).map(([recipeId, recipe]) => {
    const cleanCash = Math.max(0, Number(balances.cash || 0));
    const inputAvailability = Object.entries(recipe.inputCosts).map(([resourceKey, requiredAmount]) => ({
      resourceKey,
      label: LABELS[resourceKey] ?? resourceKey,
      requiredAmount,
      availableAmount: Math.max(0, Number(balances[resourceKey] || 0))
    }));
    const playerStoredAmount = Math.max(0, Number(balances[recipe.outputResourceKey] || 0));
    const playerStoredCapacity = storage ? getWarehouseCapacityForResource(storage, recipe.outputResourceKey) : 0;
    const maxByStorage = storage
      ? Math.max(0, Math.floor((playerStoredCapacity - playerStoredAmount) / recipe.outputAmount))
      : Number.MAX_SAFE_INTEGER;
    const maxByCash = recipe.cleanCashCostPerUnit > 0
      ? Math.floor(cleanCash / recipe.cleanCashCostPerUnit)
      : Number.MAX_SAFE_INTEGER;
    const maxByInputs = inputAvailability.reduce(
      (limit, item) => Math.min(limit, Math.floor(item.availableAmount / item.requiredAmount)),
      Number.POSITIVE_INFINITY
    );
    const maxStartQuantity = isOwner
      ? Math.max(0, Math.min(recipe.queueCap, maxByCash, maxByInputs, maxByStorage))
      : 0;
    const storageFull = maxByStorage <= 0;
    const missingMaterial = inputAvailability.some((item) => item.availableAmount < item.requiredAmount);
    const disabledReason = !isOwner
      ? input.building.status !== "active" ? "Lab musí být aktivní." : "Lab patří jinému hráči."
      : storageFull ? "Sklad je pro tento produkt plný."
      : cleanCash < recipe.cleanCashCostPerUnit ? "Na spuštění výroby nemáš dost clean cash."
      : missingMaterial ? "Na spuštění výroby nemáš dost materiálových vstupů."
      : null;
    const status = storageFull ? "full" : "ready";
    return {
      executionMode: "instant",
      recipeId,
      resourceKey: recipe.outputResourceKey,
      label: recipe.label,
      description: recipe.description,
      itemRole: recipe.itemRole,
      producedAmount: 0,
      producedCapacity: playerStoredCapacity,
      playerStoredAmount,
      playerStoredCapacity,
      queuedAmount: 0,
      queueCapacity: recipe.queueCap,
      activeAmount: 0,
      waitingAmount: 0,
      unitCleanCashCost: recipe.cleanCashCostPerUnit,
      materialInputCosts: { ...recipe.inputCosts },
      inputAvailability,
      baseUnitDurationTicks: 0,
      effectiveUnitDurationTicks: 0,
      remainingTicks: 0,
      remainingMs: 0,
      status,
      canStart: maxStartQuantity > 0,
      canCancelWaiting: false,
      canCollect: false,
      maxStartQuantity,
      disabledReason
    } satisfies DrugLabProductionLineView;
  });
  return { buildingId: input.building.id, lines };
};
