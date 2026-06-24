export type EmpireCityMapZone = "commercial" | "industrial" | "residential" | "park" | "downtown";
export type EmpireCityMapSpawnZone = "west" | "east" | "south";

export interface EmpireCityMapPoint {
  x: number;
  y: number;
}

export interface EmpireCityMapDistrict {
  id: string;
  legacyId?: string | number;
  rowIndex?: number;
  columnIndex?: number;
  name: string;
  zone: EmpireCityMapZone;
  polygon: EmpireCityMapPoint[];
  neighborIds: string[];
  buildingSetKey?: string;
  spawnZones?: EmpireCityMapSpawnZone[];
  isSpawnCandidate?: boolean;
  isDowntown?: boolean;
  notes?: string;
}

export interface EmpireCityMapManifest {
  id: "empire-streets-city";
  version: number;
  width: number;
  height: number;
  districts: EmpireCityMapDistrict[];
}
