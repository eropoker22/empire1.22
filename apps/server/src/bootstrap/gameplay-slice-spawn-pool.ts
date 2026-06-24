import type { DistrictId } from "@empire/shared-types";
import { sharedCitySpawnDistrictIds } from "./gameplay-slice-shared-city-map-constants";

export type SpawnZone = "west" | "east" | "south";

export interface SpawnCandidate {
  districtId: DistrictId;
  zones: SpawnZone[];
  enabled: boolean;
  notes?: string;
}

const westSpawnIds = sharedCitySpawnDistrictIds.slice(0, 7);
const eastSpawnIds = sharedCitySpawnDistrictIds.slice(7, 14);
const southSpawnIds = sharedCitySpawnDistrictIds.slice(14, 20);

export const sharedCitySpawnPool: SpawnCandidate[] = [
  ...westSpawnIds.map((districtId, index): SpawnCandidate => ({
    districtId,
    zones: index === 6 ? ["west", "south"] : ["west"],
    enabled: true
  })),
  ...eastSpawnIds.map((districtId, index): SpawnCandidate => ({
    districtId,
    zones: index === 0 ? ["east", "south"] : ["east"],
    enabled: true
  })),
  ...southSpawnIds.map((districtId): SpawnCandidate => ({
    districtId,
    zones: ["south"],
    enabled: true
  }))
];

export const enabledSharedCitySpawnDistrictIds = sharedCitySpawnPool
  .filter((candidate) => candidate.enabled)
  .map((candidate) => candidate.districtId);

export const findSharedCitySpawnCandidate = (
  districtId: string
): SpawnCandidate | undefined =>
  sharedCitySpawnPool.find((candidate) => candidate.districtId === districtId);
