import rawManifest from "./empire-streets-city-map.json";
import type { EmpireCityMapManifest } from "./empire-city-map-types";
import { createEmpireCityMapHash } from "./empire-city-map-hash";

export const empireStreetsCityMapManifest = rawManifest as EmpireCityMapManifest;
export const empireStreetsCityMapManifestId = empireStreetsCityMapManifest.id;
export const empireStreetsCityMapManifestVersion = empireStreetsCityMapManifest.version;
export const empireStreetsCityMapManifestHash = createEmpireCityMapHash(empireStreetsCityMapManifest);

export const empireStreetsCityMapDistrictsById = new Map(
  empireStreetsCityMapManifest.districts.map((district) => [district.id, district])
);

export const resolveCanonicalDistrictId = (inputId: unknown): string | null => {
  const raw = String(inputId ?? "").trim();
  if (!raw) return null;
  if (empireStreetsCityMapDistrictsById.has(raw)) return raw;
  if (raw.startsWith("district:")) return null;

  if (!/^\d+$/u.test(raw)) return null;
  const canonicalId = `district:${Number.parseInt(raw, 10)}`;
  return empireStreetsCityMapDistrictsById.has(canonicalId) ? canonicalId : null;
};

export const resolveLegacyDistrictId = (canonicalId: unknown): string | number | null =>
  empireStreetsCityMapDistrictsById.get(String(canonicalId ?? "").trim())?.legacyId ?? null;

export * from "./empire-city-map-types";
export * from "./empire-city-map-hash";
export * from "./empire-city-map-validation";
export * from "./empire-city-map-debug-report";
