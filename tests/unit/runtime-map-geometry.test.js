import { describe, expect, it } from "vitest";
import {
  DISTRICT_TYPE_GRID,
  classifyDistrictType,
  createDistrictGeometry,
  createDistrictTypeGrid,
  createLaunchOwnerMap,
  getAdjacentDistrictIdsFromGeometry,
  getDistrictAtPoint,
  isDowntownCell,
  isPointInDistrict,
  remapDistrictId,
  remapDistrictType
} from "../../page-assets/js/app/map/mapGeometry.js";

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
    expect(isPointInDistrict({ x: district.centerX, y: district.centerY }, district)).toBe(true);
    expect(getDistrictAtPoint(geometry, { x: district.centerX, y: district.centerY })?.id).toBe(district.id);
    expect(getDistrictAtPoint(null, { x: district.centerX, y: district.centerY })).toBeNull();
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
