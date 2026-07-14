import type { Building, BuildingProductionLine, ResourceState } from "@empire/shared-types";
import type { DrugLabBalanceConfig, DrugLabRecipeBalanceConfig } from "../contracts";
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

export const DRUG_LAB_BUILDING_TYPE_ID = "drug_lab";

export const getDrugLabRecipe = (
  config: DrugLabBalanceConfig | undefined,
  recipeId: string
): DrugLabRecipeBalanceConfig | null =>
  config?.recipes[recipeId as keyof DrugLabBalanceConfig["recipes"]] ?? null;

export const getDrugLabLine = (
  building: Building,
  recipeId: string
): BuildingProductionLine => getProductionLine(building, recipeId);

export const getDrugLabBuildingResourceState = (
  state: CoreGameState,
  building: Building
): ResourceState => getBuildingProductionResourceState(state, building);

export const getDrugLabProducedAmount = (
  state: CoreGameState,
  building: Building,
  resourceKey: string
): number => getProducedAmount(state, building, resourceKey);

export const resolveDrugLabDurationTicks = (
  state: CoreGameState,
  building: Building,
  recipe: DrugLabRecipeBalanceConfig,
  context: GameCoreContext
): number => resolveProductionLineDurationTicks(state, building, recipe, context);

export const startDrugLabLine = (
  state: CoreGameState,
  line: BuildingProductionLine,
  building: Building,
  recipe: DrugLabRecipeBalanceConfig,
  tick: number,
  context: GameCoreContext
): BuildingProductionLine => startProductionLine(state, line, building, recipe, tick, context);

export const normalizeDrugLabLine = (
  line: BuildingProductionLine,
  recipeId: string
): BuildingProductionLine => normalizeProductionLine(line, recipeId);
