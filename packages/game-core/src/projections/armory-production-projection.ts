import type { ArmoryProductionBuildingView, ArmoryProductionLineView } from "@empire/shared-types";
import type { ArmoryRecipeId, ResolvedGameModeConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import { resolveProductionBuildingLevelMultiplier } from "../rules/buildings/buildingUpgradeRules";
import {
  ARMORY_BUILDING_TYPE_ID,
  resolveActiveArmoryCount,
  resolveArmoryNetworkSpeedMultiplier
} from "../handlers/armoryProductionShared";
import { getWarehouseCapacityForResource, resolveWarehouseStorageCapacity } from "../handlers/warehouseBuilding";
import { createTimedArmoryProductionBuildingView } from "./timed-production-projections";

const RESOURCE_LABELS: Record<string, string> = {
  "metal-parts": "Metal Parts",
  "tech-core": "Tech Core",
  "combat-module": "Combat Module"
};

export const createArmoryProductionBuildingView = (input: {
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  playerId: string;
  config?: ResolvedGameModeConfig;
  tickRateMs?: number;
}): ArmoryProductionBuildingView | null => {
  return createTimedArmoryProductionBuildingView(input);
  /* legacy instant projection retained below only for snapshot compatibility reference */
  const armory = input.config?.balance.armory;
  if (input.building.buildingTypeId !== ARMORY_BUILDING_TYPE_ID || !armory) return null;
  const player = input.state.playersById[input.playerId];
  const balances = player ? input.state.resourceStatesById[player.resourceStateId]?.balances ?? {} : {};
  const storage = player && input.config?.balance.warehouse
    ? resolveWarehouseStorageCapacity(input.state, player.id, input.config.balance.warehouse)
    : null;
  const isOwner = input.building.ownerPlayerId === input.playerId && input.building.status === "active";
  const activeArmoryCount = resolveActiveArmoryCount(input.state, input.playerId);
  const networkSpeedMultiplier = resolveArmoryNetworkSpeedMultiplier(activeArmoryCount, armory);
  const levelSpeedMultiplier = resolveProductionBuildingLevelMultiplier(input.building, { config: input.config! });
  const productionLines = (Object.entries(armory.recipes) as Array<[ArmoryRecipeId, typeof armory.recipes[ArmoryRecipeId]]>).map(([recipeId, recipe]) => {
    const inputAvailability = Object.entries(recipe.inputCosts).map(([resourceKey, requiredAmount]) => ({
      resourceKey,
      label: RESOURCE_LABELS[resourceKey] ?? resourceKey,
      requiredAmount,
      availableAmount: Math.max(0, Number(balances[resourceKey] || 0)),
      requiredPerUnit: requiredAmount,
      playerStoredAmount: Math.max(0, Number(balances[resourceKey] || 0)),
      hasEnough: Math.max(0, Number(balances[resourceKey] || 0)) >= requiredAmount,
      requiredForSelectedQuantity: requiredAmount
    }));
    const playerStoredAmount = Math.max(0, Number(balances[recipe.outputResourceKey] || 0));
    const playerStoredCapacity = storage ? getWarehouseCapacityForResource(storage, recipe.outputResourceKey) : 0;
    const maxByStorage = storage
      ? Math.max(0, Math.floor((playerStoredCapacity - playerStoredAmount) / recipe.outputAmount))
      : Number.MAX_SAFE_INTEGER;
    const maxByInputs = inputAvailability.reduce(
      (limit, item) => Math.min(limit, Math.floor(item.availableAmount / item.requiredAmount)),
      Number.POSITIVE_INFINITY
    );
    const maxStartQuantity = isOwner ? Math.max(0, Math.min(recipe.queueCap, maxByInputs, maxByStorage)) : 0;
    const missingInputs = inputAvailability.some((item) => item.availableAmount < item.requiredAmount);
    const storageFull = maxByStorage <= 0;
    const status = storageFull ? "full" : "ready";
    const disabledReason = !isOwner
      ? input.building.status !== "active" ? "Zbrojovka musí být aktivní." : "Zbrojovka patří jinému hráči."
      : storageFull ? "Sklad je pro tento produkt plný."
      : missingInputs ? "Na spuštění výroby nemáš dost materiálových vstupů."
      : null;
    return {
      executionMode: "instant",
      recipeId,
      category: recipe.category,
      resourceKey: recipe.outputResourceKey,
      label: recipe.label,
      producedAmount: 0,
      producedCapacity: playerStoredCapacity,
      playerStoredAmount,
      playerStoredCapacity,
      queuedAmount: 0,
      queueCapacity: recipe.queueCap,
      activeAmount: 0,
      waitingAmount: 0,
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
    } satisfies ArmoryProductionLineView;
  });
  return {
    buildingId: input.building.id,
    level: input.building.level,
    network: {
      activeArmoryCount,
      networkSpeedMultiplier,
      levelSpeedMultiplier,
      effectiveSpeedMultiplier: networkSpeedMultiplier * levelSpeedMultiplier
    },
    categories: [
      { id: "attack", label: "Útok", recipeIds: productionLines.filter((line) => line.category === "attack").map((line) => line.recipeId) },
      { id: "defense", label: "Obrana", recipeIds: productionLines.filter((line) => line.category === "defense").map((line) => line.recipeId) }
    ],
    productionLines
  };
};
