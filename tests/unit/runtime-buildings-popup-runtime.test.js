import { describe, expect, it, vi } from "vitest";
import { createDistrictBuildingProfileRuntime } from "../../page-assets/js/app/runtime/districtBuildingProfileRuntime.js";
import { createBuildingsPopupRuntime } from "../../page-assets/js/app/runtime/buildingsPopupRuntime.js";
import { DISTRICT_BUILDING_BACKGROUND_IMAGES_BY_BASE_NAME } from "../../page-assets/js/app/runtime/buildingBackgroundData.js";
import { DISTRICT_BUILDING_VARIANT_NAMES_BY_BASE_NAME } from "../../page-assets/js/app/runtime/buildingDisplayData.js";
import { clamp, hashCell } from "../../page-assets/js/app/runtime/utils.js";
import {
  DISTRICT_TYPE_GRID,
  remapDistrictId,
  remapDistrictType
} from "../../page-assets/js/app/map/mapGeometry.js";
import {
  DISTRICT_BUILDING_PACKAGE_POOLS,
  DOWNTOWN_FIXED_BUILDING_PACKAGES_BY_DISTRICT_ID
} from "../../page-assets/js/data/districtPools.js";
import {
  DISTRICT_BUILDING_TYPE_META,
  DISTRICT_BUILDING_TYPE_ORDER
} from "../../page-assets/js/data/buildings.js";

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

function createGeneratedMapProfileRuntime() {
  return createDistrictBuildingProfileRuntime({
    clamp,
    currentPlayerId: 1,
    defaultDistrictType: "resident",
    districtBuildingPackagePools: DISTRICT_BUILDING_PACKAGE_POOLS,
    districtBuildingTypeMeta: DISTRICT_BUILDING_TYPE_META,
    districtTypeGrid: DISTRICT_TYPE_GRID,
    downtownDistrictType: "downtown",
    downtownFixedPackagesByDistrictId: DOWNTOWN_FIXED_BUILDING_PACKAGES_BY_DISTRICT_ID,
    getCurrentPlayerOwnedDistrictIds: () => new Set(),
    getEffectiveOwnedDistrictIds: () => new Set(),
    getResolvedSpyIntel: () => ({ revealedTypeDistrictIds: [] }),
    hashCell,
    remapDistrictId,
    remapDistrictType,
    startPhaseOwnerByDistrictId: new Map(),
    variantNamesByBaseName: DISTRICT_BUILDING_VARIANT_NAMES_BY_BASE_NAME,
    backgroundImagesByBaseName: DISTRICT_BUILDING_BACKGROUND_IMAGES_BY_BASE_NAME
  });
}

