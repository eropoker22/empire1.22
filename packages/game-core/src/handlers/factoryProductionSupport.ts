import type { ResourceState } from "@empire/shared-types";
import type { CoreError } from "../errors";
import type { CoreGameState } from "../entities";
import type { CoreEvent } from "../events";
import type { GameCoreContext } from "../engine/context";
import { FACTORY_BUILDING_TYPE_ID, getFactoryRecipe, isFactoryOwnedBy } from "./factoryProductionShared";

export type FactoryHandlerResult = { nextState: CoreGameState; events: CoreEvent[]; errors: CoreError[] };

export const factoryFailure = (state: CoreGameState, code: string, message: string): FactoryHandlerResult => ({
  nextState: state,
  events: [],
  errors: [{ code, message }]
});

export const validateFactoryTarget = (
  state: CoreGameState,
  command: { playerId: string; payload: { districtId: string; buildingId: string; recipeId: string } },
  context: GameCoreContext
) => {
  const building = state.buildingsById[command.payload.buildingId];
  if (!building || building.buildingTypeId !== FACTORY_BUILDING_TYPE_ID) {
    return { building: null, recipe: null, errors: [{ code: "factory_line_not_found", message: "Cílová výrobní linka Továrny neexistuje." }] satisfies CoreError[] };
  }
  const district = state.districtsById[command.payload.districtId];
  if (!district || district.id !== building.districtId) {
    return { building: null, recipe: null, errors: [{ code: "district_not_found", message: "Cílový district neexistuje." }] satisfies CoreError[] };
  }
  if (district.ownerPlayerId !== command.playerId || !isFactoryOwnedBy(state, building, command.playerId)) {
    return { building: null, recipe: null, errors: [{ code: "factory_not_owned", message: "Hráč nevlastní cílovou Továrnu." }] satisfies CoreError[] };
  }
  if (building.status !== "active") {
    return { building: null, recipe: null, errors: [{ code: "factory_not_active", message: "Továrna musí být aktivní." }] satisfies CoreError[] };
  }
  const recipe = getFactoryRecipe(context.config.balance.factory, command.payload.recipeId);
  return recipe
    ? { building, recipe, errors: [] as CoreError[] }
    : { building: null, recipe: null, errors: [{ code: "factory_line_not_found", message: "Požadovaná výrobní linka neexistuje." }] satisfies CoreError[] };
};

export const createFactoryPlayerResourceState = (
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
