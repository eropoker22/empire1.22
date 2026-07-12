import type { ResourceState } from "@empire/shared-types";
import type { CoreError } from "../errors";
import type { CoreGameState } from "../entities";
import type { CoreEvent } from "../events";
import type { GameCoreContext } from "../engine/context";
import { ARMORY_BUILDING_TYPE_ID, getArmoryRecipe } from "./armoryProductionShared";

export type ArmoryHandlerResult = { nextState: CoreGameState; events: CoreEvent[]; errors: CoreError[] };

export const armoryFailure = (state: CoreGameState, code: string, message: string): ArmoryHandlerResult => ({
  nextState: state, events: [], errors: [{ code, message }]
});

export const validateArmoryTarget = (
  state: CoreGameState,
  command: { playerId: string; payload: { districtId: string; buildingId: string; recipeId: string } },
  context: GameCoreContext
) => {
  const building = state.buildingsById[command.payload.buildingId];
  if (!building || building.buildingTypeId !== ARMORY_BUILDING_TYPE_ID) {
    return { building: null, recipe: null, errors: [{ code: "armory_line_not_found", message: "Cílová výrobní linka Zbrojovky neexistuje." }] satisfies CoreError[] };
  }
  const district = state.districtsById[command.payload.districtId];
  if (!district || district.id !== building.districtId) {
    return { building: null, recipe: null, errors: [{ code: "district_not_found", message: "Cílový district neexistuje." }] satisfies CoreError[] };
  }
  if (district.ownerPlayerId !== command.playerId || building.ownerPlayerId !== command.playerId) {
    return { building: null, recipe: null, errors: [{ code: "armory_not_owned", message: "Hráč nevlastní cílovou Zbrojovku." }] satisfies CoreError[] };
  }
  if (building.status !== "active") {
    return { building: null, recipe: null, errors: [{ code: "armory_not_active", message: "Zbrojovka musí být aktivní." }] satisfies CoreError[] };
  }
  const recipe = getArmoryRecipe(context.config.balance.armory, command.payload.recipeId);
  return recipe
    ? { building, recipe, errors: [] as CoreError[] }
    : { building: null, recipe: null, errors: [{ code: "armory_line_not_found", message: "Požadovaná výrobní linka neexistuje." }] satisfies CoreError[] };
};

export const createArmoryPlayerResourceState = (
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
