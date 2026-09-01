import type {
  DrugLabProductionBuildingView,
  DrugLabProductionLineView,
  FactoryProductionBuildingView,
  FactoryProductionLineView,
  PharmacyProductionBuildingView,
  PharmacyProductionLineView
} from "@empire/shared-types";
import type {
  DrugLabRecipeId,
  FactoryRecipeId,
  PharmacyRecipeId,
  ResolvedGameModeConfig
} from "../contracts";
import type { GameCoreContext } from "../engine/context";
import type { CoreGameState } from "../entities";
import {
  getDrugLabLine,
  getDrugLabProducedAmount,
  resolveDrugLabDurationTicks
} from "../handlers/drugLabProductionShared";
import {
  getFactoryLine,
  getFactoryProducedAmount,
  isFactoryOwnedBy,
  resolveActiveFactoryCount,
  resolveFactoryDurationTicks,
  resolveFactoryNetworkSpeedMultiplier
} from "../handlers/factoryProductionShared";
import {
  getPharmacyLine,
  getPharmacyProducedAmount,
  resolvePharmacyDurationTicks
} from "../handlers/pharmacyProductionShared";
import { resolveProductionBuildingLevelMultiplier } from "../rules/buildings/buildingUpgradeRules";
import { getWarehouseCapacityForResource, resolveWarehouseStorageCapacity } from "../handlers/warehouseBuilding";

type ProjectionInput = {
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  playerId: string;
  config?: ResolvedGameModeConfig;
  tickRateMs?: number;
};

const RESOURCE_LABELS: Record<string, string> = {
  cash: "Clean Cash",
  chemicals: "Chemicals",
  biomass: "Biomass",
  "metal-parts": "Metal Parts",
  "tech-core": "Tech Core",
  "combat-module": "Bojový modul"
};

const contextOf = (config: ResolvedGameModeConfig): GameCoreContext => ({ config } as GameCoreContext);
const tickRateOf = (input: ProjectionInput): number => Math.max(1, Number(input.tickRateMs ?? input.config?.tickRateMs ?? 1000));
const timingOf = (line: { queuedAmount: number; activeCompletesAtTick: number | null }, tick: number) => {
  const activeAmount: 0 | 1 = line.activeCompletesAtTick === null ? 0 : 1;
  return {
    activeAmount,
    waitingAmount: Math.max(0, line.queuedAmount - activeAmount),
    remainingTicks: line.activeCompletesAtTick === null ? 0 : Math.max(0, line.activeCompletesAtTick - tick)
  };
};
const statusOf = (produced: number, cap: number, active: number, waiting: number) =>
  produced > cap ? "over_capacity" as const
    : produced === cap ? "full" as const
      : active ? "processing" as const
        : waiting ? "waiting" as const
          : produced > 0 ? "completed" as const : "ready" as const;

