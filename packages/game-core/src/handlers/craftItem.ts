import type { CraftItemCommand, ResourceState } from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import type { CoreEvent } from "../events";
import type { CoreError } from "../errors";
import { createEvent, CORE_EVENT_TYPES } from "../events";
import type { GameCoreContext } from "../engine/context";
import { resolveCraftProcessingDurationTicks } from "../rules/production/productionRules";
import { validateCraft } from "../validation";
import { applyGarageCooldownReductionTicks } from "./garageBuildingActions";
import { resolvePowerStationInfrastructureMultiplier } from "./powerStationBuildingActions";
import { resolveProductionBuildingLevelMultiplier } from "../rules/buildings/buildingUpgradeRules";

/**
 * Responsibility: Command-scoped orchestration for the first migrated craft-item processing flow.
 * Belongs here: command-scoped crafting start orchestration.
 * Does not belong here: UI inventory previews or transport glue.
 */
export const handleCraftItem = (
  state: CoreGameState,
  command: CraftItemCommand,
  context: GameCoreContext
): { nextState: CoreGameState; events: CoreEvent[]; errors: CoreError[] } => ({
  nextState: (() => {
    const errors = validateCraft(state, command, context);

    if (errors.length > 0) {
      return state;
    }

    const player = state.playersById[command.playerId];
    const building = state.buildingsById[command.payload.buildingId];
    const craftProfile = context.config.balance.craftBuildings?.[building.buildingTypeId];
    const recipe = craftProfile?.recipes[command.payload.recipeId];

    if (!player || !recipe) {
      return state;
    }

    const currentResourceState = state.resourceStatesById[player.resourceStateId] ?? createPlayerResourceState(player, state.root.tick);
    const nextBalances = {
      ...currentResourceState.balances
    };

    for (const [resourceKey, requiredAmount] of Object.entries(recipe.inputCosts)) {
      nextBalances[resourceKey] = Math.max(0, Number(nextBalances[resourceKey] || 0) - requiredAmount);
    }

    const nextPlayerResourceState: ResourceState = {
      ...currentResourceState,
      balances: nextBalances,
      lastUpdatedTick: state.root.tick,
      version: currentResourceState.version + (state.resourceStatesById[player.resourceStateId] ? 1 : 0)
    };
    const infrastructureMultiplier = building.buildingTypeId === "armory"
      ? resolvePowerStationInfrastructureMultiplier({
          state,
          playerId: building.ownerPlayerId,
          config: context.config.balance.powerStation,
          tick: state.root.tick,
          target: "armoryProductionSpeed"
        })
      : 1;
    const baseDurationTicks = Math.max(1, Math.ceil(resolveCraftProcessingDurationTicks(
      recipe.durationTicks,
      context.config.balance.cooldownMultiplier
    ) / infrastructureMultiplier / resolveProductionBuildingLevelMultiplier(building, context)));
    const garageCategory = building.buildingTypeId === "armory"
      ? "armoryProductionActions"
      : building.buildingTypeId === "factory"
        ? "factoryProductionActions"
        : null;
    const durationTicks = garageCategory
      ? applyGarageCooldownReductionTicks({
          baseTicks: baseDurationTicks,
          state,
          playerId: player.id,
          config: context.config.balance.garage,
          category: garageCategory
        })
      : baseDurationTicks;
    const nextBuilding = {
      ...building,
      processing: {
        recipeId: command.payload.recipeId,
        startedAtTick: state.root.tick,
        completesAtTick: state.root.tick + durationTicks
      },
      version: building.version + 1
    };

    return {
      ...state,
      buildingsById: {
        ...state.buildingsById,
        [nextBuilding.id]: nextBuilding
      },
      resourceStatesById: {
        ...state.resourceStatesById,
        [nextPlayerResourceState.id]: nextPlayerResourceState
      }
    };
  })(),
  events: (() => {
    const errors = validateCraft(state, command, context);

    if (errors.length > 0) {
      return [];
    }

    const building = state.buildingsById[command.payload.buildingId];
    const recipe = context.config.balance.craftBuildings?.[building.buildingTypeId]?.recipes[command.payload.recipeId];

    return recipe
      ? [
          createEvent(CORE_EVENT_TYPES.itemProcessingStarted, {
            playerId: command.playerId,
            districtId: command.payload.districtId,
            buildingId: command.payload.buildingId,
            recipeId: command.payload.recipeId,
            completesAtTick: state.root.tick + resolveCraftDurationTicks({
              state,
              playerId: command.playerId,
              building,
              recipeDurationTicks: recipe.durationTicks,
              context
            })
          })
        ]
      : [];
  })(),
  errors: validateCraft(state, command, context)
});

const resolveCraftDurationTicks = (input: {
  state: CoreGameState;
  playerId: string;
  building: CoreGameState["buildingsById"][string];
  recipeDurationTicks: number;
  context: GameCoreContext;
}): number => {
  const infrastructureMultiplier = input.building.buildingTypeId === "armory"
    ? resolvePowerStationInfrastructureMultiplier({
        state: input.state,
        playerId: input.building.ownerPlayerId,
        config: input.context.config.balance.powerStation,
        tick: input.state.root.tick,
        target: "armoryProductionSpeed"
      })
    : 1;
  const baseDurationTicks = Math.max(1, Math.ceil(resolveCraftProcessingDurationTicks(
    input.recipeDurationTicks,
    input.context.config.balance.cooldownMultiplier
  ) / infrastructureMultiplier / resolveProductionBuildingLevelMultiplier(input.building, input.context)));
  const garageCategory = input.building.buildingTypeId === "armory"
    ? "armoryProductionActions"
    : input.building.buildingTypeId === "factory"
      ? "factoryProductionActions"
      : null;
  return garageCategory
    ? applyGarageCooldownReductionTicks({
        baseTicks: baseDurationTicks,
        state: input.state,
        playerId: input.playerId,
        config: input.context.config.balance.garage,
        category: garageCategory
      })
    : baseDurationTicks;
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
