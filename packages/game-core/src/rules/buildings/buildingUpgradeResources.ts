import type { ResourceState } from "@empire/shared-types";

export const hasEnoughResourcesForUpgrade = (
  resourceState: ResourceState | undefined,
  costs: Record<string, number>
): boolean =>
  Object.entries(costs).every(([resourceKey, requiredAmount]) =>
    Math.max(0, Number(resourceState?.balances?.[resourceKey] || 0)) >= Math.max(0, Number(requiredAmount || 0))
  );

export const cleanCostRecord = (costs: Record<string, number>): Record<string, number> =>
  Object.fromEntries(
    Object.entries(costs)
      .map(([key, value]): [string, number] => [key, Math.max(0, Math.floor(Number(value || 0)))])
      .filter(([, value]) => value > 0)
  );