export const createTimedPharmacyProductionBuildingView = (input: ProjectionInput): PharmacyProductionBuildingView | null => {
  const config = input.config;
  const pharmacy = config?.balance.pharmacy;
  if (!config || !pharmacy || input.building.buildingTypeId !== "pharmacy") return null;
  const player = input.state.playersById[input.playerId];
  const balances = player ? input.state.resourceStatesById[player.resourceStateId]?.balances ?? {} : {};
  const storage = player && config.balance.warehouse ? resolveWarehouseStorageCapacity(input.state, player.id, config.balance.warehouse) : null;
  const isOwner = input.building.ownerPlayerId === input.playerId && input.building.status === "active";
  const lines = (Object.entries(pharmacy.recipes) as Array<[PharmacyRecipeId, typeof pharmacy.recipes[PharmacyRecipeId]]>).map(([recipeId, recipe]) => {
    const line = getPharmacyLine(input.building, recipeId);
    const producedAmount = getPharmacyProducedAmount(input.state, input.building, recipe.outputResourceKey);
    const playerStoredAmount = Math.max(0, Number(balances[recipe.outputResourceKey] || 0));
    const playerStoredCapacity = storage ? getWarehouseCapacityForResource(storage, recipe.outputResourceKey) : 0;
    const timing = timingOf(line, input.state.root.tick);
    const queueSpace = Math.max(0, recipe.queueCap - line.queuedAmount);
    const cleanCash = Math.max(0, Number(balances.cash || 0));
    const maxByCash = recipe.cleanCashCostPerUnit > 0 ? Math.floor(cleanCash / recipe.cleanCashCostPerUnit) : Number.MAX_SAFE_INTEGER;
    const maxStartQuantity = isOwner ? Math.max(0, Math.min(queueSpace, maxByCash)) : 0;
    const effectiveUnitDurationTicks = resolvePharmacyDurationTicks(input.state, input.building, recipe, contextOf(config));
    const canCollect = isOwner && producedAmount > 0 && (!storage || playerStoredAmount < playerStoredCapacity);
    return {
      executionMode: "legacy-timed", recipeId, resourceKey: recipe.outputResourceKey, label: recipe.label,
      producedAmount, producedCapacity: recipe.localOutputCap, playerStoredAmount, playerStoredCapacity,
      queuedAmount: line.queuedAmount, queueCapacity: recipe.queueCap, ...timing,
      unitCleanCashCost: recipe.cleanCashCostPerUnit, baseUnitDurationTicks: recipe.durationTicksPerUnit,
      effectiveUnitDurationTicks, remainingMs: timing.remainingTicks * tickRateOf(input),
      status: producedAmount >= recipe.localOutputCap
        ? "full"
        : timing.activeAmount ? "processing" : timing.waitingAmount ? "waiting" : producedAmount > 0 ? "completed" : "ready",
      canStart: maxStartQuantity > 0, canCancelWaiting: timing.waitingAmount > 0, canCollect, maxStartQuantity,
      disabledReason: !isOwner
        ? input.building.status !== "active" ? "Lékárna musí být aktivní." : "Lékárna patří jinému hráči."
        : queueSpace <= 0 ? "Výrobní fronta je plná."
          : cleanCash < recipe.cleanCashCostPerUnit ? "Na spuštění výroby nemáš dost clean cash." : null
    } satisfies PharmacyProductionLineView;
  });
  return { buildingId: input.building.id, lines };
};

