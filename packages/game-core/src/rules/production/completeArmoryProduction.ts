import type { CoreGameState } from "../../entities";
import type { GameCoreContext } from "../../engine/context";
import { normalizeResourceCosts } from "../../handlers/productionLineShared";
import {
  ARMORY_BUILDING_TYPE_ID,
  getArmoryBuildingResourceState,
  getArmoryLine,
  startArmoryLine
} from "../../handlers/armoryProductionShared";

export const completeArmoryProduction = (
  state: CoreGameState,
  context: GameCoreContext
): CoreGameState => {
  const armory = context.config.balance.armory;
  if (!armory) return state;
  let buildingsById = state.buildingsById;
  let resourceStatesById = state.resourceStatesById;
  let changed = false;

  for (const building of Object.values(state.buildingsById)) {
    if (building.buildingTypeId !== ARMORY_BUILDING_TYPE_ID || building.status !== "active") continue;
    let lines = building.productionLines ?? {};
    let resources = getArmoryBuildingResourceState({ ...state, resourceStatesById }, building);
    let buildingChanged = false;
    let resourcesChanged = false;

    for (const [recipeId, recipe] of Object.entries(armory.recipes)) {
      let line = getArmoryLine({ ...building, productionLines: lines }, recipeId);
      let lineChanged = false;
      while (line.activeCompletesAtTick !== null && line.activeCompletesAtTick <= state.root.tick) {
        const legacyOutputAmount = Math.max(1, Number(line.legacyOutputAmount || 1));
        const producedAmount = Math.max(0, Number(resources.balances[recipe.outputResourceKey] || 0));
        if (legacyOutputAmount === 1 && producedAmount >= recipe.localOutputCap) break;
        const completedAtTick = line.activeCompletesAtTick;
        resources = {
          ...resources,
          balances: { ...resources.balances, [recipe.outputResourceKey]: producedAmount + legacyOutputAmount },
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
        if (producedAmount + legacyOutputAmount < recipe.localOutputCap) {
          line = startArmoryLine({ ...state, resourceStatesById }, line, building, recipe, completedAtTick, context);
        }
        lineChanged = true;
        buildingChanged = true;
      }
      const producedAmount = Math.max(0, Number(resources.balances[recipe.outputResourceKey] || 0));
      if (line.activeCompletesAtTick === null && line.queuedAmount > 0 && producedAmount < recipe.localOutputCap) {
        line = startArmoryLine({ ...state, resourceStatesById }, line, building, recipe, state.root.tick, context);
        lineChanged = true;
        buildingChanged = true;
      }
      if (lineChanged || Object.hasOwn(lines, recipeId)) {
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
