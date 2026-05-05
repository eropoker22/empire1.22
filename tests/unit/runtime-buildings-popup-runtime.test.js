import { describe, expect, it, vi } from "vitest";
import { createBuildingsPopupRuntime } from "../../page-assets/js/app/runtime/buildingsPopupRuntime.js";

function createRuntime(overrides = {}) {
  const renderDistrictBuildingList = vi.fn();
  const renderBuildingsPopupDetailPanel = vi.fn();
  const renderBuildingsPopupTypesPanel = vi.fn();

  return {
    renderDistrictBuildingList,
    renderBuildingsPopupDetailPanel,
    renderBuildingsPopupTypesPanel,
    runtime: createBuildingsPopupRuntime({
      districtBuildingTypeMeta: {
        resident: { label: "Residential", shortLabel: "RES" },
        industrial: { label: "Industrial", shortLabel: "IND" }
      },
      districtBuildingTypeOrder: ["resident", "industrial"],
      formatDistrictBuildingTierLabel: (tier) => `Tier ${tier}`,
      getCurrentPlayerOwnedDistrictIds: () => new Set([1, 2]),
      getDistrictTrapControlState: () => ({ buildingVisible: true, buildingLabel: "Toxická past", buildingMeta: "aktivní" }),
      getGeometry: () => ({
        districts: [
          { id: 1, districtType: "resident" },
          { id: 2, districtType: "industrial" },
          { id: 3, districtType: "resident" }
        ]
      }),
      getInteractionState: () => ({ gamePhase: "launch", destroyedDistrictIds: new Set() }),
      isDistrictTypeHidden: () => false,
      renderBuildingsPopupDetailPanel,
      renderBuildingsPopupTypesPanel,
      renderDistrictBuildingList,
      resolveDistrictBuildingProfile: (district) => ({
        buildings: [{ baseName: "Sklad", displayName: `Sklad ${district.id}` }],
        districtLabel: `District ${district.id}`,
        setTitle: "Sada",
        tier: "early",
        typeKey: district.districtType
      }),
      elements: {},
      ...overrides
    })
  };
}

describe("buildings popup runtime", () => {
  it("builds source districts and renders popup view models", () => {
    const { runtime, renderBuildingsPopupTypesPanel, renderBuildingsPopupDetailPanel, renderDistrictBuildingList } = createRuntime();

    expect(runtime.getSourceDistrictsForBuildingType("resident").map((district) => district.id)).toEqual([1]);
    expect(runtime.getFirstAvailableBuildingDistrictType()).toBe("resident");

    runtime.renderBuildingsPopup("resident");
    expect(renderBuildingsPopupTypesPanel).toHaveBeenCalledWith(undefined, expect.objectContaining({
      types: expect.arrayContaining([expect.objectContaining({ typeKey: "resident", active: true })])
    }));
    expect(renderBuildingsPopupDetailPanel).toHaveBeenCalledWith(undefined, expect.objectContaining({
      selectedType: "resident",
      activeBaseName: "Sklad"
    }));

    runtime.renderDistrictPopupBuildings({ id: 1, districtType: "resident" });
    expect(renderDistrictBuildingList).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({
      metaText: "Sada · Tier early",
      trap: expect.objectContaining({ visible: true })
    }));
  });

  it("handles missing geometry and empty state safely", () => {
    const { runtime, renderBuildingsPopupDetailPanel } = createRuntime({
      getGeometry: () => null
    });

    expect(runtime.getSourceDistrictsForBuildingType("resident")).toEqual([]);
    runtime.renderBuildingsPopup("industrial");
    expect(renderBuildingsPopupDetailPanel).toHaveBeenCalledWith(undefined, expect.objectContaining({
      emptyText: "Zaber nebo kup district tohoto typu a tady se objeví jeho budovy."
    }));
  });
});
