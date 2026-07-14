import type { DrugLabProductionBuildingView, DrugLabProductionLineView } from "@empire/shared-types";
import type { DrugLabRecipeId, ResolvedGameModeConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import {
  DRUG_LAB_BUILDING_TYPE_ID,
  getDrugLabLine,
  getDrugLabProducedAmount,
  resolveDrugLabDurationTicks
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
    const line = getDrugLabLine(input.building, recipeId);
    const producedAmount = getDrugLabProducedAmount(input.state, input.building, recipe.outputResourceKey);
    const activeAmount = line.activeCompletesAtTick === null ? 0 : 1;
    const waitingAmount = Math.max(0, line.queuedAmount - activeAmount);
    const remainingTicks = activeAmount ? Math.max(0, line.activeCompletesAtTick! - input.state.root.tick) : 0;
    const cleanCash = Math.max(0, Number(balances.cash || 0));
    const inputAvailability = Object.entries(recipe.inputCosts).map(([resourceKey, requiredAmount]) => ({
      resourceKey,
      label: LABELS[resourceKey] ?? resourceKey,
      requiredAmount,
      availableAmount: Math.max(0, Number(balances[resourceKey] || 0))
    }));
    const queueSpace = Math.max(0, recipe.queueCap - line.queuedAmount);
    const localFull = producedAmount >= recipe.localOutputCap;
    const maxByInputs = inputAvailability.reduce(
      (limit, item) => Math.min(limit, Math.floor(item.availableAmount / item.requiredAmount)),
      Number.POSITIVE_INFINITY
    );
    const maxStartQuantity = isOwner && !localFull
      ? Math.max(0, Math.min(queueSpace, Math.floor(cleanCash / recipe.cleanCashCostPerUnit), maxByInputs))
      : 0;
    const missingMaterial = inputAvailability.some((item) => item.availableAmount < item.requiredAmount);
    const disabledReason = !isOwner
      ? input.building.status !== "active" ? "Lab musí být aktivní." : "Lab patří jinému hráči."
      : localFull ? "Lokální zásoba Labu je plná."
      : queueSpace <= 0 ? "Fronta této výrobní linky je plná."
      : cleanCash < recipe.cleanCashCostPerUnit ? "Na spuštění výroby nemáš dost clean cash."
      : missingMaterial ? "Na spuštění výroby nemáš dost materiálových vstupů."
      : null;
    const status = localFull
      ? "full"
      : activeAmount
        ? "processing"
        : line.queuedAmount > 0
          ? "waiting"
          : producedAmount > 0
            ? "completed"
            : "ready";
    return {
      recipeId,
      resourceKey: recipe.outputResourceKey,
      label: recipe.label,
      description: recipe.description,
      itemRole: recipe.itemRole,
      producedAmount,
      producedCapacity: recipe.localOutputCap,
      playerStoredAmount: Math.max(0, Number(balances[recipe.outputResourceKey] || 0)),
      playerStoredCapacity: storage ? getWarehouseCapacityForResource(storage, recipe.outputResourceKey) : 0,
      queuedAmount: line.queuedAmount,
      queueCapacity: recipe.queueCap,
      activeAmount: activeAmount as 0 | 1,
      waitingAmount,
      unitCleanCashCost: recipe.cleanCashCostPerUnit,
      materialInputCosts: { ...recipe.inputCosts },
      inputAvailability,
      baseUnitDurationTicks: recipe.durationTicksPerUnit,
      effectiveUnitDurationTicks: resolveDrugLabDurationTicks(input.state, input.building, recipe, { config: input.config! }),
      remainingTicks,
      remainingMs: remainingTicks * Math.max(1, Number(input.tickRateMs || input.config?.tickRateMs || 5000)),
      status,
      canStart: maxStartQuantity > 0,
      canCancelWaiting: waitingAmount > 0,
      canCollect: isOwner && producedAmount > 0,
      maxStartQuantity,
      disabledReason
    } satisfies DrugLabProductionLineView;
  });
  return { buildingId: input.building.id, lines };
};
