import { describe, expect, it } from "vitest";
import { empireStreetsCityMapManifest } from "@empire/game-config";
import { createInitialState } from "@empire/game-core";
import {
  ensureSharedCityMap,
  sharedCitySpawnPool
} from "../../apps/server/src/bootstrap/gameplay-slice-shared-city-seed";

describe("shared city map seed", () => {
  it("seeds server districts directly from the canonical map manifest", () => {
    const state = createInitialState("instance:test", "free");

    ensureSharedCityMap(state, "instance:test", {
      buildSlotLimit: 4,
      productionBuildings: {}
    });

    expect(state.root.districtIds).toEqual(empireStreetsCityMapManifest.districts.map((district) => district.id));
    for (const manifestDistrict of empireStreetsCityMapManifest.districts) {
      const serverDistrict = state.districtsById[manifestDistrict.id];
      expect(serverDistrict).toBeDefined();
      expect(serverDistrict.name).toBe(manifestDistrict.name);
      expect(serverDistrict.zone).toBe(manifestDistrict.zone);
      expect(serverDistrict.adjacentDistrictIds).toEqual(manifestDistrict.neighborIds);
      expect(serverDistrict.ownerPlayerId).toBeNull();
      expect(serverDistrict.status).toBe("neutral");
      expect(serverDistrict.buildingIds.length).toBeGreaterThan(0);
    }
  });

  it("derives spawn pool from manifest spawn candidates", () => {
    const manifestSpawnCandidates = empireStreetsCityMapManifest.districts
      .filter((district) => district.isSpawnCandidate)
      .map((district) => ({
        districtId: district.id,
        zones: district.spawnZones
      }));

    expect(sharedCitySpawnPool.map((candidate) => ({
      districtId: candidate.districtId,
      zones: candidate.zones
    }))).toEqual(manifestSpawnCandidates);
    expect(sharedCitySpawnPool.some((candidate) =>
      empireStreetsCityMapManifest.districts.find((district) => district.id === candidate.districtId)?.isDowntown
    )).toBe(false);
  });
});
