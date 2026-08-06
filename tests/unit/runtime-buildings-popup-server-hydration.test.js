import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const runtimeSource = readFileSync(
  resolve(process.cwd(), "page-assets/js/app/runtime.js"),
  "utf8"
);

describe("global Buildings popup server hydration", () => {
  it("loads the authoritative district panel before opening an indexed building", () => {
    const handlerStart = runtimeSource.indexOf("const handleBuildingsPopupDetailTap =");
    const handlerEnd = runtimeSource.indexOf(
      "bindBuildingsPopupTap(buildingsPopupTypeMount, handleBuildingsPopupTypeTap);",
      handlerStart
    );
    const handlerSource = runtimeSource.slice(handlerStart, handlerEnd);
    const buildingBranchStart = handlerSource.indexOf(
      'const buildingButton = target.closest("[data-buildings-open-building-name]")'
    );
    const districtBranchStart = handlerSource.indexOf(
      'const openButton = target.closest("[data-buildings-open-district-id]")',
      buildingBranchStart
    );
    const buildingBranch = handlerSource.slice(buildingBranchStart, districtBranchStart);
    const readinessGuard = buildingBranch.indexOf("isServerAuthoritativeGameplayRuntimeReady()");
    const authoritativeOpen = buildingBranch.indexOf("openServerScopedDistrict(district, buildingRequest)");
    const localCompatibilityOpen = buildingBranch.indexOf(
      "openDistrictBuildingDetail(district, buildingRequest.buildingName"
    );

    expect(handlerStart).toBeGreaterThan(-1);
    expect(handlerEnd).toBeGreaterThan(handlerStart);
    expect(buildingBranchStart).toBeGreaterThan(-1);
    expect(districtBranchStart).toBeGreaterThan(buildingBranchStart);
    expect(readinessGuard).toBeGreaterThan(-1);
    expect(authoritativeOpen).toBeGreaterThan(readinessGuard);
    expect(localCompatibilityOpen).toBeGreaterThan(authoritativeOpen);
    expect(buildingBranch).toContain("buildingRequest.buildingId");
    expect(buildingBranch).toContain("buildingRequest.buildingTypeId");
    expect(buildingBranch).not.toContain("presentDistrictBuildingDetail(");
  });
});
