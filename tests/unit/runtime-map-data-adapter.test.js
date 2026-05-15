import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createMapDistrictViewModel,
  normalizeMapBuildingList,
  normalizeMapOwner,
  normalizeMapZoneKey,
  resolveMapAtmosphereMeta,
  resolveMapDistrictOwnerLabel,
  resolveMapZoneFillStyle
} from "../../page-assets/js/app/map/mapDataAdapter.js";
import {
  DISTRICT_ATMOSPHERE_META,
  MAP_DEFAULT_OWNER_COLOR,
  MAP_UNOWNED_OWNER_LABEL
} from "../../page-assets/js/app/map/mapConstants.js";

describe("map data adapter", () => {
  it("normalizes a district without owner", () => {
    const viewModel = createMapDistrictViewModel({ id: 7, districtType: "economy" });

    expect(viewModel.id).toBe(7);
    expect(viewModel.title).toBe("District 7");
    expect(viewModel.zoneKey).toBe("economy");
    expect(viewModel.ownerLabel).toBe(MAP_UNOWNED_OWNER_LABEL);
    expect(viewModel.owner.color).toBe(MAP_DEFAULT_OWNER_COLOR);
  });

  it("falls back to resident zone when district zone is missing", () => {
    const viewModel = createMapDistrictViewModel({ id: 8 });

    expect(normalizeMapZoneKey("")).toBe("resident");
    expect(viewModel.zoneKey).toBe("resident");
    expect(viewModel.typeLabel).toBe("Rezidenční");
  });

  it("uses blackout atmosphere for explicit unknown district types", () => {
    const viewModel = createMapDistrictViewModel({ id: 10, districtType: "unknown" });
    const atmosphereMeta = resolveMapAtmosphereMeta("unknown");

    expect(viewModel.zoneKey).toBe("resident");
    expect(viewModel.typeLabel).toBe("Skryto");
    expect(atmosphereMeta.imagePath).toBe("../img/blackout.png");
    expect(existsSync(resolve(process.cwd(), atmosphereMeta.imagePath.replace("../", "")))).toBe(true);
  });

  it("uses blackout atmosphere for hidden districts even when their real type exists", () => {
    const viewModel = createMapDistrictViewModel(
      { id: 11, districtType: "industrial" },
      { hidden: true }
    );
    const atmosphereMeta = resolveMapAtmosphereMeta("industrial", { hidden: true });

    expect(viewModel.zoneKey).toBe("industrial");
    expect(viewModel.typeLabel).toBe("Skryto");
    expect(atmosphereMeta.imagePath).toBe("../img/blackout.png");
  });

  it("normalizes string and object building lists", () => {
    const buildings = normalizeMapBuildingList([
      "Lékárna",
      { baseName: "Autosalon", displayName: "Neon Cars" },
      "",
      null
    ]);

    expect(buildings).toEqual([
      { name: "Lékárna", displayName: "Lékárna" },
      { baseName: "Autosalon", displayName: "Neon Cars", name: "Autosalon" }
    ]);

    const viewModel = createMapDistrictViewModel({ id: 9 }, { buildings });
    expect(viewModel.hasBuildings).toBe(true);
    expect(viewModel.buildings).toHaveLength(2);
  });

  it("uses resident color as zone color fallback", () => {
    expect(resolveMapZoneFillStyle("missing-zone", false)).toBe("rgba(250, 204, 21, 0.2)");
    expect(resolveMapZoneFillStyle("missing-zone", true)).toBe("rgba(250, 204, 21, 0.15)");
  });

  it("uses fallback owner color and resolves owner labels", () => {
    expect(normalizeMapOwner(null).color).toBe(MAP_DEFAULT_OWNER_COLOR);
    expect(resolveMapDistrictOwnerLabel({ id: 3 }, {
      gamePhase: "live",
      ownedDistrictIds: new Set()
    }, { currentPlayerId: 1 })).toBe(MAP_UNOWNED_OWNER_LABEL);
    expect(resolveMapDistrictOwnerLabel({ id: 4 }, {
      gamePhase: "launch",
      launchOwnerByDistrictId: new Map([[4, 2]])
    }, {
      currentPlayerId: 1,
      getLaunchPlayerName: (ownerId) => `Player ${ownerId}`
    })).toBe("Player 2");
  });

  it("assigns existing image pools to every visible district atmosphere type", () => {
    for (const typeKey of ["resident", "industrial", "economy", "park", "downtown"]) {
      const imagePaths = DISTRICT_ATMOSPHERE_META[typeKey].imagePaths;
      expect(imagePaths.length).toBeGreaterThan(1);
      for (const imagePath of imagePaths) {
        expect(existsSync(resolve(process.cwd(), imagePath.replace("../", "")))).toBe(true);
      }
    }
  });
});
