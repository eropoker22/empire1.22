import type { CoreGameState } from "@empire/game-core";
import type { DistrictId } from "@empire/shared-types";

export const findDistrictPath = (
  state: CoreGameState,
  sourceDistrictId: DistrictId,
  targetDistrictId: DistrictId
): DistrictId[] | null => {
  const queue: DistrictId[][] = [[sourceDistrictId]];
  const visited = new Set<DistrictId>();

  while (queue.length > 0) {
    const path = queue.shift()!;
    const districtId = path[path.length - 1]!;
    if (districtId === targetDistrictId) return path;
    if (visited.has(districtId)) continue;
    visited.add(districtId);

    for (const adjacentDistrictId of state.districtsById[districtId]?.adjacentDistrictIds ?? []) {
      if (!visited.has(adjacentDistrictId) && state.districtsById[adjacentDistrictId]) {
        queue.push([...path, adjacentDistrictId]);
      }
    }
  }

  return null;
};

export const isConnectedDistrictGraph = (state: CoreGameState): boolean => {
  const [firstDistrictId] = state.root.districtIds;
  if (!firstDistrictId) return true;
  return state.root.districtIds.every((districtId) => findDistrictPath(state, firstDistrictId, districtId) !== null);
};
