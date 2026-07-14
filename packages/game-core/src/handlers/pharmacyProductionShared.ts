import type { Building, BuildingProductionLine, ResourceState } from "@empire/shared-types";
import type { PharmacyBalanceConfig, PharmacyRecipeBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import type { GameCoreContext } from "../engine/context";
import {
  getBuildingProductionResourceState,
  getProducedAmount,
  getProductionLine,
  normalizeProductionLine,
  resolveProductionLineDurationTicks,
  startProductionLine
} from "./productionLineShared";

export const PHARMACY_BUILDING_TYPE_ID = "pharmacy";

export const getPharmacyRecipe = (
  config: PharmacyBalanceConfig | undefined,
  recipeId: string
): PharmacyRecipeBalanceConfig | null => config?.recipes[recipeId as keyof PharmacyBalanceConfig["recipes"]] ?? null;

export const getPharmacyLine = (
  building: Building,
  recipeId: string
): BuildingProductionLine => getProductionLine(building, recipeId);

export const getPharmacyBuildingResourceState = (
  state: CoreGameState,
  building: Building
): ResourceState => {
  return getBuildingProductionResourceState(state, building);
};

export const getPharmacyProducedAmount = (
  state: CoreGameState,
  building: Building,
  resourceKey: string
): number => getProducedAmount(state, building, resourceKey);

export const resolvePharmacyDurationTicks = (
  state: CoreGameState,
  building: Building,
  recipe: PharmacyRecipeBalanceConfig,
  context: GameCoreContext
): number => Math.max(1, Math.ceil(
  resolveProductionLineDurationTicks(state, building, recipe, context)
));

export const startPharmacyLine = (
  state: CoreGameState,
  line: BuildingProductionLine,
  building: Building,
  recipe: PharmacyRecipeBalanceConfig,
  tick: number,
  context: GameCoreContext
): BuildingProductionLine => {
  return startProductionLine(state, line, building, recipe, tick, context);
};

export const normalizePharmacyLine = (
  line: BuildingProductionLine,
  recipeId: string
): BuildingProductionLine => normalizeProductionLine(line, recipeId);
