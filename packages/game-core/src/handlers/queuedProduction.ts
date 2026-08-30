import type { Building, BuildingProductionLine, ResourceState } from "@empire/shared-types";
import type { GameCoreContext } from "../engine/context";
import type { CoreError } from "../errors";
import type { CoreGameState } from "../entities";
import type { CoreEvent } from "../events";
import { normalizeStorageBalances } from "./warehouseBuilding";
import { addCosts, debitCosts, hasRequiredResources, scaleCosts } from "./productionLineCosts";
import { normalizeResourceCosts } from "./productionLineShared";

interface QueuedProductionRecipe {
  outputResourceKey: string;
  outputAmount: number;
  cleanCashCostPerUnit: number;
  inputCosts: Record<string, number>;
  queueCap: number;
}

interface QueueProductionInput<TRecipe extends QueuedProductionRecipe> {
  state: CoreGameState;
  context: GameCoreContext;
  playerId: string;
  building: Building;
  recipeId: string;
  quantity: number;
  issuedAt: string;
  recipe: TRecipe;
  getLine: (building: Building, recipeId: string) => BuildingProductionLine;
  startLine: (
    state: CoreGameState,
    line: BuildingProductionLine,
    building: Building,
    recipe: TRecipe,
    tick: number,
    context: GameCoreContext
  ) => BuildingProductionLine;
  createPlayerResourceState: (player: CoreGameState["playersById"][string], tick: number) => ResourceState;
  errors: {
    playerMissing: CoreError;
    insufficientCash: CoreError;
    missingInputs: CoreError;
    queueFull: CoreError;
  };
}

export type QueuedProductionResult = {
  nextState: CoreGameState;
  events: CoreEvent[];
  errors: CoreError[];
};

export const executeQueuedProduction = <TRecipe extends QueuedProductionRecipe>(
  input: QueueProductionInput<TRecipe>
): QueuedProductionResult => {
  const player = input.state.playersById[input.playerId];
  if (!player) return rejected(input.state, input.errors.playerMissing);

  const quantity = Math.max(0, Math.floor(Number(input.quantity || 0)));
  const line = input.getLine(input.building, input.recipeId);
  if (line.queuedAmount + quantity > input.recipe.queueCap) {
    return rejected(input.state, input.errors.queueFull);
  }

  const storedResources = input.state.resourceStatesById[player.resourceStateId];
  const resources = storedResources
    ? { ...storedResources, balances: normalizeStorageBalances(storedResources.balances) }
    : input.createPlayerResourceState(player, input.state.root.tick);
  const unitInputCosts = normalizeResourceCosts(input.recipe.inputCosts);
  const totalInputCosts = scaleCosts(unitInputCosts, quantity);
  const cleanCashCost = Math.max(0, Number(input.recipe.cleanCashCostPerUnit || 0)) * quantity;
  const totalCosts = {
    ...totalInputCosts,
    ...(cleanCashCost > 0
      ? { cash: Math.max(0, Number(totalInputCosts.cash || 0)) + cleanCashCost }
      : {})
  };
  if (Math.max(0, Number(resources.balances.cash || 0)) < cleanCashCost) {
    return rejected(input.state, input.errors.insufficientCash);
  }
  if (!hasRequiredResources(resources.balances, totalCosts)) {
    return rejected(input.state, input.errors.missingInputs);
  }

  const queuedLine: BuildingProductionLine = {
    ...line,
    queuedAmount: line.queuedAmount + quantity,
    reservedCleanCash: line.reservedCleanCash + cleanCashCost,
    reservedResourceCosts: addCosts(line.reservedResourceCosts, totalInputCosts),
    unitCleanCashCost: Math.max(0, Number(input.recipe.cleanCashCostPerUnit || 0)),
    unitResourceCosts: unitInputCosts,
    legacyOutputAmount: input.recipe.outputAmount > 1 ? input.recipe.outputAmount : undefined,
    version: line.version + 1
  };
  const canonicalBuilding = input.state.buildingsById[input.building.id] ?? input.building;
  const activeLine = input.startLine(
    input.state,
    queuedLine,
    canonicalBuilding,
    input.recipe,
    input.state.root.tick,
    input.context
  );
  const nextResourceState: ResourceState = {
    ...resources,
    balances: debitCosts(resources.balances, totalCosts),
    lastUpdatedTick: input.state.root.tick,
    version: resources.version + (storedResources ? 1 : 0)
  };

  return {
    nextState: {
      ...input.state,
      playersById: {
        ...input.state.playersById,
        [player.id]: { ...player, lastActionAt: input.issuedAt, version: player.version + 1 }
      },
      buildingsById: {
        ...input.state.buildingsById,
        [canonicalBuilding.id]: {
          ...canonicalBuilding,
          productionLines: {
            ...canonicalBuilding.productionLines,
            [input.recipeId]: activeLine
          },
          version: canonicalBuilding.version + 1
        }
      },
      resourceStatesById: {
        ...input.state.resourceStatesById,
        [nextResourceState.id]: nextResourceState
      }
    },
    events: [],
    errors: []
  };
};

const rejected = (state: CoreGameState, error: CoreError): QueuedProductionResult => ({
  nextState: state,
  events: [],
  errors: [error]
});
