export const UI_PARITY_DEBUG_BUILDING_TYPES_ENV =
  "EMPIRE_UI_PARITY_DEBUG_BUILDING_TYPES";

export function parseUiParityDebugBuildingTypes(rawValue) {
  return Object.freeze(Array.from(new Set(
    String(rawValue || "")
      .split(",")
      .map((buildingTypeId) => buildingTypeId.trim())
      .filter(Boolean)
  )));
}

export function selectUiParityDebugBuildingMatrix(matrix, buildingTypeIds) {
  if (buildingTypeIds.length === 0) return matrix;

  const availableBuildingTypeIds = new Set(
    matrix.flatMap((entry) => entry.coveredBuildingTypeIds)
  );
  const unknownBuildingTypeIds = buildingTypeIds.filter(
    (buildingTypeId) => !availableBuildingTypeIds.has(buildingTypeId)
  );
  if (unknownBuildingTypeIds.length > 0) {
    throw new Error(
      `Unknown spawn-reachable UI parity building type(s): ${unknownBuildingTypeIds.join(", ")}.`
    );
  }

  const selectedBuildingTypeIds = new Set(buildingTypeIds);
  return Object.freeze(matrix.flatMap((entry) => {
    const coveredBuildingTypeIds = entry.coveredBuildingTypeIds.filter(
      (buildingTypeId) => selectedBuildingTypeIds.has(buildingTypeId)
    );
    if (coveredBuildingTypeIds.length === 0) return [];
    return [Object.freeze({
      ...entry,
      coveredBuildingTypeIds: Object.freeze(coveredBuildingTypeIds)
    })];
  }));
}
