import {
  formatDistrictName,
  isRecord,
  normalizeDistrictNumber
} from "./live-gameplay-slice-normalizers";

export interface LegacyMapDistrictRecord {
  id?: unknown;
  mapId?: unknown;
  map_id?: unknown;
  name?: unknown;
  type?: unknown;
  zone?: unknown;
  influence?: unknown;
  heat?: unknown;
  buildings?: unknown;
  buildingNameOverrides?: unknown;
  buildingSetKey?: unknown;
  buildingSetTitle?: unknown;
  buildingTier?: unknown;
}

declare global {
  interface Window {
    Empire?: {
      districts?: unknown[];
    };
  }
}

export const readLegacyMapDistrictsByNumber = (): Map<number, LegacyMapDistrictRecord> => {
  const byNumber = new Map<number, LegacyMapDistrictRecord>();
  const districts = Array.isArray(window.Empire?.districts) ? window.Empire.districts : [];

  districts.forEach((district) => {
    if (!isRecord(district)) {
      return;
    }

    const districtRecord = district as LegacyMapDistrictRecord;
    const districtNumber = normalizeDistrictNumber(
      districtRecord.mapId ?? districtRecord.map_id ?? districtRecord.id ?? districtRecord.name
    );

    if (districtNumber > 0) {
      byNumber.set(districtNumber, districtRecord);
    }
  });

  return byNumber;
};

export const normalizeMapDistrictName = (
  mapDistrict: LegacyMapDistrictRecord | undefined,
  districtId: string
): string => normalizeMapDistrictString(mapDistrict?.name) ?? formatDistrictName(districtId);

export const normalizeMapDistrictZone = (
  mapDistrict: LegacyMapDistrictRecord | undefined
): string | undefined => normalizeMapDistrictString(mapDistrict?.type ?? mapDistrict?.zone)?.toLowerCase();

export const normalizeMapDistrictBuildings = (
  mapDistrict: LegacyMapDistrictRecord | undefined
): string[] | undefined => {
  if (!Array.isArray(mapDistrict?.buildings)) {
    return undefined;
  }
  const buildings = mapDistrict.buildings
    .map((building) => String(building || "").trim())
    .filter(Boolean);
  return buildings.length > 0 ? buildings : undefined;
};

export const normalizeMapDistrictBuildingDisplayNames = (
  mapDistrict: LegacyMapDistrictRecord | undefined
): string[] | undefined => {
  if (!Array.isArray(mapDistrict?.buildingNameOverrides)) {
    return undefined;
  }
  const displayNames = mapDistrict.buildingNameOverrides.map((buildingName) =>
    String(buildingName || "").trim()
  );
  return displayNames.some(Boolean) ? displayNames : undefined;
};

export const normalizeMapDistrictString = (value: unknown): string | undefined => {
  const normalized = String(value || "").trim();
  return normalized || undefined;
};

export const normalizeMapDistrictNumber = (value: unknown): number | undefined => {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : undefined;
};
