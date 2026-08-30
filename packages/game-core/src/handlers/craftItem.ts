import type { CraftItemCommand } from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import type { CoreEvent } from "../events";
import type { CoreError } from "../errors";
import type { GameCoreContext } from "../engine/context";
import { validateCraft } from "../validation";
import { normalizeStorageBalances } from "./warehouseBuilding";
import { debitCosts, scaleCosts } from "./productionLineCosts";
import { applyDistrictStabilizationToProductionDuration, resolveCraftProcessingDurationTicks } from "../rules/production/productionRules";

/**
 * Responsibility: Command-scoped orchestration for instant atomic crafting.
 * Belongs here: input debit and finished-output credit in one transition.
 * Does not belong here: UI inventory previews or transport glue.
 */
export const handleCraftItem = (
  state: CoreGameState,
  command: CraftItemCommand,
  context: GameCoreContext
): { nextState: CoreGameState; events: CoreEvent[]; errors: CoreError[] } => {
  const errors = validateCraft(state, command, context);

  if (errors.length > 0) {
    return { nextState: state, events: [], errors };
  }

  const player = state.playersById[command.playerId];
  const building = state.buildingsById[command.payload.buildingId];
  const craftProfile = building ? context.config.balance.craftBuildings?.[building.buildingTypeId] : undefined;
  const recipe = craftProfile?.recipes[command.payload.recipeId];

  if (!player || !building || !recipe) {
    return { nextState: state, events: [], errors: [] };
  }

  const quantity = Number(command.payload.quantity ?? 1);
  const storedResources = state.resourceStatesById[player.resourceStateId];
  if (!storedResources) return { nextState: state, events: [], errors: [] };
  const resources = { ...storedResources, balances: normalizeStorageBalances(storedResources.balances) };
  const durationTicks = applyDistrictStabilizationToProductionDuration(
    resolveCraftProcessingDurationTicks(recipe.durationTicks * quantity, context.config.balance.cooldownMultiplier),
    state,
    building,
    context
  );

  return {
    nextState: {
      ...state,
      playersById: {
        ...state.playersById,
        [player.id]: { ...player, lastActionAt: command.issuedAt, version: player.version + 1 }
      },
      buildingsById: {
        ...state.buildingsById,
        [building.id]: {
          ...building,
          processing: {
            recipeId: command.payload.recipeId,
            quantity,
            startedAtTick: state.root.tick,
            completesAtTick: state.root.tick + durationTicks
          },
          version: building.version + 1
        }
      },
      resourceStatesById: {
        ...state.resourceStatesById,
        [resources.id]: {
          ...resources,
          balances: debitCosts(resources.balances, scaleCosts(recipe.inputCosts, quantity)),
          lastUpdatedTick: state.root.tick,
          version: resources.version + 1
        }
      }
    },
    events: [],
    errors: []
  };
};
