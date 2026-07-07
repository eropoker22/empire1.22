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
      getDistrictTrapControlState: () => ({ buildingVisible: true, buildingLabel: "Toxická past", buildingMeta: "59:59" }),
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
        buildings: [{ baseName: "Skladiště", displayName: `Skladiště ${district.id}` }],
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
      activeBaseName: "Skladiště"
    }));

    runtime.renderDistrictPopupBuildings({ id: 1, districtType: "resident" });
    expect(renderDistrictBuildingList).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({
      metaText: "",
      interactive: true,
      buildings: [
        expect.objectContaining({
          name: "Skladiště",
          label: "Skladiště",
          displayName: "Skladiště 1"
        })
      ],
      trap: expect.objectContaining({ visible: true, meta: "59:59" })
    }));
  });

  it("renders discovered buildings in foreign districts as non-interactive", () => {
    const { runtime, renderDistrictBuildingList } = createRuntime({
      getCurrentPlayerOwnedDistrictIds: () => new Set([1]),
      getResolvedSpyIntel: () => ({ revealedTypeDistrictIds: [3] })
    });

    runtime.renderDistrictPopupBuildings({ id: 3, districtType: "resident" });

    expect(renderDistrictBuildingList).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({
      metaText: "",
      interactive: false,
      buildings: [
        expect.objectContaining({
          name: "Skladiště",
          displayName: "Skladiště 3"
        })
      ]
    }));
  });

  it("locks foreign district buildings until spy reveals the district type", () => {
    const { runtime, renderDistrictBuildingList } = createRuntime({
      getCurrentPlayerOwnedDistrictIds: () => new Set([1]),
      getResolvedSpyIntel: () => ({ revealedTypeDistrictIds: [] })
    });

    runtime.renderDistrictPopupBuildings({ id: 3, districtType: "resident" });

    expect(renderDistrictBuildingList).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({
      metaText: "Nezjištěno",
      emptyText: "Bez spy nebo vlastnictví zatím nevíš, jaké budovy jsou v tomto distriktu."
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

  it("labels passive and production building chips distinctly", () => {
    const { runtime, renderDistrictBuildingList } = createRuntime({
      resolveDistrictBuildingProfile: () => ({
        buildings: [
          { baseName: "Autosalon", displayName: "Neon Cars" },
          { baseName: "Lékárna", displayName: "Noční Lékárna" }
        ],
        districtLabel: "District 1",
        setTitle: "Sada",
        tier: "early",
        typeKey: "resident"
      })
    });

    runtime.renderDistrictPopupBuildings({ id: 1, districtType: "resident" });

    expect(renderDistrictBuildingList).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({
      buildings: [
        expect.objectContaining({ name: "Autosalon", kindLabel: "Pasivní bonus" }),
        expect.objectContaining({ name: "Lékárna", kindLabel: "Výroba" })
      ]
    }));
  });

  it("keeps live-mode building district entries scoped to current player ownership", () => {
    const { runtime, renderBuildingsPopupDetailPanel } = createRuntime({
      getCurrentPlayerOwnedDistrictIds: () => new Set([1]),
      getInteractionState: () => ({ gamePhase: "live", destroyedDistrictIds: new Set() })
    });

    runtime.renderBuildingsPopup("resident");

    expect(renderBuildingsPopupDetailPanel).toHaveBeenLastCalledWith(undefined, expect.objectContaining({
      entries: [
        expect.objectContaining({
          districtId: 1,
          isOwnedByCurrentPlayer: true
        })
      ]
    }));
  });

  it("disables building zone tabs when the player owns no district in that zone", () => {
    const { runtime, renderBuildingsPopupTypesPanel } = createRuntime({
      getCurrentPlayerOwnedDistrictIds: () => new Set([1])
    });

    runtime.renderBuildingsPopup("resident");

    expect(renderBuildingsPopupTypesPanel).toHaveBeenLastCalledWith(undefined, expect.objectContaining({
      types: expect.arrayContaining([
        expect.objectContaining({
          typeKey: "resident",
          disabled: false,
          ownedDistrictCount: 1
        }),
        expect.objectContaining({
          typeKey: "industrial",
          disabled: true,
          ownedDistrictCount: 0,
          meta: ""
        })
      ])
    }));
  });

  it("keeps building zone tabs locked in live when the player owns no district in that zone", () => {
    const { runtime, renderBuildingsPopupTypesPanel } = createRuntime({
      getCurrentPlayerOwnedDistrictIds: () => new Set([1]),
      getInteractionState: () => ({ gamePhase: "live", destroyedDistrictIds: new Set() })
    });

    runtime.renderBuildingsPopup("resident");

    expect(renderBuildingsPopupTypesPanel).toHaveBeenLastCalledWith(undefined, expect.objectContaining({
      types: expect.arrayContaining([
        expect.objectContaining({
          typeKey: "resident",
          disabled: false,
          ownedDistrictCount: 1,
          meta: "(1)"
        }),
        expect.objectContaining({
          typeKey: "industrial",
          disabled: true,
          ownedDistrictCount: 0,
          meta: ""
        })
      ])
    }));
  });

  it("marks the apartment block base cell as full when any apartment block is full", () => {
    const isApartmentBlockFull = vi.fn(({ district }) => Number(district.id) === 1);
    const { runtime, renderBuildingsPopupDetailPanel } = createRuntime({
      isApartmentBlockFull,
      resolveDistrictBuildingProfile: (district) => ({
        buildings: [{ baseName: "Bytový blok", displayName: `Blok ${district.id}` }],
        districtLabel: `District ${district.id}`,
        setTitle: "Sada",
        tier: "early",
        typeKey: district.districtType
      })
    });

    runtime.renderBuildingsPopup("resident");

    expect(isApartmentBlockFull).toHaveBeenCalled();
    expect(renderBuildingsPopupDetailPanel).toHaveBeenLastCalledWith(undefined, expect.objectContaining({
      baseTypes: [
        expect.objectContaining({
          baseName: "Bytový blok",
          count: 1,
          apartmentIsFull: true
        })
      ],
      entries: [
        expect.objectContaining({
          displayName: "Blok 1",
          apartmentIsFull: true
        })
      ]
    }));
  });
});
