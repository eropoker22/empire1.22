import type { Building } from "@empire/shared-types";
import type { CoreGameState } from "../../entities";
import type { GameCoreContext } from "../../engine/context";
import { CORE_EVENT_TYPES, createEvent, type CoreEvent } from "../../events";
import { composeEntityId } from "../../utils";

type ProductionRecipe = { outputResourceKey: string };

/**
 * Creates canonical events for multi-line production that finished during this tick.
 * The completion rules remain usable as pure state transforms outside the tick loop,
 * while the authoritative tick still exposes the real completion to city-feed consumers.
 */
export const createProductionCompletionEvents = (
  before: CoreGameState,
  after: CoreGameState,
  context: GameCoreContext
): CoreEvent[] => {
  const events: CoreEvent[] = [];

  for (const building of Object.values(before.buildingsById)) {
    if (building.status !== "active") continue;
    const recipes = resolveRecipes(building, context);
    if (!recipes) continue;

    const beforeResource = before.resourceStatesById[composeEntityId("resource", building.id)];
    const afterResource = after.resourceStatesById[composeEntityId("resource", building.id)];
    if (!afterResource) continue;

    for (const [recipeId, recipe] of Object.entries(recipes)) {
      const line = building.productionLines?.[recipeId];
      if (line?.activeCompletesAtTick === null || line?.activeCompletesAtTick === undefined) continue;
      if (line.activeCompletesAtTick > after.root.tick) continue;

      const beforeAmount = Math.max(0, Number(beforeResource?.balances[recipe.outputResourceKey] ?? 0));
      const afterAmount = Math.max(0, Number(afterResource.balances[recipe.outputResourceKey] ?? 0));
      const outputAmount = Math.max(0, afterAmount - beforeAmount);
      if (outputAmount <= 0) continue;

      events.push(createEvent(CORE_EVENT_TYPES.itemCrafted, {
        playerId: building.ownerPlayerId,
        districtId: building.districtId,
        buildingId: building.id,
        recipeId,
        outputResourceKey: recipe.outputResourceKey,
        outputAmount,
        quantity: outputAmount,
        instant: false,
        completedAtTick: after.root.tick
      }));
    }
  }

  return events;
};

const resolveRecipes = (
  building: Building,
  context: GameCoreContext
): Record<string, ProductionRecipe> | null => {
  const recipes = building.buildingTypeId === "pharmacy"
    ? context.config.balance.pharmacy?.recipes
    : building.buildingTypeId === "drug_lab"
      ? context.config.balance.drugLab?.recipes
      : building.buildingTypeId === "factory"
        ? context.config.balance.factory?.recipes
        : building.buildingTypeId === "armory"
          ? context.config.balance.armory?.recipes
          : null;
  return recipes as Record<string, ProductionRecipe> | null | undefined ?? null;
};
