import type { Building, BuildingProductionLine, ResourceState } from "@empire/shared-types";
import type { PharmacyBalanceConfig, PharmacyRecipeBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import type { GameCoreContext } from "../engine/context";
import { resolveCraftProcessingDurationTicks } from "../rules/production/productionRules";
import { resolveProductionBuildingLevelMultiplier } from "../rules/buildings/buildingUpgradeRules";
import { composeEntityId } from "../utils";

export const PHARMACY_BUILDING_TYPE_ID = "pharmacy";

export const getPharmacyRecipe = (
  config: PharmacyBalanceConfig | undefined,
  recipeId: string
): PharmacyRecipeBalanceConfig | null => config?.recipes[recipeId as keyof PharmacyBalanceConfig["recipes"]] ?? null;

export const getPharmacyLine = (
  building: Building,
  recipeId: string
): BuildingProductionLine => building.productionLines?.[recipeId] ?? {
  recipeId,
  queuedAmount: 0,
  activeStartedAtTick: null,
  activeCompletesAtTick: null,
  reservedCleanCash: 0,
  unitCleanCashCost: 0,
  version: 0
};

export const getPharmacyBuildingResourceState = (
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

export const getPharmacyProducedAmount = (
  state: CoreGameState,
  building: Building,
  resourceKey: string
): number => Math.max(0, Number(getPharmacyBuildingResourceState(state, building).balances[resourceKey] || 0));

export const resolvePharmacyDurationTicks = (
  building: Building,
  recipe: PharmacyRecipeBalanceConfig,
  context: GameCoreContext
): number => Math.max(1, Math.ceil(
  resolveCraftProcessingDurationTicks(
    recipe.durationTicksPerUnit,
    context.config.balance.cooldownMultiplier
  ) / resolveProductionBuildingLevelMultiplier(building, context)
));

export const startPharmacyLine = (
  line: BuildingProductionLine,
  building: Building,
  recipe: PharmacyRecipeBalanceConfig,
  tick: number,
  context: GameCoreContext
): BuildingProductionLine => {
  if (line.queuedAmount <= 0 || line.activeCompletesAtTick !== null) {
    return line;
  }
  const durationTicks = resolvePharmacyDurationTicks(building, recipe, context);
  return {
    ...line,
    activeStartedAtTick: tick,
    activeCompletesAtTick: tick + durationTicks,
    version: line.version + 1
  };
};

export const normalizePharmacyLine = (
  line: BuildingProductionLine,
  recipeId: string
): BuildingProductionLine => ({
  recipeId,
  queuedAmount: Math.max(0, Math.floor(Number(line.queuedAmount || 0))),
  activeStartedAtTick: Number.isFinite(line.activeStartedAtTick) ? Number(line.activeStartedAtTick) : null,
  activeCompletesAtTick: Number.isFinite(line.activeCompletesAtTick) ? Number(line.activeCompletesAtTick) : null,
  reservedCleanCash: Math.max(0, Math.floor(Number(line.reservedCleanCash || 0))),
  unitCleanCashCost: Math.max(0, Math.floor(Number(line.unitCleanCashCost || 0))),
  version: Math.max(0, Math.floor(Number(line.version || 0)))
});
