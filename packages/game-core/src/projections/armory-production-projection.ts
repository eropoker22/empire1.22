import type { ArmoryProductionBuildingView, ArmoryProductionLineView } from "@empire/shared-types";
import type { ArmoryRecipeId, ResolvedGameModeConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import { resolveProductionBuildingLevelMultiplier } from "../rules/buildings/buildingUpgradeRules";
import {
  ARMORY_BUILDING_TYPE_ID,
  getArmoryLine,
  getArmoryProducedAmount,
  resolveActiveArmoryCount,
  resolveArmoryDurationTicks,
  resolveArmoryNetworkSpeedMultiplier
} from "../handlers/armoryProductionShared";
import { getWarehouseCapacityForResource, resolveWarehouseStorageCapacity } from "../handlers/warehouseBuilding";

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
    const line = getArmoryLine(input.building, recipeId);
    const producedAmount = getArmoryProducedAmount(input.state, input.building, recipe.outputResourceKey);
    const activeAmount = line.activeCompletesAtTick === null ? 0 : 1;
    const waitingAmount = Math.max(0, line.queuedAmount - activeAmount);
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
    const queueSpace = Math.max(0, recipe.queueCap - line.queuedAmount);
    const maxByInputs = inputAvailability.reduce(
      (limit, item) => Math.min(limit, Math.floor(item.availableAmount / item.requiredAmount)),
      Number.POSITIVE_INFINITY
    );
    const localFull = producedAmount >= recipe.localOutputCap;
    const maxStartQuantity = isOwner && !localFull ? Math.max(0, Math.min(queueSpace, maxByInputs)) : 0;
    const missingInputs = inputAvailability.some((item) => item.availableAmount < item.requiredAmount);
    const remainingTicks = activeAmount ? Math.max(0, line.activeCompletesAtTick! - input.state.root.tick) : 0;
    const status = producedAmount > recipe.localOutputCap
      ? "over_capacity"
      : producedAmount === recipe.localOutputCap
        ? "full"
        : activeAmount
          ? "processing"
          : line.queuedAmount > 0
            ? "waiting"
            : producedAmount > 0
              ? "completed"
              : "ready";
    const disabledReason = !isOwner
      ? input.building.status !== "active" ? "Zbrojovka musí být aktivní." : "Zbrojovka patří jinému hráči."
      : localFull ? "Lokální zásoba Zbrojovky je plná."
      : queueSpace <= 0 ? "Fronta této výrobní linky je plná."
      : missingInputs ? "Na spuštění výroby nemáš dost materiálových vstupů."
      : null;
    return {
      recipeId,
      category: recipe.category,
      resourceKey: recipe.outputResourceKey,
      label: recipe.label,
      producedAmount,
      producedCapacity: recipe.localOutputCap,
      playerStoredAmount: Math.max(0, Number(balances[recipe.outputResourceKey] || 0)),
      playerStoredCapacity: storage ? getWarehouseCapacityForResource(storage, recipe.outputResourceKey) : 0,
      queuedAmount: line.queuedAmount,
      queueCapacity: recipe.queueCap,
      activeAmount: activeAmount as 0 | 1,
      waitingAmount,
      materialInputCosts: { ...recipe.inputCosts },
      inputAvailability,
      baseUnitDurationTicks: recipe.durationTicksPerUnit,
      effectiveUnitDurationTicks: resolveArmoryDurationTicks(input.state, input.building, recipe, { config: input.config! }),
      remainingTicks,
      remainingMs: remainingTicks * Math.max(1, Number(input.tickRateMs || input.config?.tickRateMs || 5000)),
      status,
      canStart: maxStartQuantity > 0,
      canCancelWaiting: waitingAmount > 0,
      canCollect: isOwner && producedAmount > 0,
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
