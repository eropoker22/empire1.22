import type {
  EmpireCityMapDistrict,
  EmpireCityMapManifest,
  EmpireCityMapSpawnZone,
  EmpireCityMapZone
} from "./empire-city-map-types";

export interface EmpireCityMapValidationIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
  districtId?: string;
}

const validZones = new Set<EmpireCityMapZone>(["commercial", "industrial", "residential", "park", "downtown"]);
const validSpawnZones = new Set<EmpireCityMapSpawnZone>(["west", "east", "south"]);

export const validateEmpireCityMapManifest = (
  manifest: EmpireCityMapManifest,
  options: { expectedDistrictCount?: number; expectedDowntownCount?: number } = {}
): EmpireCityMapValidationIssue[] => {
  const issues: EmpireCityMapValidationIssue[] = [];
  const expectedDistrictCount = options.expectedDistrictCount ?? 161;
  const expectedDowntownCount = options.expectedDowntownCount ?? 8;
  const districtsById = new Map<string, EmpireCityMapDistrict>();
  const legacyIds = new Set<string>();

  if (manifest.districts.length !== expectedDistrictCount) {
    issues.push({
      severity: "error",
      code: "map.invalid_district_count",
      message: `Map must contain ${expectedDistrictCount} districts, got ${manifest.districts.length}.`
    });
  }

  for (const district of manifest.districts) {
    if (!district.id.trim()) {
      issues.push({ severity: "error", code: "map.empty_district_id", message: "District ID cannot be empty." });
      continue;
    }
    if (districtsById.has(district.id)) {
      issues.push({ severity: "error", code: "map.duplicate_district_id", message: `Duplicate district ID ${district.id}.`, districtId: district.id });
    }
    districtsById.set(district.id, district);

    if (district.legacyId !== undefined) {
      const legacyId = String(district.legacyId);
      if (legacyIds.has(legacyId)) {
        issues.push({ severity: "error", code: "map.duplicate_legacy_id", message: `Duplicate legacy ID ${legacyId}.`, districtId: district.id });
      }
      legacyIds.add(legacyId);
    }

    if (!validZones.has(district.zone)) {
      issues.push({ severity: "error", code: "map.invalid_zone", message: `Invalid district zone ${district.zone}.`, districtId: district.id });
    }
    if (!Array.isArray(district.polygon) || district.polygon.length < 3) {
      issues.push({ severity: "error", code: "map.invalid_polygon", message: "District polygon must contain at least 3 points.", districtId: district.id });
    }
    const duplicateNeighbors = findDuplicates(district.neighborIds);
    for (const duplicateNeighbor of duplicateNeighbors) {
      issues.push({ severity: "error", code: "map.duplicate_neighbor", message: `Duplicate neighbor ${duplicateNeighbor}.`, districtId: district.id });
    }
    if (district.neighborIds.includes(district.id)) {
      issues.push({ severity: "error", code: "map.self_neighbor", message: "District cannot be its own neighbor.", districtId: district.id });
    }
    if (district.neighborIds.length === 0) {
      issues.push({ severity: "error", code: "map.isolated_district", message: "District has no neighbors.", districtId: district.id });
    } else if (district.neighborIds.length === 1) {
      issues.push({ severity: "warning", code: "map.low_neighbor_count", message: "District has only 1 neighbor.", districtId: district.id });
    }
    if (district.isSpawnCandidate) {
      if (district.isDowntown || district.zone === "downtown") {
        issues.push({ severity: "error", code: "map.spawn_is_downtown", message: "Downtown district cannot be a spawn candidate.", districtId: district.id });
      }
      if (!district.spawnZones?.length) {
        issues.push({ severity: "error", code: "map.spawn_missing_zone", message: "Spawn candidate must declare at least one spawn zone.", districtId: district.id });
      }
    }
    for (const spawnZone of district.spawnZones ?? []) {
      if (!validSpawnZones.has(spawnZone)) {
        issues.push({ severity: "error", code: "map.invalid_spawn_zone", message: `Invalid spawn zone ${spawnZone}.`, districtId: district.id });
      }
    }
  }

  for (const district of manifest.districts) {
    for (const neighborId of district.neighborIds) {
      const neighbor = districtsById.get(neighborId);
      if (!neighbor) {
        issues.push({ severity: "error", code: "map.missing_neighbor", message: `Neighbor ${neighborId} does not exist.`, districtId: district.id });
      } else if (!neighbor.neighborIds.includes(district.id)) {
        issues.push({ severity: "error", code: "map.asymmetric_neighbor", message: `Neighbor ${neighborId} does not link back.`, districtId: district.id });
      }
    }
  }

  const downtownCount = manifest.districts.filter((district) => district.isDowntown || district.zone === "downtown").length;
  if (downtownCount !== expectedDowntownCount) {
    issues.push({
      severity: "error",
      code: "map.invalid_downtown_count",
      message: `Map must contain ${expectedDowntownCount} Downtown districts, got ${downtownCount}.`
    });
  }

  if (manifest.districts.filter((district) => district.isSpawnCandidate).length === 0) {
    issues.push({ severity: "error", code: "map.no_spawn_candidates", message: "Map must contain spawn candidates." });
  }

  if (!isConnected(manifest)) {
    issues.push({ severity: "error", code: "map.disconnected", message: "Map graph must be connected." });
  }

  return issues;
};

const findDuplicates = (values: string[]): string[] => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
};

const isConnected = (manifest: EmpireCityMapManifest): boolean => {
  const first = manifest.districts[0]?.id;
  if (!first) return true;
  return traverse(manifest, first).size === manifest.districts.length;
};

const traverse = (manifest: EmpireCityMapManifest, startId: string): Set<string> => {
  const districtsById = new Map(manifest.districts.map((district) => [district.id, district]));
  const visited = new Set<string>();
  const queue = [startId];
  while (queue.length > 0) {
    const districtId = queue.shift()!;
    if (visited.has(districtId)) continue;
    visited.add(districtId);
    for (const neighborId of districtsById.get(districtId)?.neighborIds ?? []) {
      if (!visited.has(neighborId)) queue.push(neighborId);
    }
  }
  return visited;
};
