import type { CoreGameState } from "../../entities";
import type { GameCoreContext } from "../../engine/context";
import {
  getPharmacyBuildingResourceState,
  getPharmacyLine,
  PHARMACY_BUILDING_TYPE_ID,
  startPharmacyLine
} from "../../handlers/pharmacyProductionShared";

export const completePharmacyProduction = (
  state: CoreGameState,
  context: GameCoreContext
): CoreGameState => {
  const pharmacy = context.config.balance.pharmacy;
  if (!pharmacy) return state;
  let buildingsById = state.buildingsById;
  let resourceStatesById = state.resourceStatesById;
  let changed = false;

  for (const building of Object.values(state.buildingsById)) {
    if (building.buildingTypeId !== PHARMACY_BUILDING_TYPE_ID || building.status !== "active") continue;
    let lines = building.productionLines ?? {};
    let resourceState = getPharmacyBuildingResourceState({ ...state, resourceStatesById }, building);
    let buildingChanged = false;
    let resourceChanged = false;

    for (const [recipeId, recipe] of Object.entries(pharmacy.recipes)) {
      let line = getPharmacyLine({ ...building, productionLines: lines }, recipeId);
      let lineChanged = false;
      const producedAmount = Math.max(0, Number(resourceState.balances[recipe.outputResourceKey] || 0));
      if (line.activeCompletesAtTick !== null && line.activeCompletesAtTick <= state.root.tick) {
        if (producedAmount >= recipe.localOutputCap) continue;
        resourceState = {
          ...resourceState,
          balances: {
            ...resourceState.balances,
            [recipe.outputResourceKey]: producedAmount + 1
          },
          lastUpdatedTick: state.root.tick,
          version: resourceState.version + 1
        };
        resourceChanged = true;
        line = {
          ...line,
          queuedAmount: Math.max(0, line.queuedAmount - 1),
          activeStartedAtTick: null,
          activeCompletesAtTick: null,
          reservedCleanCash: Math.max(0, line.reservedCleanCash - line.unitCleanCashCost),
          version: line.version + 1
        };
        lineChanged = true;
        buildingChanged = true;
      }
      const nextProducedAmount = Math.max(0, Number(resourceState.balances[recipe.outputResourceKey] || 0));
      const startedLine = nextProducedAmount < recipe.localOutputCap
        ? startPharmacyLine(state, line, building, recipe, state.root.tick, context)
        : line;
      if (startedLine !== line) {
        lineChanged = true;
        buildingChanged = true;
      }
      if (lineChanged || Object.hasOwn(lines, recipeId)) {
        lines = { ...lines, [recipeId]: startedLine };
      }
    }

    if (resourceChanged) resourceStatesById = { ...resourceStatesById, [resourceState.id]: resourceState };
    if (buildingChanged) {
      buildingsById = {
        ...buildingsById,
        [building.id]: { ...building, productionLines: lines, version: building.version + 1 }
      };
    }
    changed = changed || resourceChanged || buildingChanged;
  }

  return changed ? { ...state, buildingsById, resourceStatesById } : state;
};
