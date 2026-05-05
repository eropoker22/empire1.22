import { describe, expect, it } from "vitest";
import {
  createMapDistrictViewModel,
  normalizeMapBuildingList,
  normalizeMapOwner,
  normalizeMapZoneKey,
  resolveMapDistrictOwnerLabel,
  resolveMapZoneFillStyle
} from "../../page-assets/js/app/map/mapDataAdapter.js";
import {
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
    expect(resolveMapZoneFillStyle("missing-zone", false)).toBe("rgba(103, 225, 255, 0.14)");
    expect(resolveMapZoneFillStyle("missing-zone", true)).toBe("rgba(103, 225, 255, 0.10)");
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
});
