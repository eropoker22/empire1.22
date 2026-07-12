import type { ResourceState } from "@empire/shared-types";
import type { CoreError } from "../errors";
import type { CoreGameState } from "../entities";
import type { CoreEvent } from "../events";
import type { GameCoreContext } from "../engine/context";
import { DRUG_LAB_BUILDING_TYPE_ID, getDrugLabRecipe } from "./drugLabProductionShared";

export type DrugLabHandlerResult = { nextState: CoreGameState; events: CoreEvent[]; errors: CoreError[] };

export const drugLabFailure = (state: CoreGameState, code: string, message: string): DrugLabHandlerResult => ({
  nextState: state,
  events: [],
  errors: [{ code, message }]
});

export const validateDrugLabTarget = (
  state: CoreGameState,
  command: { playerId: string; payload: { districtId: string; buildingId: string; recipeId: string } },
  context: GameCoreContext
) => {
  const building = state.buildingsById[command.payload.buildingId];
  if (!building || building.buildingTypeId !== DRUG_LAB_BUILDING_TYPE_ID) {
    return { building: null, recipe: null, errors: [{ code: "drug_lab_line_not_found", message: "Cílová výrobní linka Labu neexistuje." }] satisfies CoreError[] };
  }
  const district = state.districtsById[command.payload.districtId];
  if (!district || district.id !== building.districtId) {
    return { building: null, recipe: null, errors: [{ code: "district_not_found", message: "Cílový district neexistuje." }] satisfies CoreError[] };
  }
  if (district.ownerPlayerId !== command.playerId || building.ownerPlayerId !== command.playerId) {
    return { building: null, recipe: null, errors: [{ code: "drug_lab_not_owned", message: "Hráč nevlastní cílový Lab." }] satisfies CoreError[] };
  }
  if (building.status !== "active") {
    return { building: null, recipe: null, errors: [{ code: "drug_lab_not_active", message: "Lab musí být aktivní." }] satisfies CoreError[] };
  }
  const recipe = getDrugLabRecipe(context.config.balance.drugLab, command.payload.recipeId);
  return recipe
    ? { building, recipe, errors: [] as CoreError[] }
    : { building: null, recipe: null, errors: [{ code: "drug_lab_line_not_found", message: "Požadovaná výrobní linka neexistuje." }] satisfies CoreError[] };
};

export const createPlayerResourceState = (
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
