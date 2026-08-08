import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  districtActionOverlayDefinitions,
  districtActionOverlayNames,
  districtActionOverlayParityViewportBatches,
  districtActionOverlayParityViewports,
  districtActionOverlayScenarioEvidence,
  validateDistrictActionOverlayParityCoverage
} from "../e2e/helpers/districtActionOverlayParity.js";
import { resolveDistrictActions } from "../../page-assets/js/app/legacy/district-action-policy.js";
import {
  createServerDistrictActionPresentation
} from "../../page-assets/js/app/runtime/serverDistrictActionPresentation.js";

describe("district action overlay parity coverage", () => {
  it("guards all five canonical action presentations across the full viewport matrix", () => {
    const coverage = validateDistrictActionOverlayParityCoverage();

    expect(districtActionOverlayNames).toEqual([
      "spy-confirm",
      "robbery-setup",
      "robbery-confirm",
      "heist-inline",
      "attack-setup",
      "attack-confirm",
      "occupy-confirm"
    ]);
    expect(coverage).toMatchObject({
      actionIds: ["spy", "rob", "heist", "attack", "occupy"],
      batchCount: 5,
      comparisonCount: 70,
      viewportNames: districtActionOverlayParityViewports.map(({ name }) => name)
    });
    expect(districtActionOverlayParityViewports).toEqual([
      { name: "mobile-320x568", width: 320, height: 568 },
      { name: "mobile-360x800", width: 360, height: 800 },
      { name: "mobile-390x844", width: 390, height: 844 },
      { name: "mobile-430x932", width: 430, height: 932 },
      { name: "tablet-768x1024", width: 768, height: 1024 },
      { name: "tablet-820x1180", width: 820, height: 1180 },
      { name: "desktop-1024x768", width: 1024, height: 768 },
      { name: "desktop-1366x768", width: 1366, height: 768 },
      { name: "desktop-1440x900", width: 1440, height: 900 },
      { name: "desktop-1920x1080", width: 1920, height: 1080 }
    ]);
    expect(districtActionOverlayParityViewportBatches).toHaveLength(5);
    expect(districtActionOverlayParityViewportBatches.every(
      ({ viewports }) => viewports.length === 2
    )).toBe(true);
    expect(districtActionOverlayParityViewportBatches.flatMap(({ viewports }) => viewports))
      .toEqual(districtActionOverlayParityViewports);
  });

  it("keeps every comparison pre-submit and labels the authoritative fixture boundary", () => {
    expect(districtActionOverlayScenarioEvidence).toEqual({
      hostedEntry: "browser-registration-lobby-spawn-bootstrap",
      hostedScenario: "fixture-backed:multiplayer-core",
      resultSurface: "not-triggered-because-every-current-result-requires-authoritative-state-mutation",
      stateBoundary: "pre-submit-only"
    });
    expect(districtActionOverlayDefinitions["heist-inline"]).toMatchObject({
      actionId: "heist",
      openBehavior: "inspect-only",
      stage: "inline-pre-submit"
    });
    expect(Object.values(districtActionOverlayDefinitions)).not.toContainEqual(
      expect.objectContaining({ openBehavior: "submit" })
    );
  });

  it("keeps enabled hosted target buttons in the same non-stacked shape as the demo", () => {
    const localActions = resolveDistrictActions({
      districtId: 25,
      isOwnedByCurrentPlayer: false,
      hasAdjacentOwnedDistrict: true,
      isUnoccupied: false,
      canOccupyAfterSpy: false,
      availableSpies: 2,
      isOccupying: false,
      hasActiveOccupation: false,
      isSpying: false,
      isRobbing: false,
      isDowntownOccupationLocked: false,
      currentTrapDistrictId: null,
      trapMoveCooldownSeconds: 0
    });
    const hostedActions = createServerDistrictActionPresentation({
      district: {
        districtId: "district:25",
        targetActions: {
          attackTargets: [{ districtId: "district:25", enabled: true, name: "District 25" }],
          heistTargets: [{ districtId: "district:25", enabled: true, name: "District 25" }],
          occupyTargets: [],
          robTargets: [],
          spyTargets: [{ districtId: "district:25", enabled: true, name: "District 25" }]
        },
        placeDefense: null,
        removeDefense: null,
        trap: null
      }
    }, "district:25");

    for (const actionId of ["attack", "heist", "spy"]) {
      const localAction = localActions.find((action) => action.id === actionId);
      const hostedAction = hostedActions.find((action) => action.id === actionId);
      expect(hostedAction).toMatchObject({ enabled: true, stacked: false, subtitle: "" });
      expect({
        stacked: Boolean(hostedAction.stacked),
        subtitle: hostedAction.subtitle || ""
      }).toEqual({
        stacked: Boolean(localAction.stacked),
        subtitle: localAction.subtitle || ""
      });
    }
  });

  it("uses scenario-accurate hosted targets and only leaf-level screenshot masks", () => {
    expect(districtActionOverlayDefinitions["spy-confirm"].hostedTargetDistrictId).toBe("district:25");
    expect(districtActionOverlayDefinitions["robbery-setup"].hostedTargetDistrictId).toBe("district:24");
    expect(districtActionOverlayDefinitions["robbery-confirm"].hostedTargetDistrictId).toBe("district:24");
    expect(districtActionOverlayDefinitions["heist-inline"].hostedTargetDistrictId).toBe("district:4");
    expect(districtActionOverlayDefinitions["attack-setup"].hostedTargetDistrictId).toBe("district:2");
    expect(districtActionOverlayDefinitions["attack-confirm"].hostedTargetDistrictId).toBe("district:2");
    expect(districtActionOverlayDefinitions["occupy-confirm"].hostedTargetDistrictId).toBe("district:6");
    expect(districtActionOverlayDefinitions["attack-setup"].dynamicAssetSelectors)
      .toEqual(["[data-attack-setup-atmosphere-image]"]);
    expect(districtActionOverlayDefinitions["attack-confirm"].dynamicAssetSelectors)
      .toEqual(["[data-attack-confirm-atmosphere-image]"]);
    expect(Object.fromEntries([
      "spy-confirm",
      "robbery-confirm",
      "attack-confirm",
      "occupy-confirm"
    ].map((surfaceName) => [
      surfaceName,
      districtActionOverlayDefinitions[surfaceName].dynamicValueWrapperSelectors
    ]))).toEqual({
      "spy-confirm": [
        "[data-spy-confirm-available]",
        "[data-spy-confirm-duration]"
      ],
      "robbery-confirm": [
        "[data-robbery-confirm-members]",
        "[data-robbery-confirm-duration]"
      ],
      "attack-confirm": [
        "[data-attack-confirm-source]",
        "[data-attack-confirm-members]",
        "[data-attack-confirm-power]",
        "[data-attack-confirm-scenario]",
        "[data-attack-confirm-duration]"
      ],
      "occupy-confirm": [
        "[data-occupy-confirm-cost]",
        "[data-occupy-confirm-duration]"
      ]
    });

    for (const definition of Object.values(districtActionOverlayDefinitions)) {
      for (const selector of [
        ...definition.dynamicAssetSelectors,
        ...definition.dynamicLeafSelectors
      ]) {
        expect(selector).not.toBe("*");
        expect(selector).not.toBe(definition.shellSelector);
        expect(selector).not.toBe(definition.targetSelector);
      }
      for (const selector of definition.dynamicValueWrapperSelectors) {
        expect(definition.dynamicLeafSelectors).toContain(selector);
        expect(selector).not.toBe("*");
        expect(selector).not.toBe(definition.shellSelector);
        expect(selector).not.toBe(definition.targetSelector);
      }
    }
  });

  it("statically guards visible map and district triggers without direct submit shortcuts", async () => {
    const [helperSource, runtimeSource, specSource] = await Promise.all([
      readFile("tests/e2e/helpers/districtActionOverlayParity.js", "utf8"),
      readFile("page-assets/js/app/runtime.js", "utf8"),
      readFile("tests/e2e/live-demo-district-action-overlay-parity.spec.js", "utf8")
    ]);

    expect(helperSource).toContain("window.empireStreetsMapNavigation?.resetZoom?.()");
    expect(helperSource).toContain("window.requestAnimationFrame(resolve)");
    expect(helperSource).toContain('document.querySelector("[data-map-viewport]")');
    expect(helperSource).toContain("point.insideViewport");
    expect(helperSource).toContain("page.mouse.click(point.x, point.y)");
    expect(helperSource).toContain("[data-district-action-id=\"");
    expect(helperSource).toContain('gamePhase: "launch"');
    expect(helperSource).toContain("new Map(state.launchOwners || [])");
    expect(helperSource).toContain("launchOwners.get(25)");
    expect(helperSource).toContain("launchOwners.get(45)");
    expect(helperSource).toContain("launchOwner25: 3");
    expect(helperSource).toContain("launchOwner45: 9");
    expect(helperSource).toContain("stableBackdropShellSelector: definition.shellSelector");
    expect(helperSource).toContain('definition.stage === "inline-pre-submit"');
    expect(helperSource).toContain("stableBackdropFilterSelector: stabilizeInlineAction");
    expect(helperSource).toContain("stableTargetDevicePixelAlignment: stabilizeInlineAction");
    expect(helperSource).toContain('{ "background-color": "rgb(6, 10, 18)" }');
    expect(helperSource).toContain("roundedCompositeSelector: stabilizeInlineAction");
    expect(helperSource).toContain('not.toHaveClass(/\\bgame-mobile-close-guard\\b/u)');
    expect(helperSource).not.toContain("/api/gameplay-slice/submit");
    expect(helperSource).not.toContain("openDistrictAsync");
    expect(helperSource).not.toContain("EmpireRuntime?.selectDistrict");
    const authoritySyncStart = runtimeSource.indexOf(
      "const syncInteractionDistrictAuthorityState = () => {"
    );
    const authoritySyncEnd = runtimeSource.indexOf(
      "\n  };\n\n  syncInteractionDistrictAuthorityState();",
      authoritySyncStart
    );
    const authoritySyncSource = runtimeSource.slice(authoritySyncStart, authoritySyncEnd);
    const phaseSyncSource =
      "interactionState.gamePhase = normalizeRuntimeGamePhase(worldState.phaseState?.gamePhase);";
    const launchOwnerBranchSource =
      'interactionState.launchOwnerByDistrictId = interactionState.gamePhase === "launch"';

    expect(authoritySyncStart).toBeGreaterThanOrEqual(0);
    expect(authoritySyncEnd).toBeGreaterThan(authoritySyncStart);
    expect(authoritySyncSource).toContain(phaseSyncSource);
    expect(authoritySyncSource).toContain(launchOwnerBranchSource);
    expect(authoritySyncSource.indexOf(phaseSyncSource))
      .toBeLessThan(authoritySyncSource.indexOf(launchOwnerBranchSource));
    expect(runtimeSource).toContain(
      'const nextGamePhase = normalizeRuntimeGamePhase(phaseHost.dataset.gamePhase || "launch");'
    );
    expect(runtimeSource).toContain(
      "if (interactionState.gamePhase !== nextGamePhase) {\n      syncInteractionDistrictAuthorityState();"
    );
    expect(runtimeSource).toContain(
      "const forceAuthoritySync = event?.detail?.ownedDistrictIdsChanged === true;"
    );
    expect(runtimeSource).toContain(
      "if (nextWorldMapFingerprint === lastWorldMapFingerprint && !forceAuthoritySync)"
    );
    expect(specSource).toContain("loginAndResumeHostedUiParityGame");
    expect(specSource).toContain("fixture-backed live/demo district action overlay parity");
    expect(specSource).toContain('test.describe.configure({ mode: "serial" })');
    expect(specSource).toContain("districtActionOverlayParityViewportBatches");
    expect(specSource).toContain("setViewportSize(viewport)");
    expect(specSource.match(/await loginAndResumeHostedUiParityGame\(/gu) || []).toHaveLength(1);
    expect(specSource).not.toContain("data-spy-confirm-button");
    expect(specSource).not.toContain("data-robbery-confirm-button");
    expect(specSource).not.toContain("data-attack-confirm-button");
    expect(specSource).not.toContain("data-occupy-confirm-button");
  });

  it("waits for hosted district selection and visible authoritative hydration", async () => {
    const helperSource = await readFile(
      "tests/e2e/helpers/districtActionOverlayParity.js",
      "utf8"
    );

    expect(helperSource).toMatch(
      /expect\.poll[\s\S]*timeout: 30_000[\s\S]*\.toBe\(canonicalDistrictId\)/u
    );
    expect(helperSource).toContain(
      "Hosted district ${canonicalDistrictId} must finish authoritative selection"
    );
    expect(helperSource).toContain('"data-server-district-id"');
  });
});
