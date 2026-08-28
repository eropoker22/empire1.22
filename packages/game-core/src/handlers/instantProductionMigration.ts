import type { ResourceState } from "@empire/shared-types";
import type { GameCoreContext } from "../engine/context";
import type { CoreGameState } from "../entities";
import { composeEntityId } from "../utils";
import { normalizeStorageBalances } from "./warehouseBuilding";

type ProductionRecipe = {
  outputResourceKey: string;
  outputAmount: number;
};

/**
 * Settles inputs-paid production from historical snapshots exactly once.
 * Queue/processing records and building-local ready output are converted into
 * the owner's canonical storage balance, then removed from the legacy shape.
 */
export const migrateLegacyProductionToInstantState = (
  state: CoreGameState,
  context: Pick<GameCoreContext, "config">
): CoreGameState => {
  let buildingsById = state.buildingsById;
  let resourceStatesById = state.resourceStatesById;
  let changed = false;

  for (const originalBuilding of Object.values(state.buildingsById)) {
    const building = buildingsById[originalBuilding.id] ?? originalBuilding;
    const player = state.playersById[building.ownerPlayerId];
    if (!player) continue;
    const recipes = resolveProductionRecipes(building.buildingTypeId, context);
    if (!recipes) continue;

    const buildingResourceId = composeEntityId("resource", building.id);
    const buildingResources = resourceStatesById[buildingResourceId];
    const playerResources = resourceStatesById[player.resourceStateId]
      ?? createPlayerResourceState(player.id, player.resourceStateId, state.root.tick);
    let playerBalances = normalizeStorageBalances(playerResources.balances);
    let buildingBalances = { ...(buildingResources?.balances ?? {}) };
    let credited = false;
    let nextProcessing = building.processing;
    let nextLines = { ...(building.productionLines ?? {}) };
    let buildingChanged = false;

    if (building.processing) {
      const recipe = recipes[building.processing.recipeId];
      if (recipe) {
        playerBalances = credit(
          playerBalances,
          recipe.outputResourceKey,
          Math.max(0, Number(recipe.outputAmount || 0))
        );
        nextProcessing = null;
        credited = true;
        buildingChanged = true;
      }
    }

    for (const [recipeId, line] of Object.entries(building.productionLines ?? {})) {
      const recipe = recipes[recipeId];
      if (!recipe) continue;
      const queuedAmount = Math.max(0, Math.floor(Number(line.queuedAmount || 0)));
      const outputPerUnit = Math.max(0, Number(line.legacyOutputAmount ?? recipe.outputAmount ?? 0));
      const readyAmount = Math.max(0, Number(buildingBalances[recipe.outputResourceKey] || 0));
      const totalOutput = readyAmount + queuedAmount * outputPerUnit;
      if (totalOutput > 0) {
        playerBalances = credit(playerBalances, recipe.outputResourceKey, totalOutput);
        credited = true;
      }
      if (Object.prototype.hasOwnProperty.call(buildingBalances, recipe.outputResourceKey)) {
        delete buildingBalances[recipe.outputResourceKey];
      }
      delete nextLines[recipeId];
      buildingChanged = true;
    }

    if (!buildingChanged && !credited) continue;
    resourceStatesById = {
      ...resourceStatesById,
      [playerResources.id]: {
        ...playerResources,
        balances: playerBalances,
        lastUpdatedTick: state.root.tick,
        version: playerResources.version + (state.resourceStatesById[playerResources.id] ? 1 : 0)
      }
    };
    if (buildingResources) {
      resourceStatesById[buildingResources.id] = {
        ...buildingResources,
        balances: buildingBalances,
        lastUpdatedTick: state.root.tick,
        version: buildingResources.version + 1
      };
    }
    buildingsById = {
      ...buildingsById,
      [building.id]: {
        ...building,
        processing: nextProcessing,
        productionLines: nextLines,
        version: building.version + 1
      }
    };
    changed = true;
  }

  return changed ? { ...state, buildingsById, resourceStatesById } : state;
};

const resolveProductionRecipes = (
  buildingTypeId: string,
  context: Pick<GameCoreContext, "config">
): Record<string, ProductionRecipe> | null => {
  switch (buildingTypeId) {
    case "pharmacy":
      return context.config.balance.pharmacy?.recipes ?? null;
    case "drug_lab":
      return context.config.balance.drugLab?.recipes ?? null;
    case "factory":
      return context.config.balance.factory?.recipes ?? null;
    case "armory":
      return context.config.balance.armory?.recipes ?? null;
    default:
      return context.config.balance.craftBuildings?.[buildingTypeId]?.recipes ?? null;
  }
};

const credit = (balances: Record<string, number>, resourceKey: string, amount: number): Record<string, number> => ({
  ...balances,
  [resourceKey]: Math.max(0, Number(balances[resourceKey] || 0)) + Math.max(0, amount)
});

const createPlayerResourceState = (playerId: string, resourceStateId: string, tick: number): ResourceState => ({
  id: resourceStateId,
  ownerType: "player",
  ownerId: playerId,
  balances: {},
  incomeModifiers: {},
  lastUpdatedTick: tick,
  version: 1
});
