import { describe, expect, it } from "vitest";
import {
  createEmpireCityMapDebugReport,
  empireStreetsCityMapManifest,
  empireStreetsCityMapManifestHash,
  resolveCanonicalDistrictId,
  resolveLegacyDistrictId,
  validateEmpireCityMapManifest
} from "@empire/game-config";
import {
  empireCityMapManifest,
  empireCityMapManifestHash
} from "../../../page-assets/js/data/empire-city-map.generated.js";

describe("Empire Streets city map manifest", () => {
  it("validates the canonical visual map manifest", () => {
    const issues = validateEmpireCityMapManifest(empireStreetsCityMapManifest);

    expect(issues.filter((issue) => issue.severity === "error")).toEqual([]);
    expect(empireStreetsCityMapManifest.districts).toHaveLength(161);
    expect(empireStreetsCityMapManifest.districts.filter((district) => district.isDowntown)).toHaveLength(8);
    expect(empireStreetsCityMapManifest.districts.filter((district) => district.isSpawnCandidate)).toHaveLength(20);
    expect(empireStreetsCityMapManifest.districts.some((district) => district.isDowntown && district.isSpawnCandidate)).toBe(false);
  });

  it("keeps generated browser asset hash identical to canonical manifest hash", () => {
    expect(empireCityMapManifestHash).toBe(empireStreetsCityMapManifestHash);
    expect(empireCityMapManifest.id).toBe(empireStreetsCityMapManifest.id);
    expect(empireCityMapManifest.districts.map((district) => district.id)).toEqual(
      empireStreetsCityMapManifest.districts.map((district) => district.id)
    );
  });

  it("maps legacy numeric IDs to canonical district IDs at the boundary", () => {
    expect(resolveCanonicalDistrictId(1)).toBe("district:1");
    expect(resolveCanonicalDistrictId("1")).toBe("district:1");
    expect(resolveCanonicalDistrictId("district:1")).toBe("district:1");
    expect(resolveLegacyDistrictId("district:1")).toBe(1);
    expect(resolveCanonicalDistrictId("district:connector:1")).toBeNull();
  });

  it("reports graph debug data for balancing and map debugging", () => {
    const report = createEmpireCityMapDebugReport(empireStreetsCityMapManifest);

    expect(report.manifestHash).toBe(empireStreetsCityMapManifestHash);
    expect(report.distanceToNearestDowntown["district:1"]).toEqual(expect.any(Number));
    expect(Object.keys(report.spawnCandidateNeighborCount)).toHaveLength(20);
    expect(Object.keys(report.spawnCandidateRouteToCenter)).toHaveLength(20);
    expect(Array.isArray(report.articulationPoints)).toBe(true);
    expect(Array.isArray(report.bridgeEdges)).toBe(true);
  });

  it("keeps non-neighbor districts without shared edge adjacency", () => {
    const nonNeighbor = findNonNeighborPairWithoutSharedEdge();

    expect(nonNeighbor).toBeTruthy();
    expect(nonNeighbor?.left.neighborIds).not.toContain(nonNeighbor?.right.id);
    expect(nonNeighbor?.right.neighborIds).not.toContain(nonNeighbor?.left.id);
    expect(countSharedSegments(nonNeighbor!.left, nonNeighbor!.right)).toBe(0);
  });
});

const pointKey = (point: { x: number; y: number }, precision = 2): string =>
  `${Number(point.x).toFixed(precision)}:${Number(point.y).toFixed(precision)}`;

const segmentKey = (left: { x: number; y: number }, right: { x: number; y: number }): string => {
  const keys = [pointKey(left), pointKey(right)].sort();
  return `${keys[0]}|${keys[1]}`;
};

const countSharedSegments = (
  left: { polygon: Array<{ x: number; y: number }> },
  right: { polygon: Array<{ x: number; y: number }> }
): number => {
  const leftSegments = new Set<string>();
  for (let index = 0; index < left.polygon.length; index += 1) {
    leftSegments.add(segmentKey(left.polygon[index]!, left.polygon[(index + 1) % left.polygon.length]!));
  }
  return right.polygon.filter((point, index) =>
    leftSegments.has(segmentKey(point, right.polygon[(index + 1) % right.polygon.length]!))
  ).length;
};

const findNonNeighborPairWithoutSharedEdge = () => {
  for (const left of empireStreetsCityMapManifest.districts) {
    for (const right of empireStreetsCityMapManifest.districts) {
      if (left.id < right.id && !left.neighborIds.includes(right.id) && countSharedSegments(left, right) === 0) {
        return { left, right };
      }
    }
  }
  return null;
};
