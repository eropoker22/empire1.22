import type { Building, BuildingProductionLine, ResourceState } from "@empire/shared-types";
import type { ArmoryBalanceConfig, ArmoryRecipeBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import type { GameCoreContext } from "../engine/context";
import { resolveProductionBuildingLevelMultiplier } from "../rules/buildings/buildingUpgradeRules";
import { resolveCraftProcessingDurationTicks } from "../rules/production/productionRules";
import { getPlayerProductionBoostMultiplier } from "../rules/player-boosts";
import {
  getBuildingProductionResourceState,
  getProducedAmount,
  getProductionLine,
  normalizeProductionLine
} from "./productionLineShared";

export const ARMORY_BUILDING_TYPE_ID = "armory";

export const getArmoryRecipe = (
  config: ArmoryBalanceConfig | undefined,
  recipeId: string
): ArmoryRecipeBalanceConfig | null =>
  config?.recipes[recipeId as keyof ArmoryBalanceConfig["recipes"]] ?? null;

export const getArmoryLine = (building: Building, recipeId: string): BuildingProductionLine =>
  getProductionLine(building, recipeId);

export const getArmoryBuildingResourceState = (
  state: CoreGameState,
  building: Building
): ResourceState => getBuildingProductionResourceState(state, building);

export const getArmoryProducedAmount = (
  state: CoreGameState,
  building: Building,
  resourceKey: string
): number => getProducedAmount(state, building, resourceKey);

export const resolveActiveArmoryCount = (state: CoreGameState, playerId: string): number =>
  Object.values(state.buildingsById).filter((building) =>
    building.buildingTypeId === ARMORY_BUILDING_TYPE_ID
      && building.ownerPlayerId === playerId
      && building.status === "active"
  ).length;

export const resolveArmoryNetworkSpeedMultiplier = (
  armoryCount: number,
  config: ArmoryBalanceConfig
): number => {
  const band = Math.min(4, Math.max(1, Math.floor(Number(armoryCount || 0)))) as 1 | 2 | 3 | 4;
  return Math.min(config.network.maxSpeedMultiplier, config.network.speedMultipliers[band]);
};

export const resolveArmoryDurationTicks = (
  state: CoreGameState,
  building: Building,
  recipe: ArmoryRecipeBalanceConfig,
  context: GameCoreContext
): number => {
  const armory = context.config.balance.armory;
  if (!armory) return Math.max(1, recipe.durationTicksPerUnit);
  const baseDuration = resolveCraftProcessingDurationTicks(recipe.durationTicksPerUnit, context.config.balance.cooldownMultiplier);
  return Math.max(1, Math.ceil(
    baseDuration
      / resolveArmoryNetworkSpeedMultiplier(resolveActiveArmoryCount(state, building.ownerPlayerId ?? ""), armory)
      / resolveProductionBuildingLevelMultiplier(building, context)
      / getPlayerProductionBoostMultiplier(state, building.ownerPlayerId, state.root.tick)
  ));
};

export const startArmoryLine = (
  state: CoreGameState,
  line: BuildingProductionLine,
  building: Building,
  recipe: ArmoryRecipeBalanceConfig,
  tick: number,
  context: GameCoreContext
): BuildingProductionLine => {
  if (line.queuedAmount <= 0 || line.activeCompletesAtTick !== null) return line;
  const durationTicks = resolveArmoryDurationTicks(state, building, recipe, context);
  return {
    ...line,
    activeStartedAtTick: tick,
    activeCompletesAtTick: tick + durationTicks,
    version: line.version + 1
  };
};

export const normalizeArmoryLine = (
  line: BuildingProductionLine,
  recipeId: string
): BuildingProductionLine => normalizeProductionLine(line, recipeId);
