import type { FactoryProductionBuildingView, FactoryProductionLineView } from "@empire/shared-types";
import type { FactoryRecipeId, ResolvedGameModeConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import { resolveProductionBuildingLevelMultiplier } from "../rules/buildings/buildingUpgradeRules";
import {
  FACTORY_BUILDING_TYPE_ID,
  getFactoryLine,
  getFactoryProducedAmount,
  isFactoryOwnedBy,
  resolveActiveFactoryCount,
  resolveFactoryDurationTicks,
  resolveFactoryNetworkSpeedMultiplier
} from "../handlers/factoryProductionShared";

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
  const factory = input.config?.balance.factory;
  if (input.building.buildingTypeId !== FACTORY_BUILDING_TYPE_ID || !factory) return null;
  const player = input.state.playersById[input.playerId];
  const balances = player ? input.state.resourceStatesById[player.resourceStateId]?.balances ?? {} : {};
  const isOwner = isFactoryOwnedBy(input.state, input.building, input.playerId) && input.building.status === "active";
  const activeFactoryCount = resolveActiveFactoryCount(input.state, input.playerId);
  const networkSpeedMultiplier = resolveFactoryNetworkSpeedMultiplier(activeFactoryCount, factory);
  const levelSpeedMultiplier = resolveProductionBuildingLevelMultiplier(input.building, { config: input.config! });
  const productionLines = (Object.entries(factory.recipes) as Array<[FactoryRecipeId, typeof factory.recipes[FactoryRecipeId]]>).map(([recipeId, recipe]) => {
    const line = getFactoryLine(input.building, recipeId);
    const producedAmount = getFactoryProducedAmount(input.state, input.building, recipe.outputResourceKey);
    const activeAmount = line.activeCompletesAtTick === null ? 0 : 1;
    const waitingAmount = Math.max(0, line.queuedAmount - activeAmount);
    const queueSpace = Math.max(0, recipe.queueCap - line.queuedAmount);
    const cleanCash = Math.max(0, Number(balances.cash || 0));
    const maxByInputs = Object.entries(recipe.inputCosts).reduce(
      (max, [resourceKey, amount]) => Math.min(max, Math.floor(Math.max(0, Number(balances[resourceKey] || 0)) / amount)),
      Number.POSITIVE_INFINITY
    );
    const localFull = producedAmount >= recipe.localOutputCap;
    const maxStartQuantity = isOwner && !localFull
      ? Math.max(0, Math.min(queueSpace, Math.floor(cleanCash / recipe.cleanCashCostPerUnit), maxByInputs))
      : 0;
    const missingInputs = Object.entries(recipe.inputCosts).some(([resourceKey, amount]) => Number(balances[resourceKey] || 0) < amount);
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
      ? input.building.status !== "active" ? "Továrna musí být aktivní." : "Továrna patří jinému hráči."
      : localFull ? "Lokální zásoba Továrny je plná."
      : queueSpace <= 0 ? "Fronta této výrobní linky je plná."
      : cleanCash < recipe.cleanCashCostPerUnit ? "Na spuštění výroby nemáš dost clean cash."
      : missingInputs ? "Na spuštění výroby nemáš dost materiálových vstupů."
      : null;
    const remainingTicks = activeAmount ? Math.max(0, line.activeCompletesAtTick! - input.state.root.tick) : 0;
    return {
      recipeId,
      resourceKey: recipe.outputResourceKey,
      label: recipe.label,
      queuedAmount: line.queuedAmount,
      queueCapacity: recipe.queueCap,
      activeAmount: activeAmount as 0 | 1,
      waitingAmount,
      unitCleanCashCost: recipe.cleanCashCostPerUnit,
      materialInputCosts: { ...recipe.inputCosts },
      costDisplayRows: [
        { resourceKey: "cash", label: "Clean Cash", amount: recipe.cleanCashCostPerUnit },
        ...Object.entries(recipe.inputCosts).map(([resourceKey, amount]) => ({ resourceKey, label: RESOURCE_LABELS[resourceKey] ?? resourceKey, amount }))
      ],
      baseUnitDurationTicks: recipe.durationTicksPerUnit,
      effectiveUnitDurationTicks: resolveFactoryDurationTicks(input.state, input.building, recipe, { config: input.config! }),
      remainingTicks,
      remainingMs: remainingTicks * Math.max(1, Number(input.tickRateMs || input.config?.tickRateMs || 5000)),
      status,
      canStart: maxStartQuantity > 0,
      canCancelWaiting: waitingAmount > 0,
      canCollect: isOwner && producedAmount > 0,
      maxStartQuantity,
      disabledReason
    } satisfies FactoryProductionLineView;
  });
  return {
    buildingId: input.building.id,
    districtId: input.building.districtId,
    buildingTypeId: FACTORY_BUILDING_TYPE_ID,
    level: input.building.level,
    network: {
      activeFactoryCount,
      networkSpeedMultiplier,
      levelSpeedMultiplier,
      effectiveSpeedMultiplier: networkSpeedMultiplier * levelSpeedMultiplier
    },
    producedSummary: productionLines.map((line) => {
      const currentAmount = getFactoryProducedAmount(input.state, input.building, line.resourceKey);
      return {
        resourceKey: line.resourceKey as FactoryRecipeId,
        label: line.label,
        currentAmount,
        capacity: factory.recipes[line.recipeId].localOutputCap,
        isFull: currentAmount === factory.recipes[line.recipeId].localOutputCap,
        isOverCapacity: currentAmount > factory.recipes[line.recipeId].localOutputCap
      };
    }),
    productionLines
  };
};
