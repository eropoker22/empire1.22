import type { CoreGameState } from "../entities";
import { normalizePharmacyLine, PHARMACY_BUILDING_TYPE_ID } from "./pharmacyProductionShared";

const PHARMACY_RECIPE_IDS = new Set(["chemicals", "biomass", "stim-pack"]);

/**
 * Converts the old single processing slot only once. Legacy jobs had already paid
 * inputs, so their reservation remains zero and completion never charges again.
 */
export const migratePharmacyProductionState = (state: CoreGameState): CoreGameState => {
  let buildingsById = state.buildingsById;
  let changed = false;
  for (const building of Object.values(state.buildingsById)) {
    if (building.buildingTypeId !== PHARMACY_BUILDING_TYPE_ID || !building.processing) continue;
    const recipeId = building.processing.recipeId;
    if (!PHARMACY_RECIPE_IDS.has(recipeId) || building.productionLines?.[recipeId]) continue;
    const line = normalizePharmacyLine({
      recipeId,
      queuedAmount: 1,
      activeStartedAtTick: building.processing.startedAtTick,
      activeCompletesAtTick: building.processing.completesAtTick,
      reservedCleanCash: 0,
      unitCleanCashCost: 0,
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
