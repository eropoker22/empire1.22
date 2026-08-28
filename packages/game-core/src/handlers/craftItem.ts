import type { CraftItemCommand } from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import type { CoreEvent } from "../events";
import type { CoreError } from "../errors";
import type { GameCoreContext } from "../engine/context";
import { validateCraft } from "../validation";
import { executeInstantProduction } from "./instantProduction";

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

  return executeInstantProduction({
    state,
    context,
    playerId: command.playerId,
    buildingId: building.id,
    districtId: building.districtId,
    recipeId: command.payload.recipeId,
    quantity: Number(command.payload.quantity ?? 1),
    issuedAt: command.issuedAt,
    recipe: {
      outputResourceKey: recipe.outputResourceKey,
      outputAmount: recipe.outputAmount,
      cleanCashCostPerUnit: 0,
      inputCosts: recipe.inputCosts
    },
    errors: {
      playerMissing: { code: "craft_not_owned", message: "Hráč nevlastní cílovou craft budovu." },
      insufficientCash: { code: "craft_missing_inputs", message: "Na výrobu nemáš dost clean cash." },
      missingInputs: { code: "craft_missing_inputs", message: "Na výrobu nemáš dost materiálových vstupů." }
    }
  });
};