export const createTimedDrugLabProductionBuildingView = (input: ProjectionInput): DrugLabProductionBuildingView | null => {
  const config = input.config;
  const drugLab = config?.balance.drugLab;
  if (!config || !drugLab || input.building.buildingTypeId !== "drug_lab") return null;
  const player = input.state.playersById[input.playerId];
  const balances = player ? input.state.resourceStatesById[player.resourceStateId]?.balances ?? {} : {};
  const storage = player && config.balance.warehouse ? resolveWarehouseStorageCapacity(input.state, player.id, config.balance.warehouse) : null;
  const isOwner = input.building.ownerPlayerId === input.playerId && input.building.status === "active";
  const lines = (Object.entries(drugLab.recipes) as Array<[DrugLabRecipeId, typeof drugLab.recipes[DrugLabRecipeId]]>).map(([recipeId, recipe]) => {
    const line = getDrugLabLine(input.building, recipeId);
    const producedAmount = getDrugLabProducedAmount(input.state, input.building, recipe.outputResourceKey);
    const timing = timingOf(line, input.state.root.tick);
    const inputAvailability = Object.entries(recipe.inputCosts).map(([resourceKey, requiredAmount]) => ({
      resourceKey, label: RESOURCE_LABELS[resourceKey] ?? resourceKey, requiredAmount,
      availableAmount: Math.max(0, Number(balances[resourceKey] || 0))
    }));
    const maxByInputs = inputAvailability.reduce((limit, item) => Math.min(limit, Math.floor(item.availableAmount / item.requiredAmount)), Number.POSITIVE_INFINITY);
    const cleanCash = Math.max(0, Number(balances.cash || 0));
    const maxByCash = recipe.cleanCashCostPerUnit > 0 ? Math.floor(cleanCash / recipe.cleanCashCostPerUnit) : Number.MAX_SAFE_INTEGER;
    const queueSpace = Math.max(0, recipe.queueCap - line.queuedAmount);
    const maxStartQuantity = isOwner ? Math.max(0, Math.min(queueSpace, maxByCash, maxByInputs)) : 0;
    const effectiveUnitDurationTicks = resolveDrugLabDurationTicks(input.state, input.building, recipe, contextOf(config));
    const playerStoredAmount = Math.max(0, Number(balances[recipe.outputResourceKey] || 0));
    const playerStoredCapacity = storage ? getWarehouseCapacityForResource(storage, recipe.outputResourceKey) : 0;
    const canCollect = isOwner && producedAmount > 0 && (!storage || playerStoredAmount < playerStoredCapacity);
    return {
      executionMode: "legacy-timed", recipeId, resourceKey: recipe.outputResourceKey, label: recipe.label,
      description: recipe.description, itemRole: recipe.itemRole, producedAmount, producedCapacity: recipe.localOutputCap,
      playerStoredAmount, playerStoredCapacity, queuedAmount: line.queuedAmount, queueCapacity: recipe.queueCap,
      ...timing, unitCleanCashCost: recipe.cleanCashCostPerUnit, materialInputCosts: { ...recipe.inputCosts }, inputAvailability,
      baseUnitDurationTicks: recipe.durationTicksPerUnit, effectiveUnitDurationTicks,
      remainingMs: timing.remainingTicks * tickRateOf(input),
      status: producedAmount >= recipe.localOutputCap
        ? "full"
        : timing.activeAmount ? "processing" : timing.waitingAmount ? "waiting" : producedAmount > 0 ? "completed" : "ready",
      canStart: maxStartQuantity > 0, canCancelWaiting: timing.waitingAmount > 0, canCollect, maxStartQuantity,
      disabledReason: !isOwner
        ? input.building.status !== "active" ? "Lab musí být aktivní." : "Lab patří jinému hráči."
        : queueSpace <= 0 ? "Výrobní fronta je plná."
          : cleanCash < recipe.cleanCashCostPerUnit ? "Na spuštění výroby nemáš dost clean cash."
            : inputAvailability.some((item) => item.availableAmount < item.requiredAmount) ? "Na spuštění výroby nemáš dost materiálových vstupů." : null
    } satisfies DrugLabProductionLineView;
  });
  return { buildingId: input.building.id, lines };
};

