import type { CoreGameState } from "../entities";
import { normalizeStorageBalances } from "./storageCapacityTypes";

/** Idempotent snapshot migration for historical camelCase storage aliases. */
export const normalizePlayerStorageResourceAliases = (state: CoreGameState): CoreGameState => {
  let resourceStatesById = state.resourceStatesById;
  let changed = false;
  for (const resourceState of Object.values(state.resourceStatesById)) {
    if (resourceState.ownerType !== "player") continue;
    const normalized = normalizeStorageBalances(resourceState.balances);
    if (sameBalances(resourceState.balances, normalized)) continue;
    if (!changed) resourceStatesById = { ...resourceStatesById };
    resourceStatesById[resourceState.id] = { ...resourceState, balances: normalized, version: resourceState.version + 1 };
    changed = true;
  }
  return changed ? { ...state, resourceStatesById } : state;
};

const sameBalances = (left: Record<string, number>, right: Record<string, number>): boolean => {
  const leftKeys = Object.keys(left);
  return leftKeys.length === Object.keys(right).length
    && leftKeys.every((key) => Number(left[key] || 0) === Number(right[key] || 0));
};
