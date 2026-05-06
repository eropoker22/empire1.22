import { describe, expect, it } from "vitest";
import {
  MAP_DISTRICT_GEOMETRY_TOP_INSET
} from "../../page-assets/js/app/map/mapConstants.js";
import {
  DISTRICT_TYPE_GRID,
  classifyDistrictType,
  createDistrictGeometry,
  createDistrictTypeGrid,
  createLaunchOwnerMap,
  createOrganicDistrictPolygon,
  getAdjacentDistrictIdsFromGeometry,
  getDistrictAtPoint,
  isDowntownCell,
  isPointInDistrict,
  remapDistrictId,
  remapDistrictType
} from "../../page-assets/js/app/map/mapGeometry.js";

function getPointKey(point) {
  return `${Number(point?.x ?? 0).toFixed(3)}:${Number(point?.y ?? 0).toFixed(3)}`;
}

function countSharedPolygonPoints(leftDistrict, rightDistrict) {
  const leftKeys = new Set((leftDistrict?.polygon || []).map(getPointKey));
  return new Set((rightDistrict?.polygon || []).map(getPointKey).filter((key) => leftKeys.has(key))).size;
}

describe("map geometry adapter", () => {
  it("keeps the launch district grid stable", () => {
    expect(DISTRICT_TYPE_GRID).toHaveLength(7);
    expect(DISTRICT_TYPE_GRID[0]).toHaveLength(23);
    expect(isDowntownCell(3, 9)).toBe(true);
    expect(classifyDistrictType(3, 9)).toBe("downtown");
    expect(classifyDistrictType(99, 99)).toBe("resident");

    const grid = createDistrictTypeGrid(7, 23);
    expect(grid[3][9]).toBe("downtown");
  });

  it("preserves remapped district ids and type lookup", () => {
    const typeByDistrictId = new Map([
      [57, "resident"],
      [104, "downtown"]
    ]);

    expect(remapDistrictId(57)).toBe(104);
    expect(remapDistrictId(104)).toBe(57);
    expect(remapDistrictId(12)).toBe(12);
    expect(remapDistrictType(57, typeByDistrictId)).toBe("downtown");
  });

  it("creates launch owner maps from injected coordinates", () => {
    const owners = createLaunchOwnerMap([
      [0, 0],
      [2, 10]
    ]);

    expect(owners.get(1)).toBe(1);
    expect(owners.get(104)).toBe(2);
  });

  it("creates stable district geometry and hit tests points", () => {
    const geometry = createDistrictGeometry(1600, 980);
    const district = geometry.districts[0];

    expect(geometry.districts).toHaveLength(161);
    expect(district.polygon.length).toBeGreaterThan(12);
    expect(district.polygon[0]).toEqual(district.polygon[district.polygon.length - 1]);
    expect(Math.min(...geometry.districts.flatMap((candidate) => candidate.polygon.map((point) => point.y)))).toBeGreaterThanOrEqual(MAP_DISTRICT_GEOMETRY_TOP_INSET);
    expect(getDistrictAtPoint(geometry, { x: 800, y: MAP_DISTRICT_GEOMETRY_TOP_INSET / 2 })).toBeNull();
    expect(isPointInDistrict({ x: district.centerX, y: district.centerY }, district)).toBe(true);
    expect(getDistrictAtPoint(geometry, { x: district.centerX, y: district.centerY })?.id).toBe(district.id);
    expect(getDistrictAtPoint(null, { x: district.centerX, y: district.centerY })).toBeNull();
  });

  it("creates deterministic organic district polygons with a safe fallback", () => {
    const square = [
      { x: 10, y: 10 },
      { x: 110, y: 10 },
      { x: 110, y: 90 },
      { x: 10, y: 90 }
    ];
    const config = {
      organicEdges: true,
      edgeSegments: 5,
      jitterAmount: 8,
      cornerJitter: 3,
      smoothPasses: 1,
      seed: "test-map",
      bounds: { minX: 0, minY: 0, maxX: 120, maxY: 100 },
      requiredPoint: { x: 60, y: 50 }
    };

    const first = createOrganicDistrictPolygon(square, 7, config);
    const second = createOrganicDistrictPolygon(square, 7, config);
    const fallback = createOrganicDistrictPolygon(square, 7, {
      ...config,
      jitterAmount: 80,
      cornerJitter: 80,
      requiredPoint: { x: -999, y: -999 }
    });

    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThan(square.length);
    expect(first[0]).toEqual(first[first.length - 1]);
    expect(first).not.toEqual([...square, square[0]]);
    expect(fallback).toEqual([...square, square[0]]);
  });

  it("uses the same organic boundary polyline for neighboring districts", () => {
    const geometry = createDistrictGeometry(1600, 980);
    const district = geometry.districts.find((candidate) => candidate.rowIndex === 2 && candidate.columnIndex === 2);
    const rightNeighbor = geometry.districts.find((candidate) => candidate.rowIndex === 2 && candidate.columnIndex === 3);

    expect(district).toBeTruthy();
    expect(rightNeighbor).toBeTruthy();
    expect(countSharedPolygonPoints(district, rightNeighbor)).toBeGreaterThanOrEqual(5);
    expect(getDistrictAtPoint(geometry, { x: district.centerX, y: district.centerY })?.id).toBe(district.id);
    expect(getDistrictAtPoint(geometry, { x: rightNeighbor.centerX, y: rightNeighbor.centerY })?.id).toBe(rightNeighbor.id);
  });

  it("returns orthogonal adjacent districts without mutating geometry", () => {
    const geometry = createDistrictGeometry(1600, 980);
    const district = geometry.districts.find((candidate) => candidate.rowIndex === 2 && candidate.columnIndex === 2);
    const adjacent = getAdjacentDistrictIdsFromGeometry(geometry, district.id);

    expect(adjacent.length).toBeGreaterThan(0);
    expect(adjacent).not.toContain(district.id);
    expect(getAdjacentDistrictIdsFromGeometry(null, district.id)).toEqual([]);
  });
});
