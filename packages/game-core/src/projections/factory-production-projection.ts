import type { FactoryProductionBuildingView, FactoryProductionLineView } from "@empire/shared-types";
import type { FactoryRecipeId, ResolvedGameModeConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import { resolveProductionBuildingLevelMultiplier } from "../rules/buildings/buildingUpgradeRules";
import {
  FACTORY_BUILDING_TYPE_ID,
  isFactoryOwnedBy,
  resolveActiveFactoryCount,
  resolveFactoryNetworkSpeedMultiplier
} from "../handlers/factoryProductionShared";
import { getWarehouseCapacityForResource, resolveWarehouseStorageCapacity } from "../handlers/warehouseBuilding";
import { createTimedFactoryProductionBuildingView } from "./timed-production-projections";

const RESOURCE_LABELS: Record<string, string> = {
  cash: "Clean Cash",
  "metal-parts": "Metal Parts",
  "tech-core": "Tech Core",
  "combat-module": "Bojový modul"
};

export const createFactoryProductionBuildingView = (input: {
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  playerId: string;
  config?: ResolvedGameModeConfig;
  tickRateMs?: number;
}): FactoryProductionBuildingView | null => {
  return createTimedFactoryProductionBuildingView(input);
  /* legacy instant projection retained below only for snapshot compatibility reference */
  const factory = input.config?.balance.factory;
  if (input.building.buildingTypeId !== FACTORY_BUILDING_TYPE_ID || !factory) return null;
  const player = input.state.playersById[input.playerId];
  const balances = player ? input.state.resourceStatesById[player.resourceStateId]?.balances ?? {} : {};
  const storage = player && input.config?.balance.warehouse
    ? resolveWarehouseStorageCapacity(input.state, player.id, input.config.balance.warehouse)
    : null;
  const isOwner = isFactoryOwnedBy(input.state, input.building, input.playerId) && input.building.status === "active";
  const activeFactoryCount = resolveActiveFactoryCount(input.state, input.playerId);
  const networkSpeedMultiplier = resolveFactoryNetworkSpeedMultiplier(activeFactoryCount, factory);
  const levelSpeedMultiplier = resolveProductionBuildingLevelMultiplier(input.building, { config: input.config! });
  const ownershipDisabledReason = isOwner
    ? null
    : input.building.status !== "active" ? "Továrna musí být aktivní." : "Továrna patří jinému hráči.";
  const productionLines = (Object.entries(factory.recipes) as Array<[FactoryRecipeId, typeof factory.recipes[FactoryRecipeId]]>).map(([recipeId, recipe]) => {
    const cleanCash = Math.max(0, Number(balances.cash || 0));
    const playerStoredAmount = Math.max(0, Number(balances[recipe.outputResourceKey] || 0));
    const playerStoredCapacity = storage ? getWarehouseCapacityForResource(storage, recipe.outputResourceKey) : 0;
    const maxByStorage = storage
      ? Math.max(0, Math.floor((playerStoredCapacity - playerStoredAmount) / recipe.outputAmount))
      : Number.MAX_SAFE_INTEGER;
    const maxByCash = recipe.cleanCashCostPerUnit > 0
      ? Math.floor(cleanCash / recipe.cleanCashCostPerUnit)
      : Number.MAX_SAFE_INTEGER;
    const maxByInputs = Object.entries(recipe.inputCosts).reduce(
      (max, [resourceKey, amount]) => Math.min(max, Math.floor(Math.max(0, Number(balances[resourceKey] || 0)) / amount)),
      Number.POSITIVE_INFINITY
    );
    const maxStartQuantity = isOwner
      ? Math.max(0, Math.min(recipe.queueCap, maxByCash, maxByInputs, maxByStorage))
      : 0;
    const missingInputs = Object.entries(recipe.inputCosts).some(([resourceKey, amount]) => Number(balances[resourceKey] || 0) < amount);
    const storageFull = maxByStorage <= 0;
    const status = storageFull ? "full" : "ready";
    const disabledReason = !isOwner
      ? ownershipDisabledReason
      : storageFull ? "Sklad je pro tento produkt plný."
      : cleanCash < recipe.cleanCashCostPerUnit ? "Na spuštění výroby nemáš dost clean cash."
      : missingInputs ? "Na spuštění výroby nemáš dost materiálových vstupů."
      : null;
    return {
      executionMode: "instant",
      recipeId,
      resourceKey: recipe.outputResourceKey,
      label: recipe.label,
      producedAmount: 0,
      producedCapacity: playerStoredCapacity,
      queuedAmount: 0,
      queueCapacity: recipe.queueCap,
      activeAmount: 0,
      waitingAmount: 0,
      unitCleanCashCost: recipe.cleanCashCostPerUnit,
      materialInputCosts: { ...recipe.inputCosts },
      costDisplayRows: [
        {
          resourceKey: "cash",
          label: "Clean Cash",
          amount: recipe.cleanCashCostPerUnit,
          availableAmount: cleanCash
        },
        ...Object.entries(recipe.inputCosts).map(([resourceKey, amount]) => ({
          resourceKey,
          label: RESOURCE_LABELS[resourceKey] ?? resourceKey,
          amount,
          availableAmount: Math.max(0, Number(balances[resourceKey] ?? 0))
        }))
      ],
      baseUnitDurationTicks: 0,
      effectiveUnitDurationTicks: 0,
      effectiveSpeedMultiplier: 1,
      unitsPerHour: 0,
      remainingTicks: 0,
      remainingMs: 0,
      status,
      canStart: maxStartQuantity > 0,
      canCancelWaiting: false,
      canCollect: false,
      collectDisabledReason: ownershipDisabledReason || "Výsledek výroby se ukládá do skladu okamžitě.",
      maxStartQuantity,
      disabledReason
    } satisfies FactoryProductionLineView;
  });
  return {
    buildingId: input.building.id,
    districtId: input.building.districtId,
    buildingTypeId: FACTORY_BUILDING_TYPE_ID,
    level: input.building.level,
    effectiveProductionSpeedMultiplier: 1,
    collectableAmount: 0,
    canCollect: false,
    collectDisabledReason: ownershipDisabledReason || "Výsledek výroby se ukládá do skladu okamžitě.",
    network: {
      activeFactoryCount,
      networkSpeedMultiplier,
      levelSpeedMultiplier,
      effectiveSpeedMultiplier: networkSpeedMultiplier * levelSpeedMultiplier
    },
    producedSummary: productionLines.map((line) => {
      const currentAmount = Math.max(0, Number(balances[line.resourceKey] || 0));
      const capacity = storage ? getWarehouseCapacityForResource(storage, line.resourceKey) : 0;
      return {
        resourceKey: line.resourceKey as FactoryRecipeId,
        label: line.label,
        currentAmount,
        capacity,
        isFull: currentAmount === capacity,
        isOverCapacity: currentAmount > capacity
      };
    }),
    productionLines
  };
};
