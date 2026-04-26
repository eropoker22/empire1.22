import type { CraftItemCommand } from "@empire/shared-types";
import type { CoreError } from "../errors";
import type { CoreGameState } from "../entities";
import type { GameCoreContext } from "../engine/context";

/**
 * Responsibility: Pure validator for server-authoritative building craft commands.
 * Belongs here: pure crafting command precondition checks.
 * Does not belong here: UI validation or persistence.
 */
export const validateCraft = (
  state: CoreGameState,
  command: CraftItemCommand,
  context: GameCoreContext
): CoreError[] => {
  const building = state.buildingsById[command.payload.buildingId];

  if (!building) {
    return [
      {
        code: "building_not_found",
        message: "Target crafting building does not exist."
      }
    ];
  }

  const district = state.districtsById[command.payload.districtId];

  if (!district || building.districtId !== district.id) {
    return [
      {
        code: "district_not_found",
        message: "Target district for crafting does not exist."
      }
    ];
  }

  if (district.ownerPlayerId !== command.playerId || building.ownerPlayerId !== command.playerId) {
    return [
      {
        code: "craft_not_owned",
        message: "Player does not own the target crafting building."
      }
    ];
  }

  if (building.status !== "active") {
    return [
      {
        code: "building_not_active",
        message: "Only active buildings can process items."
      }
    ];
  }

  const craftProfile = context.config.balance.craftBuildings?.[building.buildingTypeId];

  if (!craftProfile) {
    return [
      {
        code: "craft_not_supported",
        message: "The target building does not support migrated crafting yet."
      }
    ];
  }

  const recipe = craftProfile.recipes[command.payload.recipeId];

  if (!recipe) {
    return [
      {
        code: "craft_recipe_not_found",
        message: "Requested crafting recipe does not exist for this building."
      }
    ];
  }

  if (building.processing) {
    const activeRecipe = craftProfile.recipes[building.processing.recipeId];

    return [
      {
        code: "craft_processing_active",
        message: activeRecipe
          ? `${activeRecipe.label} is already processing in this building.`
          : "Another processing job is already running in this building."
      }
    ];
  }

  const player = state.playersById[command.playerId];
  const balances = player
    ? state.resourceStatesById[player.resourceStateId]?.balances ?? {}
    : {};

  for (const [resourceKey, requiredAmount] of Object.entries(recipe.inputCosts)) {
    const availableAmount = Math.max(0, Number(balances[resourceKey] || 0));

    if (availableAmount < requiredAmount) {
      return [
        {
          code: "craft_missing_inputs",
          message: `Need ${requiredAmount} ${formatResourceLabel(resourceKey)} to process ${recipe.label}.`
        }
      ];
    }
  }

  return [];
};

const formatResourceLabel = (resourceKey: string): string =>
  resourceKey
    .split("-")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
