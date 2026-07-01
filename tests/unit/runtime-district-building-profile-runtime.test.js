import { describe, expect, it } from "vitest";
import { createDistrictBuildingProfileRuntime } from "../../page-assets/js/app/runtime/districtBuildingProfileRuntime.js";

function createRuntime(overrides = {}) {
  return createDistrictBuildingProfileRuntime({
    clamp: (value, min, max) => Math.min(Math.max(value, min), max),
    currentPlayerId: 1,
    defaultDistrictType: "resident",
    districtBuildingPackagePools: {
      resident: {
        early: [{ key: "resident-early", tier: "early", title: "Start", buildings: ["Kasino"] }],
        mid: [{ key: "resident-mid", tier: "mid", title: "Mid", buildings: ["Skladiště"] }]
      },
      downtown: {
        core: [{ key: "downtown-core", tier: "core", title: "Core", buildings: ["Mall"] }]
      }
    },
    districtBuildingTypeMeta: {
      resident: { label: "Residential", shortLabel: "RES" },
      downtown: { label: "Downtown", shortLabel: "DWN" }
    },
    districtTypeGrid: [["resident", "downtown"]],
    downtownDistrictType: "downtown",
    downtownFixedPackagesByDistrictId: {},
    getCurrentPlayerOwnedDistrictIds: () => new Set([1]),
    getEffectiveOwnedDistrictIds: () => new Set([1]),
    getResolvedSpyIntel: () => ({ revealedTypeDistrictIds: [] }),
    hashCell: (row, column) => row + column,
    remapDistrictId: (id) => id,
    remapDistrictType: (id, typeByDistrictId) => typeByDistrictId.get(id),
    startPhaseOwnerByDistrictId: new Map([[2, 2]]),
    variantNamesByBaseName: { Kasino: ["Kasino A"] },
    backgroundImagesByBaseName: {},
    ...overrides
  });
}

describe("district building profile runtime", () => {
  it("builds a deterministic district catalog and profile", () => {
    const runtime = createRuntime();
    const catalog = runtime.getDistrictResourceCatalog();
    const profile = runtime.resolveDistrictBuildingProfile(catalog[0]);

    expect(catalog).toEqual([
      { id: 1, rowIndex: 0, columnIndex: 0, districtType: "resident" },
      { id: 2, rowIndex: 0, columnIndex: 1, districtType: "downtown" }
    ]);
    expect(profile.typeLabel).toBe("Residential");
    expect(profile.buildings[0]).toMatchObject({ baseName: "Kasino", displayName: "Kasino A" });
  });

  it("keeps launch visibility rules outside runtime", () => {
    const runtime = createRuntime();

    expect(runtime.isDistrictTypeVisible({ id: 1, districtType: "resident" }, { gamePhase: "launch" })).toBe(true);
    expect(runtime.isDistrictTypeVisible({ id: 2, districtType: "resident" }, { gamePhase: "launch" })).toBe(false);
    expect(runtime.isDistrictTypeVisible({ id: 2, districtType: "downtown" }, { gamePhase: "launch" })).toBe(true);
  });

  it("keeps a hidden sector hidden until spy intel reveals its type", () => {
    const hiddenRuntime = createRuntime();
    const revealedRuntime = createRuntime({
      getResolvedSpyIntel: () => ({ revealedTypeDistrictIds: [2] })
    });
    const district = { id: 2, districtType: "resident" };

    expect(hiddenRuntime.isDistrictTypeHidden(district, { gamePhase: "launch" })).toBe(true);
    expect(revealedRuntime.isDistrictTypeHidden(district, { gamePhase: "launch" })).toBe(false);
  });

  it("distributes restaurant backgrounds evenly across named variants", () => {
    const runtime = createRuntime({
      districtBuildingPackagePools: {
        resident: {
          early: [{
            key: "resident-early",
            tier: "early",
            title: "Start",
            buildings: ["Restaurace", "Restaurace", "Restaurace", "Restaurace"]
          }]
        }
      },
      backgroundImagesByBaseName: {
        Restaurace: ["bg-1", "bg-2", "bg-3", "bg-4"]
      },
      variantNamesByBaseName: {
        Restaurace: ["R1", "R2", "R3", "R4"]
      }
    });

    const profile = runtime.resolveDistrictBuildingProfile({ id: 1, rowIndex: 0, columnIndex: 0, districtType: "resident" });

    expect(profile.buildings.map((building) => ({
      displayName: building.displayName,
      imagePath: building.imagePath
    }))).toEqual([
      { displayName: "R4", imagePath: "bg-4" },
      { displayName: "R1", imagePath: "bg-1" },
      { displayName: "R2", imagePath: "bg-2" },
      { displayName: "R3", imagePath: "bg-3" }
    ]);
  });

  it("assigns unique variant names to repeated building bases", () => {
    const runtime = createRuntime({
      districtBuildingPackagePools: {
        resident: {
          early: [{
            key: "resident-early",
            tier: "early",
            title: "Start",
            buildings: ["Skladiště", "Skladiště", "Skladiště"]
          }]
        }
      },
      variantNamesByBaseName: {
        Skladiště: ["Depot A", "Depot B", "Depot C"]
      }
    });

    const profile = runtime.resolveDistrictBuildingProfile({ id: 1, rowIndex: 0, columnIndex: 0, districtType: "resident" });
    const displayNames = profile.buildings.map((building) => building.displayName);

    expect(displayNames).toEqual(["Depot A", "Depot B", "Depot C"]);
    expect(new Set(displayNames).size).toBe(displayNames.length);
  });

  it("adds a suffix when repeated buildings outnumber named variants", () => {
    const runtime = createRuntime({
      districtBuildingPackagePools: {
        resident: {
          early: [{
            key: "resident-early",
            tier: "early",
            title: "Start",
            buildings: ["Skladiště", "Skladiště", "Skladiště", "Skladiště"]
          }]
        }
      },
      variantNamesByBaseName: {
        Skladiště: ["Depot A", "Depot B"]
      }
    });

    const profile = runtime.resolveDistrictBuildingProfile({ id: 1, rowIndex: 0, columnIndex: 0, districtType: "resident" });

    expect(profile.buildings.map((building) => building.displayName)).toEqual([
      "Depot A",
      "Depot B",
      "Depot A #2",
      "Depot B #2"
    ]);
  });
});
