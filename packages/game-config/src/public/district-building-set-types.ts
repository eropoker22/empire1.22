export interface PublicDistrictBuildingSet {
  key: string;
  zone: string;
  tier: string;
  title: string;
  buildingTypes: string[];
}

export interface ResolveDistrictBuildingTypesInput {
  districtId: string;
  zone?: string | null;
  buildingSetKey?: string | null;
  buildingTier?: string | null;
  legacyBuildingNames?: readonly string[] | null;
}

export const createDistrictBuildingSet = (
  zone: string,
  tier: string,
  key: string,
  title: string,
  buildingTypes: string[]
): PublicDistrictBuildingSet => ({ key, zone, tier, title, buildingTypes });
