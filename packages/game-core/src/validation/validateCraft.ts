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
        message: "Cílová craft budova neexistuje."
      }
    ];
  }

  const district = state.districtsById[command.payload.districtId];

  if (!district || building.districtId !== district.id) {
    return [
      {
        code: "district_not_found",
        message: "Cílový district pro craft neexistuje."
      }
    ];
  }

  if (district.ownerPlayerId !== command.playerId || building.ownerPlayerId !== command.playerId) {
    return [
      {
        code: "craft_not_owned",
        message: "Hráč nevlastní cílovou craft budovu."
      }
    ];
  }

  if (building.status !== "active") {
    return [
      {
        code: "building_not_active",
        message: "Itemy může zpracovat jen aktivní budova."
      }
    ];
  }

  const craftProfile = context.config.balance.craftBuildings?.[building.buildingTypeId];

  if (!craftProfile) {
    return [
      {
        code: "craft_not_supported",
        message: "Cílová budova zatím nepodporuje serverový craft."
      }
    ];
  }

  const recipe = craftProfile.recipes[command.payload.recipeId];

  if (!recipe) {
    return [
      {
        code: "craft_recipe_not_found",
        message: "Požadovaný craft recept pro tuhle budovu neexistuje."
      }
    ];
  }

  if (building.processing) {
    const activeRecipe = craftProfile.recipes[building.processing.recipeId];

    return [
      {
        code: "craft_processing_active",
        message: activeRecipe
          ? `${activeRecipe.label} už se v téhle budově zpracovává.`
          : "V téhle budově už běží jiné zpracování."
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
          message: `Chybí ${requiredAmount} ${formatResourceLabel(resourceKey)} pro zpracování ${recipe.label}.`
        }
      ];
    }
  }

  return [];
};

const formatResourceLabel = (resourceKey: string): string =>
  RESOURCE_LABELS[resourceKey] ??
  resourceKey
    .split("-")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");

const RESOURCE_LABELS: Record<string, string> = {
  "combat-module": "Bojový modul",
  combatModule: "Bojový modul"
};
