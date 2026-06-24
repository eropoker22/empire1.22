import type { EmpireCityMapManifest } from "./empire-city-map-types";

const sortDistrictIds = (left: string, right: string): number =>
  left.localeCompare(right, "en", { numeric: true });

const normalizePoint = (value: number): number =>
  Number(Number(value).toFixed(3));

export const normalizeEmpireCityMapForHash = (
  manifest: EmpireCityMapManifest
): unknown => ({
  id: manifest.id,
  version: manifest.version,
  width: manifest.width,
  height: manifest.height,
  districts: [...manifest.districts]
    .sort((left, right) => sortDistrictIds(left.id, right.id))
    .map((district) => ({
      id: district.id,
      legacyId: district.legacyId ?? null,
      name: district.name,
      zone: district.zone,
      polygon: district.polygon.map((point) => ({
        x: normalizePoint(point.x),
        y: normalizePoint(point.y)
      })),
      neighborIds: [...district.neighborIds].sort(sortDistrictIds),
      buildingSetKey: district.buildingSetKey ?? null,
      spawnZones: [...(district.spawnZones ?? [])].sort(),
      isSpawnCandidate: Boolean(district.isSpawnCandidate),
      isDowntown: Boolean(district.isDowntown)
    }))
});

export const stableStringifyMapValue = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringifyMapValue).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) =>
      `${JSON.stringify(key)}:${stableStringifyMapValue(record[key])}`
    ).join(",")}}`;
  }
  return JSON.stringify(value);
};

export const createEmpireCityMapHash = (
  manifest: EmpireCityMapManifest
): string => {
  const text = stableStringifyMapValue(normalizeEmpireCityMapForHash(manifest));
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`;
};
