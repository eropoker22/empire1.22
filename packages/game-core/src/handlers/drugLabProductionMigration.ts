import type { CoreGameState } from "../entities";
import { DRUG_LAB_BUILDING_TYPE_ID, normalizeDrugLabLine } from "./drugLabProductionShared";

const LEGACY_RECIPE_IDS = new Set(["neon-dust", "pulse-shot", "velvet-smoke", "ghost-serum", "overdrive-x"]);
const LEGACY_OUTPUT_AMOUNTS: Record<string, number> = { "neon-dust": 2, "velvet-smoke": 2 };

/**
 * Legacy generic craft jobs had already paid their inputs. They move into one
 * typed line with a zero reservation and keep their historical output once.
 */
export const migrateDrugLabProductionState = (state: CoreGameState): CoreGameState => {
  let buildingsById = state.buildingsById;
  let changed = false;
  for (const building of Object.values(state.buildingsById)) {
    if (building.buildingTypeId !== DRUG_LAB_BUILDING_TYPE_ID || !building.processing) continue;
    const recipeId = building.processing.recipeId;
    if (!LEGACY_RECIPE_IDS.has(recipeId) || building.productionLines?.[recipeId]) continue;
    const line = normalizeDrugLabLine({
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
