import type { DistrictId } from "@empire/shared-types";
import { empireStreetsCityMapManifest } from "@empire/game-config";
import {
  type ServerMapComposition
} from "./gameplay-slice-shared-city-map-constants";

export interface DistrictSeedPlan {
  id: DistrictId;
  name: string;
  zone: string;
  buildingSetKey?: string;
  adjacentDistrictIds: DistrictId[];
}

/**
 * Deprecated compatibility adapter. The active source of truth is
 * empireStreetsCityMapManifest; this function no longer creates an abstract
 * spawn/connector/central/extension graph.
 */
export const createSharedCityPlans = (composition: ServerMapComposition): DistrictSeedPlan[] => {
  void composition;
  return empireStreetsCityMapManifest.districts.map((district): DistrictSeedPlan => ({
    id: district.id as DistrictId,
    name: district.name,
    zone: district.zone,
    ...(district.buildingSetKey ? { buildingSetKey: district.buildingSetKey } : {}),
    adjacentDistrictIds: district.neighborIds as DistrictId[]
  }));
};
