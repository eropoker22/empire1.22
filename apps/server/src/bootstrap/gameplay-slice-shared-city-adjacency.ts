import type { DistrictSeedPlan } from "./gameplay-slice-shared-city-plan";

export const makeAdjacencySymmetric = (plans: DistrictSeedPlan[]): DistrictSeedPlan[] => {
  const adjacencyById = new Map(plans.map((plan) => [plan.id, new Set(plan.adjacentDistrictIds)]));

  for (const plan of plans) {
    for (const adjacentDistrictId of plan.adjacentDistrictIds) {
      adjacencyById.get(adjacentDistrictId)?.add(plan.id);
    }
  }

  return plans.map((plan) => ({
    ...plan,
    adjacentDistrictIds: Array.from(adjacencyById.get(plan.id) ?? [])
  }));
};

export const wrapIndex = (value: number, length: number): number =>
  ((value - 1 + length) % length) + 1;
