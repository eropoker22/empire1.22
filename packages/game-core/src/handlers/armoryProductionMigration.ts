import type { CoreGameState } from "../entities";
import { ARMORY_BUILDING_TYPE_ID, normalizeArmoryLine } from "./armoryProductionShared";

const RECIPE_IDS = new Set([
  "baseball-bat", "pistol", "grenade", "smg", "bazooka",
  "vest", "barricades", "cameras", "defense-tower", "alarm"
]);
const LEGACY_OUTPUT_AMOUNTS: Record<string, number> = {
  "baseball-bat": 3,
  pistol: 2,
  grenade: 2,
  vest: 2,
  barricades: 2,
  cameras: 2
};

export const migrateArmoryProductionState = (state: CoreGameState): CoreGameState => {
  let buildingsById = state.buildingsById;
  let changed = false;
  for (const building of Object.values(state.buildingsById)) {
    if (building.buildingTypeId !== ARMORY_BUILDING_TYPE_ID || !building.processing) continue;
    const recipeId = building.processing.recipeId;
    if (!RECIPE_IDS.has(recipeId) || building.productionLines?.[recipeId]) continue;
    const line = normalizeArmoryLine({
      recipeId,
      queuedAmount: 1,
      activeStartedAtTick: building.processing.startedAtTick,
      activeCompletesAtTick: building.processing.completesAtTick,
      reservedCleanCash: 0,
      reservedResourceCosts: {},
      unitCleanCashCost: 0,
      unitResourceCosts: {},
      legacyOutputAmount: LEGACY_OUTPUT_AMOUNTS[recipeId],
      version: 1
    }, recipeId);
    buildingsById = {
      ...buildingsById,
      [building.id]: {
        ...building,
        processing: null,
        productionLines: { ...building.productionLines, [recipeId]: line },
        version: building.version + 1
      }
    };
    changed = true;
  }
  return changed ? { ...state, buildingsById } : state;
};
