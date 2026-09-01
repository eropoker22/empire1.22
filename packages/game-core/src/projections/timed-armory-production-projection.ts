import type { ArmoryProductionBuildingView, ArmoryProductionLineView } from "@empire/shared-types";
import type { ArmoryRecipeId, ResolvedGameModeConfig } from "../contracts";
import type { GameCoreContext } from "../engine/context";
import type { CoreGameState } from "../entities";
import {
  getArmoryLine,
  getArmoryProducedAmount,
  resolveActiveArmoryCount,
  resolveArmoryDurationTicks,
  resolveArmoryNetworkSpeedMultiplier
} from "../handlers/armoryProductionShared";
import { getWarehouseCapacityForResource, resolveWarehouseStorageCapacity } from "../handlers/warehouseBuilding";
import { resolveProductionBuildingLevelMultiplier } from "../rules/buildings/buildingUpgradeRules";

type ProjectionInput = {
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  playerId: string;
  config?: ResolvedGameModeConfig;
  tickRateMs?: number;
};

const RESOURCE_LABELS: Record<string, string> = {
  cash: "Clean Cash", chemicals: "Chemicals", biomass: "Biomass", "metal-parts": "Metal Parts",
  "tech-core": "Tech Core", "combat-module": "Bojový modul"
};
const contextOf = (config: ResolvedGameModeConfig): GameCoreContext => ({ config } as GameCoreContext);
const tickRateOf = (input: ProjectionInput): number => Math.max(1, Number(input.tickRateMs ?? input.config?.tickRateMs ?? 1000));
const timingOf = (line: { queuedAmount: number; activeCompletesAtTick: number | null }, tick: number) => {
  const activeAmount: 0 | 1 = line.activeCompletesAtTick === null ? 0 : 1;
  return { activeAmount, waitingAmount: Math.max(0, line.queuedAmount - activeAmount), remainingTicks: line.activeCompletesAtTick === null ? 0 : Math.max(0, line.activeCompletesAtTick - tick) };
};
const statusOf = (produced: number, cap: number, active: number, waiting: number) =>
  produced > cap ? "over_capacity" as const : produced === cap ? "full" as const
    : active ? "processing" as const : waiting ? "waiting" as const : produced > 0 ? "completed" as const : "ready" as const;

export const createTimedArmoryProductionBuildingView = (input: ProjectionInput): ArmoryProductionBuildingView | null => {
  const config = input.config;
  const armory = config?.balance.armory;
  if (!config || !armory || input.building.buildingTypeId !== "armory") return null;
  const player = input.state.playersById[input.playerId];
  const balances = player ? input.state.resourceStatesById[player.resourceStateId]?.balances ?? {} : {};
  const storage = player && config.balance.warehouse ? resolveWarehouseStorageCapacity(input.state, player.id, config.balance.warehouse) : null;
  const isOwner = input.building.ownerPlayerId === input.playerId && input.building.status === "active";
  const activeArmoryCount = resolveActiveArmoryCount(input.state, input.playerId);
  const networkSpeedMultiplier = resolveArmoryNetworkSpeedMultiplier(activeArmoryCount, armory);
  const levelSpeedMultiplier = resolveProductionBuildingLevelMultiplier(input.building, contextOf(config));
  const productionLines = (Object.entries(armory.recipes) as Array<[ArmoryRecipeId, typeof armory.recipes[ArmoryRecipeId]]>).map(([recipeId, recipe]) => {
    const line = getArmoryLine(input.building, recipeId);
    const producedAmount = getArmoryProducedAmount(input.state, input.building, recipe.outputResourceKey);
    const timing = timingOf(line, input.state.root.tick);
    const inputAvailability = Object.entries(recipe.inputCosts).map(([resourceKey, requiredAmount]) => ({
      resourceKey, label: RESOURCE_LABELS[resourceKey] ?? resourceKey, requiredAmount,
      availableAmount: Math.max(0, Number(balances[resourceKey] || 0)), requiredPerUnit: requiredAmount,
      playerStoredAmount: Math.max(0, Number(balances[resourceKey] || 0)),
      hasEnough: Math.max(0, Number(balances[resourceKey] || 0)) >= requiredAmount, requiredForSelectedQuantity: requiredAmount
    }));
    const maxByInputs = inputAvailability.reduce((limit, item) => Math.min(limit, Math.floor(item.availableAmount / item.requiredAmount)), Number.POSITIVE_INFINITY);
    const queueSpace = Math.max(0, recipe.queueCap - line.queuedAmount);
    const maxStartQuantity = isOwner ? Math.max(0, Math.min(queueSpace, maxByInputs)) : 0;
    const effectiveUnitDurationTicks = resolveArmoryDurationTicks(input.state, input.building, recipe, contextOf(config));
    const playerStoredAmount = Math.max(0, Number(balances[recipe.outputResourceKey] || 0));
    const playerStoredCapacity = storage ? getWarehouseCapacityForResource(storage, recipe.outputResourceKey) : 0;
    const canCollect = isOwner && producedAmount > 0 && (!storage || playerStoredAmount < playerStoredCapacity);
    return {
      executionMode: "legacy-timed", recipeId, category: recipe.category, resourceKey: recipe.outputResourceKey, label: recipe.label,
      producedAmount, producedCapacity: recipe.localOutputCap, playerStoredAmount, playerStoredCapacity,
      queuedAmount: line.queuedAmount, queueCapacity: recipe.queueCap, ...timing,
      materialInputCosts: { ...recipe.inputCosts }, inputAvailability,
      baseUnitDurationTicks: recipe.durationTicksPerUnit, effectiveUnitDurationTicks,
      remainingMs: timing.remainingTicks * tickRateOf(input),
      status: statusOf(producedAmount, recipe.localOutputCap, timing.activeAmount, timing.waitingAmount),
      canStart: maxStartQuantity > 0, canCancelWaiting: timing.waitingAmount > 0, canCollect, maxStartQuantity,
      disabledReason: !isOwner
        ? input.building.status !== "active" ? "Zbrojovka musí být aktivní." : "Zbrojovka patří jinému hráči."
        : queueSpace <= 0 ? "Výrobní fronta je plná."
          : inputAvailability.some((item) => !item.hasEnough) ? "Na spuštění výroby nemáš dost materiálových vstupů." : null
    } satisfies ArmoryProductionLineView;
  });
  return {
    buildingId: input.building.id, level: input.building.level,
    network: { activeArmoryCount, networkSpeedMultiplier, levelSpeedMultiplier, effectiveSpeedMultiplier: networkSpeedMultiplier * levelSpeedMultiplier },
    categories: [
      { id: "attack", label: "Útok", recipeIds: productionLines.filter((line) => line.category === "attack").map((line) => line.recipeId) },
      { id: "defense", label: "Obrana", recipeIds: productionLines.filter((line) => line.category === "defense").map((line) => line.recipeId) }
    ],
    productionLines
  };
};
