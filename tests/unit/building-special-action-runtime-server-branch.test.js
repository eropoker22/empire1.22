import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const runtimeSource = readFileSync("page-assets/js/app/runtime.js", "utf8");

function getServerActionBranchSource() {
  const branchStart = runtimeSource.indexOf('if (definition.handlerId === "server-run-building-action")');
  const branchEnd = runtimeSource.indexOf("if (!hasLegacyBuildingSpecialActionHandler", branchStart);
  expect(branchStart).toBeGreaterThan(-1);
  expect(branchEnd).toBeGreaterThan(branchStart);
  return runtimeSource.slice(branchStart, branchEnd);
}

describe("runtime Downtown server building action branch", () => {
  it("starts cooldown and writes street news only after accepted server response", () => {
    const branch = getServerActionBranchSource();
    const submitIndex = branch.indexOf("await submitServerBuildingActionCommand");
    const acceptedGuardIndex = branch.indexOf("if (!response?.accepted)");
    const cooldownIndex = branch.indexOf("updateDistrictBuildingDetailEntry");
    const streetNewsIndex = branch.indexOf("appendBuildingActionResultEntry");

    expect(submitIndex).toBeGreaterThan(-1);
    expect(acceptedGuardIndex).toBeGreaterThan(submitIndex);
    expect(cooldownIndex).toBeGreaterThan(acceptedGuardIndex);
    expect(streetNewsIndex).toBeGreaterThan(acceptedGuardIndex);
  });

  it("does not call the legacy special-action fallback inside the server branch", () => {
    const branch = getServerActionBranchSource();

    expect(branch).not.toContain("applyDistrictBuildingSpecialAction(");
    expect(branch).toContain('"Handler", value: "Server"');
  });
});
