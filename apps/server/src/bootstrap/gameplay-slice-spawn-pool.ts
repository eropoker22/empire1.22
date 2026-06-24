import type { DistrictId } from "@empire/shared-types";
import { empireStreetsCityMapManifest } from "@empire/game-config";

export type SpawnZone = "west" | "east" | "south";

export interface SpawnCandidate {
  districtId: DistrictId;
  zones: SpawnZone[];
  enabled: boolean;
  notes?: string;
}

export const sharedCitySpawnPool: SpawnCandidate[] = empireStreetsCityMapManifest.districts
  .filter((district) => district.isSpawnCandidate)
  .map((district): SpawnCandidate => ({
    districtId: district.id as DistrictId,
    zones: [...(district.spawnZones ?? [])],
    enabled: district.zone !== "downtown",
    notes: district.notes
  }));

export const enabledSharedCitySpawnDistrictIds = sharedCitySpawnPool
  .filter((candidate) => candidate.enabled)
  .map((candidate) => candidate.districtId);

export const findSharedCitySpawnCandidate = (
  districtId: string
): SpawnCandidate | undefined =>
  sharedCitySpawnPool.find((candidate) => candidate.districtId === districtId);
