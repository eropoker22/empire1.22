import type { Building, BuildingProductionLine, ResourceState } from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import type { GameCoreContext } from "../engine/context";
import { resolveProductionBuildingLevelMultiplier } from "../rules/buildings/buildingUpgradeRules";
import { resolveCraftProcessingDurationTicks } from "../rules/production/productionRules";
import { composeEntityId } from "../utils";

export interface MultiLineProductionRecipe {
  durationTicksPerUnit: number;
}

export const getProductionLine = (
  building: Building,
  recipeId: string
): BuildingProductionLine => building.productionLines?.[recipeId] ?? {
  recipeId,
  queuedAmount: 0,
  activeStartedAtTick: null,
  activeCompletesAtTick: null,
  reservedCleanCash: 0,
  reservedResourceCosts: {},
  unitCleanCashCost: 0,
  unitResourceCosts: {},
  legacyOutputAmount: undefined,
  version: 0
};

export const getBuildingProductionResourceState = (
  state: CoreGameState,
  building: Building
): ResourceState => {
  const id = composeEntityId("resource", building.id);
  return state.resourceStatesById[id] ?? {
    id,
    ownerType: "building",
    ownerId: building.id,
    balances: {},
    incomeModifiers: {},
    lastUpdatedTick: state.root.tick,
    version: 0
  };
};

export const getProducedAmount = (
  state: CoreGameState,
  building: Building,
  resourceKey: string
): number => Math.max(0, Number(getBuildingProductionResourceState(state, building).balances[resourceKey] || 0));

export const resolveProductionLineDurationTicks = (
  building: Building,
  recipe: MultiLineProductionRecipe,
  context: GameCoreContext
): number => Math.max(1, Math.ceil(
  resolveCraftProcessingDurationTicks(
    recipe.durationTicksPerUnit,
    context.config.balance.cooldownMultiplier
  ) / resolveProductionBuildingLevelMultiplier(building, context)
));

export const startProductionLine = <T extends BuildingProductionLine>(
  line: T,
  building: Building,
  recipe: MultiLineProductionRecipe,
  tick: number,
  context: GameCoreContext
): T => {
  if (line.queuedAmount <= 0 || line.activeCompletesAtTick !== null) return line;
  const durationTicks = resolveProductionLineDurationTicks(building, recipe, context);
  return {
    ...line,
    activeStartedAtTick: tick,
    activeCompletesAtTick: tick + durationTicks,
    version: line.version + 1
  };
};

export const normalizeProductionLine = (
  line: BuildingProductionLine,
  recipeId: string
): BuildingProductionLine => ({
  recipeId,
  queuedAmount: Math.max(0, Math.floor(Number(line.queuedAmount || 0))),
  activeStartedAtTick: Number.isFinite(line.activeStartedAtTick) ? Number(line.activeStartedAtTick) : null,
  activeCompletesAtTick: Number.isFinite(line.activeCompletesAtTick) ? Number(line.activeCompletesAtTick) : null,
  reservedCleanCash: Math.max(0, Math.floor(Number(line.reservedCleanCash || 0))),
  reservedResourceCosts: normalizeResourceCosts(line.reservedResourceCosts),
  unitCleanCashCost: Math.max(0, Math.floor(Number(line.unitCleanCashCost || 0))),
  unitResourceCosts: normalizeResourceCosts(line.unitResourceCosts),
  legacyOutputAmount: Number.isInteger(line.legacyOutputAmount) && Number(line.legacyOutputAmount) > 1
    ? Number(line.legacyOutputAmount)
    : undefined,
  version: Math.max(0, Math.floor(Number(line.version || 0)))
});

export const normalizeResourceCosts = (
  costs: Record<string, number> | undefined
): Record<string, number> => Object.fromEntries(
  Object.entries(costs ?? {})
    .map(([resourceKey, amount]): [string, number] => [resourceKey, Math.max(0, Math.floor(Number(amount || 0)))])
    .filter(([, amount]) => amount > 0)
);
