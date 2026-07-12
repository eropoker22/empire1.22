import type { Building, BuildingProductionLine, ResourceState } from "@empire/shared-types";
import type { FactoryBalanceConfig, FactoryRecipeBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import type { GameCoreContext } from "../engine/context";
import { resolveProductionBuildingLevelMultiplier } from "../rules/buildings/buildingUpgradeRules";
import { resolveCraftProcessingDurationTicks } from "../rules/production/productionRules";
import {
  getBuildingProductionResourceState,
  getProducedAmount,
  getProductionLine,
  normalizeProductionLine
} from "./productionLineShared";

export const FACTORY_BUILDING_TYPE_ID = "factory";

export const getFactoryRecipe = (
  config: FactoryBalanceConfig | undefined,
  recipeId: string
): FactoryRecipeBalanceConfig | null =>
  config?.recipes[recipeId as keyof FactoryBalanceConfig["recipes"]] ?? null;

export const getFactoryLine = (building: Building, recipeId: string): BuildingProductionLine =>
  getProductionLine(building, recipeId);

export const getFactoryBuildingResourceState = (
  state: CoreGameState,
  building: Building
): ResourceState => getBuildingProductionResourceState(state, building);

export const getFactoryProducedAmount = (
  state: CoreGameState,
  building: Building,
  resourceKey: string
): number => getProducedAmount(state, building, resourceKey);

export const resolveActiveFactoryCount = (state: CoreGameState, playerId: string): number =>
  Object.values(state.buildingsById).filter((building) =>
    building.buildingTypeId === FACTORY_BUILDING_TYPE_ID
      && building.ownerPlayerId === playerId
      && building.status === "active"
  ).length;

export const resolveFactoryNetworkSpeedMultiplier = (
  factoryCount: number,
  config: FactoryBalanceConfig
): number => {
  const normalizedCount = Math.max(1, Math.floor(Number(factoryCount || 0)));
  const band = Math.min(4, normalizedCount) as 1 | 2 | 3 | 4;
  return Math.min(config.network.maxSpeedMultiplier, config.network.speedMultipliers[band]);
};

export const resolveFactoryDurationTicks = (
  state: CoreGameState,
  building: Building,
  recipe: FactoryRecipeBalanceConfig,
  context: GameCoreContext
): number => {
  const factory = context.config.balance.factory;
  if (!factory) return Math.max(1, recipe.durationTicksPerUnit);
  const baseDuration = resolveCraftProcessingDurationTicks(
    recipe.durationTicksPerUnit,
    context.config.balance.cooldownMultiplier
  );
  const networkMultiplier = resolveFactoryNetworkSpeedMultiplier(
    resolveActiveFactoryCount(state, building.ownerPlayerId ?? ""),
    factory
  );
  return Math.max(1, Math.ceil(
    baseDuration / networkMultiplier / resolveProductionBuildingLevelMultiplier(building, context)
  ));
};

export const startFactoryLine = (
  state: CoreGameState,
  line: BuildingProductionLine,
  building: Building,
  recipe: FactoryRecipeBalanceConfig,
  tick: number,
  context: GameCoreContext
): BuildingProductionLine => {
  if (line.queuedAmount <= 0 || line.activeCompletesAtTick !== null) return line;
  const durationTicks = resolveFactoryDurationTicks(state, building, recipe, context);
  return {
    ...line,
    activeStartedAtTick: tick,
    activeCompletesAtTick: tick + durationTicks,
    version: line.version + 1
  };
};

export const normalizeFactoryLine = (
  line: BuildingProductionLine,
  recipeId: string
): BuildingProductionLine => normalizeProductionLine(line, recipeId);
