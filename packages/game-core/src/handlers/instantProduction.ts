import type { ResourceState } from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import type { GameCoreContext } from "../engine/context";
import type { CoreError } from "../errors";
import type { CoreEvent } from "../events";
import { CORE_EVENT_TYPES, createEvent } from "../events";
import { normalizeStorageBalances, canPlayerReceiveResource } from "./warehouseBuilding";
import { debitCosts, hasRequiredResources, scaleCosts } from "./productionLineCosts";

export interface InstantProductionRecipe {
  outputResourceKey: string;
  outputAmount: number;
  cleanCashCostPerUnit: number;
  inputCosts: Record<string, number>;
}

export interface InstantProductionErrors {
  playerMissing: CoreError;
  insufficientCash: CoreError;
  missingInputs: CoreError;
  storageFull?: CoreError;
}

export interface InstantProductionInput {
  state: CoreGameState;
  context: GameCoreContext;
  playerId: string;
  buildingId: string;
  districtId: string;
  recipeId: string;
  quantity: number;
  issuedAt: string;
  recipe: InstantProductionRecipe;
  errors: InstantProductionErrors;
}

export type InstantProductionResult = {
  nextState: CoreGameState;
  events: CoreEvent[];
  errors: CoreError[];
};

/**
 * Atomically debits recipe inputs and credits finished output in the same
 * authoritative command transition. There is no normal queue or collect step.
 */
export const executeInstantProduction = (input: InstantProductionInput): InstantProductionResult => {
  const { state, recipe } = input;
  const player = state.playersById[input.playerId];
  if (!player) return rejected(state, input.errors.playerMissing);

  const quantity = Math.max(0, Math.floor(Number(input.quantity || 0)));
  const storedResources = state.resourceStatesById[player.resourceStateId];
  const resources = storedResources
    ? { ...storedResources, balances: normalizeStorageBalances(storedResources.balances) }
    : createPlayerResourceState(player, state.root.tick);
  const inputCosts = scaleCosts(recipe.inputCosts, quantity);
  const cleanCashCost = Math.max(0, Number(recipe.cleanCashCostPerUnit || 0)) * quantity;
  const totalCosts = {
    ...inputCosts,
    ...(cleanCashCost > 0
      ? { cash: Math.max(0, Number(inputCosts.cash || 0)) + cleanCashCost }
      : {})
  };
  const availableCash = Math.max(0, Number(resources.balances.cash || 0));
  if (availableCash < cleanCashCost) return rejected(state, input.errors.insufficientCash);
  if (!hasRequiredResources(resources.balances, totalCosts)) return rejected(state, input.errors.missingInputs);

  const debitedBalances = debitCosts(resources.balances, totalCosts);
  const outputAmount = Math.max(0, Number(recipe.outputAmount || 0)) * quantity;
  const debitedResourceState: ResourceState = {
    ...resources,
    balances: debitedBalances,
    lastUpdatedTick: state.root.tick,
    version: resources.version + (storedResources ? 1 : 0)
  };
  const debitedState: CoreGameState = {
    ...state,
    resourceStatesById: {
      ...state.resourceStatesById,
      [debitedResourceState.id]: debitedResourceState
    }
  };
  const warehouse = input.context.config.balance.warehouse;
  const capacity = warehouse
    ? canPlayerReceiveResource(debitedState, player.id, recipe.outputResourceKey, outputAmount, warehouse)
    : null;
  if (capacity && !capacity.allowed) {
    return rejected(state, input.errors.storageFull ?? {
      code: capacity.code ?? "storage_capacity_full",
      message: capacity.message ?? "Sklad je pro vyrobenou položku plný."
    });
  }

  const nextResourceState: ResourceState = {
    ...debitedResourceState,
    balances: {
      ...debitedBalances,
      [recipe.outputResourceKey]: Math.max(
        0,
        Number(debitedBalances[recipe.outputResourceKey] || 0) + outputAmount
      )
    }
  };
  const building = state.buildingsById[input.buildingId];
  return {
    nextState: {
      ...state,
      playersById: {
        ...state.playersById,
        [player.id]: {
          ...player,
          lastActionAt: input.issuedAt,
          version: player.version + 1
        }
      },
      buildingsById: building
        ? {
            ...state.buildingsById,
            [building.id]: {
              ...building,
              processing: null,
              version: building.version + 1
            }
          }
        : state.buildingsById,
      resourceStatesById: {
        ...state.resourceStatesById,
        [nextResourceState.id]: nextResourceState
      }
    },
    events: [createEvent(CORE_EVENT_TYPES.itemCrafted, {
      playerId: player.id,
      districtId: input.districtId,
      buildingId: input.buildingId,
      recipeId: input.recipeId,
      outputResourceKey: recipe.outputResourceKey,
      outputAmount,
      quantity,
      instant: true
    })],
    errors: []
  };
};

const createPlayerResourceState = (
  player: CoreGameState["playersById"][string],
  tick: number
): ResourceState => ({
  id: player.resourceStateId,
  ownerType: "player",
  ownerId: player.id,
  balances: {},
  incomeModifiers: {},
  lastUpdatedTick: tick,
  version: 1
});

const rejected = (state: CoreGameState, error: CoreError): InstantProductionResult => ({
  nextState: state,
  events: [],
  errors: [error]
});
