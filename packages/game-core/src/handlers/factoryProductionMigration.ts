import type { CoreGameState } from "../entities";
import { FACTORY_BUILDING_TYPE_ID, normalizeFactoryLine } from "./factoryProductionShared";

const FACTORY_RECIPE_IDS = new Set(["metal-parts", "tech-core", "combat-module"]);

/**
 * Legacy factory processing already reserved its known inputs. It becomes one
 * line with zero refundable reservation, so restoring a snapshot is idempotent.
 */
export const migrateFactoryProductionState = (state: CoreGameState): CoreGameState => {
  let buildingsById = state.buildingsById;
  let changed = false;
  for (const building of Object.values(state.buildingsById)) {
    if (building.buildingTypeId !== FACTORY_BUILDING_TYPE_ID) continue;
    const districtOwnerId = state.districtsById[building.districtId]?.ownerPlayerId;
    const needsOwnershipMigration = building.ownerPlayerId === "player:neutral" && districtOwnerId !== null && districtOwnerId !== undefined;
    if (needsOwnershipMigration) {
      buildingsById = {
        ...buildingsById,
        [building.id]: {
          ...building,
          ownerPlayerId: districtOwnerId,
          version: building.version + 1
        }
      };
      changed = true;
    }
    if (!building.processing) continue;
    const recipeId = building.processing.recipeId;
    if (!FACTORY_RECIPE_IDS.has(recipeId) || building.productionLines?.[recipeId]) continue;
    const line = normalizeFactoryLine({
      recipeId,
      queuedAmount: 1,
      activeStartedAtTick: building.processing.startedAtTick,
      activeCompletesAtTick: building.processing.completesAtTick,
      reservedCleanCash: 0,
      reservedResourceCosts: {},
      unitCleanCashCost: 0,
      unitResourceCosts: {},
      version: 1
    }, recipeId);
    buildingsById = {
      ...buildingsById,
      [building.id]: {
        ...(buildingsById[building.id] ?? building),
        processing: null,
        productionLines: { ...building.productionLines, [recipeId]: line },
        version: building.version + 1
      }
    };
    changed = true;
  }
  return changed ? { ...state, buildingsById } : state;
};
