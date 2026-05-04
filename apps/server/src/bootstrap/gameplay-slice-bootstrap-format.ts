import type { GameModeId } from "@empire/shared-types";

/**
 * Responsibility: Deterministic ids and labels for the temporary gameplay slice seed.
 * Belongs here: bootstrap-only formatting helpers.
 * Does not belong here: gameplay rules or persistence state.
 */
export const createNeighborDistrictId = (districtId: string, offset: number): string => {
  const numericId = Number.parseInt(districtId.replace(/^district:/u, ""), 10);
  return Number.isFinite(numericId) && numericId > 0
    ? `district:${numericId + offset}`
    : `${districtId}:neighbor:${offset}`;
};

export const createBuildingId = (districtId: string, buildingTypeId: string, index: number): string =>
  `building:${districtId.replace(/[^a-z0-9-]/giu, "-")}:${buildingTypeId}:${index + 1}`;

export const inferModeFromInstanceId = (instanceId: string): GameModeId =>
  instanceId.toLowerCase().includes("free") ? "free" : "war";

export const formatDistrictName = (districtId: string): string =>
  `District ${districtId.replace(/^district:/u, "")}`;
