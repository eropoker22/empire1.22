import type { CoreGameState } from "../../entities";

export interface MapGraphValidationIssue {
  code:
    | "DUPLICATE_NEIGHBOR"
    | "SELF_NEIGHBOR"
    | "MISSING_NEIGHBOR"
    | "ASYMMETRIC_NEIGHBOR";
  districtId: string;
  neighborId?: string;
}

export const validateDistrictAdjacencyGraph = (
  state: Pick<CoreGameState, "districtsById">
): MapGraphValidationIssue[] => {
  const issues: MapGraphValidationIssue[] = [];

  for (const district of Object.values(state.districtsById)) {
    const seenNeighborIds = new Set<string>();

    for (const neighborId of district.adjacentDistrictIds) {
      if (neighborId === district.id) {
        issues.push({ code: "SELF_NEIGHBOR", districtId: district.id, neighborId });
      }

      if (seenNeighborIds.has(neighborId)) {
        issues.push({ code: "DUPLICATE_NEIGHBOR", districtId: district.id, neighborId });
      }
      seenNeighborIds.add(neighborId);

      const neighbor = state.districtsById[neighborId];
      if (!neighbor) {
        issues.push({ code: "MISSING_NEIGHBOR", districtId: district.id, neighborId });
      } else if (!neighbor.adjacentDistrictIds.includes(district.id)) {
        issues.push({ code: "ASYMMETRIC_NEIGHBOR", districtId: district.id, neighborId });
      }
    }
  }

  return issues;
};