function groupEntriesByBaseName(entries = []) {
  return entries.reduce((counts, entry) => {
    counts.set(entry.baseName, (counts.get(entry.baseName) || 0) + 1);
    return counts;
  }, new Map());
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

  it("unlocks every non-destroyed building entry for the live demo catalog", () => {
    const { runtime, renderBuildingsPopupTypesPanel, renderBuildingsPopupDetailPanel } = createRuntime({
      getCurrentPlayerOwnedDistrictIds: () => new Set([1]),
      getInteractionState: () => ({ gamePhase: "live", destroyedDistrictIds: new Set() }),
      getMinimumOwnedBuildingCountByBaseName: () => 2,
      isDemoLiveBuildingCatalogUnlocked: () => true
    });

    expect(runtime.getSourceDistrictsForBuildingType("resident").map((district) => district.id)).toEqual([1, 3]);
    expect(runtime.getSourceDistrictsForBuildingType("industrial").map((district) => district.id)).toEqual([2]);

    runtime.renderBuildingsPopup("industrial");

    expect(renderBuildingsPopupTypesPanel).toHaveBeenLastCalledWith(undefined, expect.objectContaining({
      types: expect.arrayContaining([
        expect.objectContaining({
          typeKey: "industrial",
          disabled: false,
          districtCount: 1,
          ownedDistrictCount: 0,
          meta: "(1)"
        })
      ])
    }));
    expect(renderBuildingsPopupDetailPanel).toHaveBeenLastCalledWith(undefined, expect.objectContaining({
      copy: "Zobrazuje všechny budovy na mapě.",
      baseTypes: [
        expect.objectContaining({
          baseName: "Skladiště",
          count: 1
        })
      ],
      entries: [
        expect.objectContaining({
          districtId: 2,
          isOwnedByCurrentPlayer: false,
          canOpenFromBuildingsPopup: true
        })
      ]
    }));
  });

  it("keeps building type counts aligned with selectable building entries", () => {
    const { runtime, renderBuildingsPopupDetailPanel } = createRuntime({
      getCurrentPlayerOwnedDistrictIds: () => new Set([1]),
      getInteractionState: () => ({ gamePhase: "live", destroyedDistrictIds: new Set() }),
      getMinimumOwnedBuildingCountByBaseName: () => 30,
      isDemoLiveBuildingCatalogUnlocked: () => true,
      resolveDistrictBuildingProfile: (district) => ({
        buildings: [{ baseName: "Bytový blok", displayName: `Blok ${district.id}` }],
        districtLabel: `District ${district.id}`,
        setTitle: "Sada",
        tier: "early",
        typeKey: district.districtType
      })
    });

    runtime.renderBuildingsPopup("resident");

    expect(renderBuildingsPopupDetailPanel).toHaveBeenLastCalledWith(undefined, expect.objectContaining({
      baseTypes: [
        expect.objectContaining({
          baseName: "Bytový blok",
          count: 2
        })
      ],
      entries: [
        expect.objectContaining({ displayName: "Blok 1" }),
        expect.objectContaining({ displayName: "Blok 3" })
      ]
    }));
  });

  it("keeps every generated-map building type count aligned with selectable entries", () => {
    const profileRuntime = createGeneratedMapProfileRuntime();
    const catalog = profileRuntime.getDistrictResourceCatalog();
    const { runtime, renderBuildingsPopupDetailPanel } = createRuntime({
      districtBuildingTypeMeta: DISTRICT_BUILDING_TYPE_META,
      districtBuildingTypeOrder: DISTRICT_BUILDING_TYPE_ORDER,
      getCurrentPlayerOwnedDistrictIds: () => new Set(),
      getGeometry: () => ({ districts: catalog }),
      getInteractionState: () => ({ gamePhase: "live", destroyedDistrictIds: new Set() }),
      isDemoLiveBuildingCatalogUnlocked: () => true,
      resolveDistrictBuildingProfile: (district) => profileRuntime.resolveDistrictBuildingProfile(district)
    });

    for (const typeKey of DISTRICT_BUILDING_TYPE_ORDER) {
      const entries = runtime.getBuildingEntriesForDistrictType(typeKey);
      const expectedCounts = groupEntriesByBaseName(entries);
      runtime.renderBuildingsPopup(typeKey);
      let view = renderBuildingsPopupDetailPanel.mock.calls.at(-1)?.[1] || {};
      expect(Object.fromEntries((view.baseTypes || []).map((item) => [item.baseName, item.count]))).toEqual(Object.fromEntries(expectedCounts));

      for (const [baseName, count] of expectedCounts) {
        runtime.selectBuildingsPopupBaseName(typeKey, baseName);
        runtime.renderBuildingsPopupDetail(typeKey);
        view = renderBuildingsPopupDetailPanel.mock.calls.at(-1)?.[1] || {};
        expect(view.activeBaseName).toBe(baseName);
        expect(view.entries).toHaveLength(count);
      }
    }
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

  it("marks the clinic base cell when stabilization protocol can run", () => {
    const isClinicStabilizationReady = vi.fn(({ district }) => Number(district.id) === 1);
    const { runtime, renderBuildingsPopupDetailPanel } = createRuntime({
      isClinicStabilizationReady,
      resolveDistrictBuildingProfile: (district) => ({
        buildings: [{ baseName: "Klinika", displayName: `Klinika ${district.id}` }],
        districtLabel: `District ${district.id}`,
        setTitle: "Sada",
        tier: "early",
        typeKey: district.districtType
      })
    });

    runtime.renderBuildingsPopup("resident");

    expect(isClinicStabilizationReady).toHaveBeenCalled();
    expect(renderBuildingsPopupDetailPanel).toHaveBeenLastCalledWith(undefined, expect.objectContaining({
      baseTypes: [
        expect.objectContaining({
          baseName: "Klinika",
          count: 1,
          clinicStabilizationReady: true
        })
      ],
      entries: [
        expect.objectContaining({
          displayName: "Klinika 1",
          clinicStabilizationReady: true
        })
      ]
    }));
  });

  it("marks the school base cell as full when any school is full", () => {
    const isSchoolFull = vi.fn(({ district }) => Number(district.id) === 1);
    const { runtime, renderBuildingsPopupDetailPanel, renderBuildingsPopupTypesPanel } = createRuntime({
      isSchoolFull,
      resolveDistrictBuildingProfile: (district) => ({
        buildings: [{ baseName: "Škola", displayName: `Škola ${district.id}` }],
        districtLabel: `District ${district.id}`,
        setTitle: "Sada",
        tier: "early",
        typeKey: district.districtType
      })
    });

    runtime.renderBuildingsPopup("resident");

    expect(isSchoolFull).toHaveBeenCalled();
    expect(renderBuildingsPopupTypesPanel).toHaveBeenLastCalledWith(undefined, expect.objectContaining({
      types: expect.arrayContaining([
        expect.objectContaining({
          typeKey: "resident",
          hasPulsingBuilding: true
        })
      ])
    }));
    expect(renderBuildingsPopupDetailPanel).toHaveBeenLastCalledWith(undefined, expect.objectContaining({
      baseTypes: [
        expect.objectContaining({
          baseName: "Škola",
          count: 1,
          schoolIsFull: true
        })
      ],
      entries: [
        expect.objectContaining({
          displayName: "Škola 1",
          schoolIsFull: true
        })
      ]
    }));
  });
});
