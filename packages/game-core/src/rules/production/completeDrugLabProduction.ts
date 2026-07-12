import type { CoreGameState } from "../../entities";
import type { GameCoreContext } from "../../engine/context";
import {
  DRUG_LAB_BUILDING_TYPE_ID,
  getDrugLabBuildingResourceState,
  getDrugLabLine,
  startDrugLabLine
} from "../../handlers/drugLabProductionShared";
import { normalizeResourceCosts } from "../../handlers/productionLineShared";

export const completeDrugLabProduction = (
  state: CoreGameState,
  context: GameCoreContext
): CoreGameState => {
  const drugLab = context.config.balance.drugLab;
  if (!drugLab) return state;
  let buildingsById = state.buildingsById;
  let resourceStatesById = state.resourceStatesById;
  let changed = false;

  for (const building of Object.values(state.buildingsById)) {
    if (building.buildingTypeId !== DRUG_LAB_BUILDING_TYPE_ID || building.status !== "active") continue;
    let lines = building.productionLines ?? {};
    let resourceState = getDrugLabBuildingResourceState({ ...state, resourceStatesById }, building);
    let buildingChanged = false;
    let resourceChanged = false;

    for (const [recipeId, recipe] of Object.entries(drugLab.recipes)) {
      let line = getDrugLabLine({ ...building, productionLines: lines }, recipeId);
      let lineChanged = false;
      const outputAmount = Math.max(1, Number(line.legacyOutputAmount || 1));
      const producedAmount = Math.max(0, Number(resourceState.balances[recipe.outputResourceKey] || 0));
      if (line.activeCompletesAtTick !== null && line.activeCompletesAtTick <= state.root.tick) {
        if (producedAmount + outputAmount > recipe.localOutputCap) continue;
        resourceState = {
          ...resourceState,
          balances: { ...resourceState.balances, [recipe.outputResourceKey]: producedAmount + outputAmount },
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
          reservedResourceCosts: subtractUnitCosts(line.reservedResourceCosts, line.unitResourceCosts),
          legacyOutputAmount: undefined,
          version: line.version + 1
        };
        lineChanged = true;
        buildingChanged = true;
      }
      const nextProducedAmount = Math.max(0, Number(resourceState.balances[recipe.outputResourceKey] || 0));
      const startedLine = nextProducedAmount < recipe.localOutputCap
        ? startDrugLabLine(line, building, recipe, state.root.tick, context)
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

const subtractUnitCosts = (
  reserved: Record<string, number> | undefined,
  unit: Record<string, number> | undefined
): Record<string, number> => {
  const next = normalizeResourceCosts(reserved);
  for (const [resourceKey, amount] of Object.entries(normalizeResourceCosts(unit))) {
    next[resourceKey] = Math.max(0, Number(next[resourceKey] || 0) - amount);
  }
  return Object.fromEntries(Object.entries(next).filter(([, amount]) => amount > 0));
};
