import { empireStreetsCityMapManifest } from "@empire/game-config";
import type { DistrictId } from "@empire/shared-types";

export type NonDowntownDistrictZone = "commercial" | "industrial" | "residential" | "park";
export type SharedCityDistrictZone = NonDowntownDistrictZone | "downtown";

export interface ServerMapComposition {
  downtown: 8;
  commercial: number;
  industrial: number;
  residential: number;
  park: number;
}

export const nonDowntownZones = ["commercial", "industrial", "residential", "park"] as const;

export const SHARED_CITY_TOTAL_DISTRICT_COUNT = 161;
export const SHARED_CITY_DOWNTOWN_DISTRICT_COUNT = 8;
export const SHARED_CITY_NON_DOWNTOWN_DISTRICT_COUNT =
  SHARED_CITY_TOTAL_DISTRICT_COUNT - SHARED_CITY_DOWNTOWN_DISTRICT_COUNT;

export const DEFAULT_SERVER_MAP_COMPOSITION: ServerMapComposition = {
  downtown: 8,
  commercial: 40,
  industrial: 38,
  residential: 38,
  park: 37
};

export const buildingSetKeysByZone: Record<SharedCityDistrictZone, string[]> = {
  commercial: ["early-stable-2", "mid-mix-1", "mid-balance-1", "early-cash"],
  industrial: ["ind-early-1", "ind-mid-3", "ind-mid-1", "ind-early-4"],
  residential: ["res-early-3", "res-mid-1", "res-mid-2", "res-early-4"],
  park: ["park-early-1", "park-mid-3", "park-mid-1", "park-early-2"],
  downtown: ["down-core-1", "down-core-2", "down-core-3", "down-mid-2", "down-high-1"]
};

export const sharedCitySpawnDistrictIds = empireStreetsCityMapManifest.districts
  .filter((district) => district.isSpawnCandidate)
  .map((district) => district.id as DistrictId);

export const createConnectorDistrictIds = (): DistrictId[] =>
  Array.from({ length: 5 }, (_value, index) => createConnectorDistrictId(index + 1));

/** @deprecated Compatibility helper for old tests/debug labels; not a map source of truth. */
export const createConnectorDistrictId = (index: number): DistrictId =>
  createSharedCityDistrictId("connector", index);

/** @deprecated Compatibility helper for old IDs; canonical map IDs come from the manifest. */
export function createSharedCityDistrictId(
  kind: "spawn" | "connector" | "central" | "downtown" | NonDowntownDistrictZone,
  index: number
): DistrictId {
  return `district:${kind}:${index}`;
}

export const selectBuildingSetKey = (zone: SharedCityDistrictZone, index: number): string => {
  const keys = buildingSetKeysByZone[zone];
  return keys[index % keys.length] ?? keys[0]!;
};
