import { createEmpireCityMapHash } from "./empire-city-map-hash";
import type { EmpireCityMapManifest } from "./empire-city-map-types";

export interface EmpireCityMapDebugReport {
  manifestId: string;
  manifestVersion: number;
  manifestHash: string;
  districtCount: number;
  downtownCount: number;
  spawnCandidateCount: number;
  articulationPoints: string[];
  bridgeEdges: Array<[string, string]>;
  chokepointDistricts: string[];
  distanceToNearestDowntown: Record<string, number | null>;
  spawnCandidateNeighborCount: Record<string, number>;
  spawnCandidateRouteToCenter: Record<string, string[]>;
}

export const createEmpireCityMapDebugReport = (
  manifest: EmpireCityMapManifest
): EmpireCityMapDebugReport => {
  const downtownIds = new Set(manifest.districts.filter((district) => district.isDowntown || district.zone === "downtown").map((district) => district.id));
  const articulationPoints = findArticulationPoints(manifest);
  const bridgeEdges = findBridgeEdges(manifest);
  const distanceToNearestDowntown = Object.fromEntries(
    manifest.districts.map((district) => [district.id, findDistanceToAny(manifest, district.id, downtownIds)])
  );
  const spawnCandidates = manifest.districts.filter((district) => district.isSpawnCandidate);

  return {
    manifestId: manifest.id,
    manifestVersion: manifest.version,
    manifestHash: createEmpireCityMapHash(manifest),
    districtCount: manifest.districts.length,
    downtownCount: downtownIds.size,
    spawnCandidateCount: spawnCandidates.length,
    articulationPoints,
    bridgeEdges,
    chokepointDistricts: articulationPoints,
    distanceToNearestDowntown,
    spawnCandidateNeighborCount: Object.fromEntries(spawnCandidates.map((district) => [district.id, district.neighborIds.length])),
    spawnCandidateRouteToCenter: Object.fromEntries(spawnCandidates.map((district) => [district.id, findRouteToAny(manifest, district.id, downtownIds)]))
  };
};

const findDistanceToAny = (
  manifest: EmpireCityMapManifest,
  startId: string,
  targetIds: Set<string>
): number | null => {
  const route = findRouteToAny(manifest, startId, targetIds);
  return route.length > 0 ? route.length - 1 : null;
};

const findRouteToAny = (
  manifest: EmpireCityMapManifest,
  startId: string,
  targetIds: Set<string>
): string[] => {
  const districtsById = new Map(manifest.districts.map((district) => [district.id, district]));
  const queue = [startId];
  const previous = new Map<string, string | null>([[startId, null]]);

  while (queue.length > 0) {
    const districtId = queue.shift()!;
    if (targetIds.has(districtId)) return buildRoute(previous, districtId);
    for (const neighborId of districtsById.get(districtId)?.neighborIds ?? []) {
      if (!previous.has(neighborId)) {
        previous.set(neighborId, districtId);
        queue.push(neighborId);
      }
    }
  }

  return [];
};

const buildRoute = (previous: Map<string, string | null>, endId: string): string[] => {
  const route: string[] = [];
  let cursor: string | null = endId;
  while (cursor) {
    route.push(cursor);
    cursor = previous.get(cursor) ?? null;
  }
  return route.reverse();
};

const findArticulationPoints = (manifest: EmpireCityMapManifest): string[] =>
  manifest.districts
    .filter((district) => {
      const remaining = manifest.districts
        .filter((candidate) => candidate.id !== district.id)
        .map((candidate) => ({
          ...candidate,
          neighborIds: candidate.neighborIds.filter((neighborId) => neighborId !== district.id)
        }));
      return remaining.length > 0 && !isConnected({ ...manifest, districts: remaining });
    })
    .map((district) => district.id);

const findBridgeEdges = (manifest: EmpireCityMapManifest): Array<[string, string]> =>
  getEdges(manifest).filter((edge) => {
    const [left, right] = edge;
    const districts = manifest.districts.map((district) => ({
      ...district,
      neighborIds: district.neighborIds.filter((neighborId) =>
        !(district.id === left && neighborId === right) &&
        !(district.id === right && neighborId === left)
      )
    }));
    return !isConnected({ ...manifest, districts });
  });

const getEdges = (manifest: EmpireCityMapManifest): Array<[string, string]> =>
  [...new Set(manifest.districts.flatMap((district) =>
    district.neighborIds.map((neighborId) => [district.id, neighborId].sort().join("|"))
  ))].map((edge) => edge.split("|") as [string, string]);

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
