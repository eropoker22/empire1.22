import type { CoreGameState } from "../../entities";
import type { GameCoreContext } from "../../engine/context";
import { normalizeResourceCosts } from "../../handlers/productionLineShared";
import {
  FACTORY_BUILDING_TYPE_ID,
  getFactoryBuildingResourceState,
  getFactoryLine,
  startFactoryLine
} from "../../handlers/factoryProductionShared";

export const completeFactoryProduction = (
  state: CoreGameState,
  context: GameCoreContext
): CoreGameState => {
  const factory = context.config.balance.factory;
  if (!factory) return state;
  let buildingsById = state.buildingsById;
  let resourceStatesById = state.resourceStatesById;
  let changed = false;

  for (const building of Object.values(state.buildingsById)) {
    if (building.buildingTypeId !== FACTORY_BUILDING_TYPE_ID || building.status !== "active") continue;
    let lines = building.productionLines ?? {};
    let resources = getFactoryBuildingResourceState({ ...state, resourceStatesById }, building);
    let buildingChanged = false;
    let resourcesChanged = false;

    for (const [recipeId, recipe] of Object.entries(factory.recipes)) {
      let line = getFactoryLine({ ...building, productionLines: lines }, recipeId);
      while (
        line.activeCompletesAtTick !== null
        && line.activeCompletesAtTick <= state.root.tick
        && Math.max(0, Number(resources.balances[recipe.outputResourceKey] || 0)) < recipe.localOutputCap
      ) {
        const completedAtTick = line.activeCompletesAtTick;
        const producedAmount = Math.max(0, Number(resources.balances[recipe.outputResourceKey] || 0));
        resources = {
          ...resources,
          balances: { ...resources.balances, [recipe.outputResourceKey]: producedAmount + 1 },
          lastUpdatedTick: state.root.tick,
          version: resources.version + 1
        };
        resourcesChanged = true;
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
        if (producedAmount + 1 < recipe.localOutputCap) {
          line = startFactoryLine(
            { ...state, resourceStatesById },
            line,
            building,
            recipe,
            completedAtTick,
            context
          );
        }
        buildingChanged = true;
      }
      const producedAmount = Math.max(0, Number(resources.balances[recipe.outputResourceKey] || 0));
      if (line.activeCompletesAtTick === null && line.queuedAmount > 0 && producedAmount < recipe.localOutputCap) {
        line = startFactoryLine({ ...state, resourceStatesById }, line, building, recipe, state.root.tick, context);
        buildingChanged = true;
      }
      if (line.queuedAmount > 0 || line.activeCompletesAtTick !== null) {
        lines = { ...lines, [recipeId]: line };
      }
    }

    if (resourcesChanged) resourceStatesById = { ...resourceStatesById, [resources.id]: resources };
    if (buildingChanged) {
      buildingsById = { ...buildingsById, [building.id]: { ...building, productionLines: lines, version: building.version + 1 } };
    }
    changed = changed || resourcesChanged || buildingChanged;
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
