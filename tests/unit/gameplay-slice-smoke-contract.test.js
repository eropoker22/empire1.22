import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const smoke = readFileSync(
  resolve(process.cwd(), "scripts/gameplay-slice-smoke.mjs"),
  "utf8"
);

describe("gameplay slice smoke contract", () => {
  it("never enables demo mode or treats fallback as hosted success", () => {
    expect(smoke).not.toContain("createSmokeSession");
    expect(smoke).not.toContain("localDemoEnabled: true");
    expect(smoke).toContain('searchParams.set("runtimeMode", "server-authoritative")');
    expect(smoke).toContain('["demo-ready", "legacy-fallback"]');
    expect(smoke).toContain("forbidden demo/fallback runtime");
  });

  it("uses the hidden slice only as a headless port", () => {
    expect(smoke).not.toMatch(/\[data-gameplay-slice-client\][^\n]*button/u);
    expect(smoke).toContain('presentationMode !== "controller-only"');
    expect(smoke).toContain("renderedButtonCount !== 0");
    expect(smoke).toContain("window.EmpireGameplaySliceClient?.getCurrentReadModel?.()");
    expect(smoke).not.toContain("window.EmpireGameplaySliceClient?.submitCommand?.(");
  });

  it("opens and mutates through canonical visible shared UI", () => {
    expect(smoke).toContain('document.querySelector("[data-district-canvas]")');
    expect(smoke).toContain('document.querySelector("[data-district-popup]")');
    expect(smoke).toContain("[data-district-building-id=");
    expect(smoke).toContain("[data-district-building-detail-popup]");
    expect(smoke).toContain("[data-district-building-detail-action-id=");
    expect(smoke).toContain("bypassed the canonical shared confirmation");
    expect(smoke).toContain('commandTransport: "visible-shared-ui"');
    expect(smoke).toContain("visibleBuildingActionClick: true");
  });
});