export const createTimedFactoryProductionBuildingView = (input: ProjectionInput): FactoryProductionBuildingView | null => {
  const config = input.config;
  const factory = config?.balance.factory;
  if (!config || !factory || input.building.buildingTypeId !== "factory") return null;
  const player = input.state.playersById[input.playerId];
  const balances = player ? input.state.resourceStatesById[player.resourceStateId]?.balances ?? {} : {};
  const storage = player && config.balance.warehouse ? resolveWarehouseStorageCapacity(input.state, player.id, config.balance.warehouse) : null;
  const isOwner = isFactoryOwnedBy(input.state, input.building, input.playerId) && input.building.status === "active";
  const activeFactoryCount = resolveActiveFactoryCount(input.state, input.playerId);
  const networkSpeedMultiplier = resolveFactoryNetworkSpeedMultiplier(activeFactoryCount, factory);
  const levelSpeedMultiplier = resolveProductionBuildingLevelMultiplier(input.building, contextOf(config));
  const ownerReason = isOwner ? null : input.building.status !== "active" ? "Továrna musí být aktivní." : "Továrna patří jinému hráči.";
  const productionLines = (Object.entries(factory.recipes) as Array<[FactoryRecipeId, typeof factory.recipes[FactoryRecipeId]]>).map(([recipeId, recipe]) => {
    const line = getFactoryLine(input.building, recipeId);
    const producedAmount = getFactoryProducedAmount(input.state, input.building, recipe.outputResourceKey);
    const timing = timingOf(line, input.state.root.tick);
    const cleanCash = Math.max(0, Number(balances.cash || 0));
    const maxByCash = recipe.cleanCashCostPerUnit > 0 ? Math.floor(cleanCash / recipe.cleanCashCostPerUnit) : Number.MAX_SAFE_INTEGER;
    const maxByInputs = Object.entries(recipe.inputCosts).reduce((limit, [key, amount]) => Math.min(limit, Math.floor(Math.max(0, Number(balances[key] || 0)) / amount)), Number.POSITIVE_INFINITY);
    const queueSpace = Math.max(0, recipe.queueCap - line.queuedAmount);
    const maxStartQuantity = isOwner ? Math.max(0, Math.min(queueSpace, maxByCash, maxByInputs)) : 0;
    const effectiveUnitDurationTicks = resolveFactoryDurationTicks(input.state, input.building, recipe, contextOf(config));
    const playerStoredAmount = Math.max(0, Number(balances[recipe.outputResourceKey] || 0));
    const playerStoredCapacity = storage ? getWarehouseCapacityForResource(storage, recipe.outputResourceKey) : 0;
    const canCollect = isOwner && producedAmount > 0 && (!storage || playerStoredAmount < playerStoredCapacity);
    const missingInputs = Object.entries(recipe.inputCosts).some(([key, amount]) => Number(balances[key] || 0) < amount);
    const speed = recipe.durationTicksPerUnit / Math.max(1, effectiveUnitDurationTicks);
    return {
      executionMode: "legacy-timed", recipeId, resourceKey: recipe.outputResourceKey, label: recipe.label,
      producedAmount, producedCapacity: recipe.localOutputCap, queuedAmount: line.queuedAmount, queueCapacity: recipe.queueCap,
      ...timing, unitCleanCashCost: recipe.cleanCashCostPerUnit, materialInputCosts: { ...recipe.inputCosts },
      costDisplayRows: [{ resourceKey: "cash", label: "Clean Cash", amount: recipe.cleanCashCostPerUnit, availableAmount: cleanCash },
        ...Object.entries(recipe.inputCosts).map(([key, amount]) => ({ resourceKey: key, label: RESOURCE_LABELS[key] ?? key, amount, availableAmount: Math.max(0, Number(balances[key] || 0)) }))],
      baseUnitDurationTicks: recipe.durationTicksPerUnit, effectiveUnitDurationTicks, effectiveSpeedMultiplier: speed,
      unitsPerHour: 3_600_000 / Math.max(1, effectiveUnitDurationTicks * tickRateOf(input)),
      remainingMs: timing.remainingTicks * tickRateOf(input),
      status: statusOf(producedAmount, recipe.localOutputCap, timing.activeAmount, timing.waitingAmount),
      canStart: maxStartQuantity > 0, canCancelWaiting: timing.waitingAmount > 0, canCollect,
      collectDisabledReason: canCollect ? null : producedAmount <= 0 ? "Výroba ještě není hotová." : "Sklad je pro tuto položku plný.",
      maxStartQuantity,
      disabledReason: ownerReason || (queueSpace <= 0 ? "Výrobní fronta je plná." : cleanCash < recipe.cleanCashCostPerUnit ? "Na spuštění výroby nemáš dost clean cash." : missingInputs ? "Na spuštění výroby nemáš dost materiálových vstupů." : null)
    } satisfies FactoryProductionLineView;
  });
  const collectableAmount = productionLines.reduce((sum, line) => sum + line.producedAmount, 0);
  const canCollect = productionLines.some((line) => line.canCollect);
  const effectiveProductionSpeedMultiplier = networkSpeedMultiplier * levelSpeedMultiplier;
  return {
    buildingId: input.building.id, districtId: input.building.districtId, buildingTypeId: "factory",
    level: input.building.level, effectiveProductionSpeedMultiplier, collectableAmount, canCollect,
    collectDisabledReason: canCollect ? null : ownerReason || (collectableAmount <= 0 ? "Výroba ještě není hotová." : "Sklad je plný."),
    network: { activeFactoryCount, networkSpeedMultiplier, levelSpeedMultiplier, effectiveSpeedMultiplier: effectiveProductionSpeedMultiplier },
    producedSummary: productionLines.map((line) => ({ resourceKey: line.recipeId, label: line.label, currentAmount: line.producedAmount, capacity: line.producedCapacity, isFull: line.producedAmount === line.producedCapacity, isOverCapacity: line.producedAmount > line.producedCapacity })),
    productionLines
  };
};

export { createTimedArmoryProductionBuildingView } from "./timed-armory-production-projection";
