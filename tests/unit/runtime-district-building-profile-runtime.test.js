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
        mid: [{ key: "resident-mid", tier: "mid", title: "Mid", buildings: ["Sklad"] }]
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
});
