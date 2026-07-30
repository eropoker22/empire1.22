import { describe, expect, it } from "vitest";
import {
  empireStreetsCityMapManifest,
  getBuildingTypesForLegacyNames,
  resolveDistrictBuildingSet
} from "@empire/game-config";
import {
  DISTRICT_BUILDING_PACKAGE_POOLS,
  DISTRICT_FIXED_BUILDING_PACKAGES_BY_DISTRICT_ID,
  DOWNTOWN_FIXED_BUILDING_PACKAGES_BY_DISTRICT_ID
} from "../../page-assets/js/data/districtPools.js";
import { hashCell } from "../../page-assets/js/app/runtime/utils.js";

const localZoneByServerZone = Object.freeze({
  commercial: "economy",
  industrial: "industrial",
  residential: "resident",
  park: "park",
  downtown: "downtown"
});

const resolveLocalTier = ({ rowIndex, columnIndex, zone }) => {
  const rowDistance = Math.abs(rowIndex - 3) / 3;
  const columnDistance = Math.abs(columnIndex - 11) / 11;
  const coreWeight = Math.min(1, Math.max(0, 1 - (rowDistance * 0.55 + columnDistance * 0.45)));
  if (zone === "downtown") {
    if (coreWeight >= 0.86) return "core";
    if (coreWeight >= 0.7) return "high";
    return "mid";
  }
  if (zone === "resident") {
    if (coreWeight >= 0.7) return "late";
    if (coreWeight >= 0.42) return "mid";
    return "early";
  }
  if (coreWeight >= 0.72) return "top";
  if (coreWeight >= 0.42) return "mid";
  return "early";
};

const resolveLocalBuildingNames = (district) => {
  const districtId = Number(String(district.id).match(/\d+/u)?.[0] || 0);
  const remappedDistrictId = new Map([
    [57, 104],
    [104, 57],
    [58, 103],
    [103, 58],
    [59, 105],
    [105, 59],
    [83, 102],
    [102, 83]
  ]).get(districtId) ?? districtId;
  const zone = localZoneByServerZone[district.zone] || "resident";
  const fixed = DISTRICT_FIXED_BUILDING_PACKAGES_BY_DISTRICT_ID[districtId]
    || DISTRICT_FIXED_BUILDING_PACKAGES_BY_DISTRICT_ID[remappedDistrictId]
    || (zone === "downtown"
      ? DOWNTOWN_FIXED_BUILDING_PACKAGES_BY_DISTRICT_ID[districtId]
        || DOWNTOWN_FIXED_BUILDING_PACKAGES_BY_DISTRICT_ID[remappedDistrictId]
      : null);
  if (fixed) return fixed.buildings;
  const tier = resolveLocalTier({
    rowIndex: district.rowIndex,
    columnIndex: district.columnIndex,
    zone
  });
  const pool = DISTRICT_BUILDING_PACKAGE_POOLS[zone][tier];
  const seed = hashCell(district.rowIndex + districtId, district.columnIndex + districtId);
  return pool[seed % pool.length].buildings;
};

describe("server/demo district building parity", () => {
  it("uses the exact demo building package for all canonical districts", () => {
    for (const district of empireStreetsCityMapManifest.districts) {
      const expected = getBuildingTypesForLegacyNames(resolveLocalBuildingNames(district));
      const actual = resolveDistrictBuildingSet({
        districtId: district.id,
        zone: district.zone
      })?.buildingTypes;
      expect(actual, district.id).toEqual(expected);
    }
  });
});
