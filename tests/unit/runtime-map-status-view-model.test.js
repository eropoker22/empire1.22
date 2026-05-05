import { describe, expect, it } from "vitest";
import { buildMapStatusViewModel } from "../../page-assets/js/app/map/mapStatusViewModel.js";

describe("map status view model", () => {
  it("handles partial input without crashing", () => {
    expect(buildMapStatusViewModel()).toEqual({
      districtCount: 0,
      ownedDistrictCount: 0,
      enemyDistrictCount: 0,
      selectedDistrictLabel: "Žádný district",
      activeOverlayLabel: "Ownership",
      message: ""
    });
  });

  it("counts live, owned and enemy districts from read-only inputs", () => {
    const districts = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
    const viewModel = buildMapStatusViewModel({
      districts,
      selectedDistrict: districts[1],
      ownedDistrictIds: new Set([1]),
      destroyedDistrictIds: new Set([4]),
      launchOwnerByDistrictId: new Map([[1, 1], [2, 2], [3, 0], [4, 3]]),
      currentPlayerId: 1,
      overlayState: { activeOverlay: "heatmap" },
      message: "Synced"
    });

    expect(viewModel).toEqual({
      districtCount: 3,
      ownedDistrictCount: 1,
      enemyDistrictCount: 1,
      selectedDistrictLabel: "District 2",
      activeOverlayLabel: "Heatmap",
      message: "Synced"
    });
  });

  it("supports injected display names, overlay labels and enemy predicate", () => {
    const districts = [{ id: 10, name: "Docks" }, { id: 11, name: "Market" }];
    const viewModel = buildMapStatusViewModel({
      districts,
      selectedDistrict: districts[0],
      ownedDistrictIds: [10],
      overlayState: { activeOverlay: "trap" }
    }, {
      getDistrictDisplayName: (district) => district.name,
      overlayLabels: { ownership: "Vlastnictví", trap: "Pasti" },
      isEnemyDistrict: (district) => district.id === 11
    });

    expect(viewModel.selectedDistrictLabel).toBe("Docks");
    expect(viewModel.activeOverlayLabel).toBe("Pasti");
    expect(viewModel.enemyDistrictCount).toBe(1);
  });

  it("does not mutate provided sets or maps", () => {
    const ownedDistrictIds = new Set([1]);
    const destroyedDistrictIds = new Set([3]);
    const launchOwnerByDistrictId = new Map([[2, 2]]);

    buildMapStatusViewModel({
      districts: [{ id: 1 }, { id: 2 }, { id: 3 }],
      ownedDistrictIds,
      destroyedDistrictIds,
      launchOwnerByDistrictId,
      currentPlayerId: 1
    });

    expect(Array.from(ownedDistrictIds)).toEqual([1]);
    expect(Array.from(destroyedDistrictIds)).toEqual([3]);
    expect(Array.from(launchOwnerByDistrictId.entries())).toEqual([[2, 2]]);
  });
});
