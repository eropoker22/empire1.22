import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  socialModalParitySurfaceNames,
  socialModalParitySurfaces,
  socialModalParityViewportBatches,
  socialModalParityViewports,
  validateSocialModalParityCoverage
} from "../e2e/helpers/socialModalParityContract.js";

describe("social modal parity coverage contract", () => {
  it("locks four canonical surfaces and the full canonical viewport matrix", () => {
    expect(socialModalParitySurfaceNames).toEqual([
      "market",
      "alliance",
      "bounty",
      "boost"
    ]);
    expect(socialModalParityViewports).toEqual([
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
    expect(validateSocialModalParityCoverage()).toEqual({
      batchCount: 5,
      comparisonCount: 40,
      surfaceNames: socialModalParitySurfaceNames,
      viewportNames: socialModalParityViewports.map(({ name }) => name)
    });
    expect(socialModalParityViewportBatches).toHaveLength(5);
    expect(socialModalParityViewportBatches.every(({ viewports }) => viewports.length === 2)).toBe(true);
    expect(socialModalParityViewportBatches.flatMap(({ viewports }) => viewports))
      .toEqual(socialModalParityViewports);
  });

  it("requires visible triggers, close controls and ordered section coverage", () => {
    for (const surfaceName of socialModalParitySurfaceNames) {
      const definition = socialModalParitySurfaces[surfaceName];
      expect(definition.triggerSelector).toBeTruthy();
      expect(definition.closeSelector).toBeTruthy();
      expect(definition.shellSelector).toBeTruthy();
      expect(definition.targetSelector).toBeTruthy();
      expect(definition.requiredSectionSelectors.length).toBeGreaterThanOrEqual(4);
    }
    expect(socialModalParitySurfaces.market.triggerSelector).toBe("[data-market-popup-open]");
    expect(socialModalParitySurfaces.market.roundedCompositeSelector).toBe(
      ".market-popup-tab.is-active"
    );
    expect(socialModalParitySurfaces.market.stableBackdropFilterSelector).toBe(
      ".market-popup-dashboard__chip,.market-popup-dashboard__recent"
    );
    expect(socialModalParitySurfaces.market.responsiveHiddenSectionRules).toEqual([
      {
        maxViewportWidth: 720,
        selector: "[data-market-copy]"
      }
    ]);
    expect(socialModalParitySurfaces.alliance.triggerSelector).toBe("[data-alliance-popup-open]");
    expect(socialModalParitySurfaces.bounty.triggerSelector).toBe("[data-bounty-open-trigger]");
    expect(socialModalParitySurfaces.bounty.roundedCompositeSelector).toBe(
      "#bounty-modal-submit"
    );
    expect(socialModalParitySurfaces.boost.triggerSelector).toBe("[data-boost-open-trigger]");
    expect(socialModalParitySurfaces.boost.stableDescendantDevicePixelAlignmentSelector).toBe(
      ".boost-card__icon > svg"
    );
    expect(socialModalParitySurfaces.boost.stableDescendantDevicePixelAlignmentMode).toBe(
      "target-relative-paint-origin"
    );
    expect(socialModalParitySurfaces.boost.stableTargetDevicePixelAlignment).toBe(true);
    expect(socialModalParitySurfaces.boost.stableTargetDevicePixelAlignmentMode).toBe("translate");
    expect(Object.entries(socialModalParitySurfaces)
      .filter(([, definition]) => (
        definition.stableDescendantDevicePixelAlignmentMode === "target-relative-paint-origin"
      ))
      .map(([surfaceName]) => surfaceName)).toEqual(["boost"]);
  });

  it("masks authoritative leaves without masking shells, cards or collections", () => {
    const forbiddenMasks = new Set([
      "*",
      "body",
      "html",
      "[data-market-dashboard]",
      "[data-market-list]",
      "#alliance-active-panel",
      "#bounty-board-body",
      "#boost-modal-content",
      ".market-popup-row",
      ".alliance-active-card",
      ".bounty-board__panel",
      ".boost-card"
    ]);
    for (const surfaceName of socialModalParitySurfaceNames) {
      const definition = socialModalParitySurfaces[surfaceName];
      const masks = definition.dynamicLeafSelector
        .split(",")
        .map((selector) => selector.trim())
        .filter(Boolean);
      expect(masks).not.toContain(definition.shellSelector);
      expect(masks).not.toContain(definition.targetSelector);
      expect(masks.some((selector) => forbiddenMasks.has(selector))).toBe(false);
      expect(masks.some((selector) => definition.requiredSectionSelectors.includes(selector))).toBe(false);
    }
    const marketMasks = socialModalParitySurfaces.market.dynamicLeafSelector
      .split(",")
      .map((selector) => selector.trim());
    expect(marketMasks).not.toContain("[data-market-dashboard] strong");
    expect(marketMasks).not.toContain('[data-market-dashboard-tone="timer"] strong');
    expect(marketMasks).toContain('[data-market-dashboard-tone="clean"] strong');
    expect(marketMasks).toContain('[data-market-dashboard-tone="dirty"] strong');
    expect(marketMasks).not.toContain(".market-popup-dashboard__chip");
    expect(marketMasks).not.toContain(".market-popup-dashboard__recent");
  });

  it("fails closed when surface, viewport or mask scope drifts", () => {
    expect(() => validateSocialModalParityCoverage({
      surfaceNames: socialModalParitySurfaceNames.slice(0, -1)
    })).toThrow(/Market, Alliance, Bounty and Boost/u);
    expect(() => validateSocialModalParityCoverage({
      viewports: socialModalParityViewports.slice(0, 1)
    })).toThrow(/full canonical 10-viewport matrix/u);
    expect(() => validateSocialModalParityCoverage({
      viewportBatches: socialModalParityViewportBatches.slice(0, -1)
    })).toThrow(/canonical matrix exactly once/u);
    expect(() => validateSocialModalParityCoverage({
      surfaces: {
        ...socialModalParitySurfaces,
        market: {
          ...socialModalParitySurfaces.market,
          dynamicLeafSelector: socialModalParitySurfaces.market.targetSelector
        }
      }
    })).toThrow(/masks a structural container/u);
    expect(() => validateSocialModalParityCoverage({
      surfaces: {
        ...socialModalParitySurfaces,
        market: {
          ...socialModalParitySurfaces.market,
          responsiveHiddenSectionRules: [{
            maxViewportWidth: 720,
            selector: "[data-market-missing]"
          }]
        }
      }
    })).toThrow(/invalid responsive hidden section rule/u);
  });

  it("keeps real hosted entry, visible triggers and exact pixel assertions in the spec", () => {
    const specSource = readFileSync(
      new URL("../e2e/live-demo-social-modal-parity.spec.js", import.meta.url),
      "utf8"
    );
    expect(specSource).toContain("registerAndEnterHostedUiParityGame");
    expect(specSource).toContain("openSocialModalParitySurface");
    expect(specSource).toContain("meaningfulPixelCount");
    expect(specSource).toContain("exerciseSocialModalParityScroll");
    expect(specSource).toContain("getSocialModalParitySignature");
    expect(specSource).toContain("toBe(0)");
    expect(specSource).toContain('test.describe.configure({ mode: "serial" })');
    expect(specSource).toContain("socialModalParityViewportBatches");
    expect(specSource).toContain("EMPIRE_UI_PARITY_SOCIAL_BATCH_KEYS");
    expect(specSource).toContain("Unknown social parity viewport batch keys");
    expect(specSource).toContain("for (const viewportBatch of selectedViewportBatches)");
    expect(specSource).toContain("const expectedComparisons = selectedViewportBatches.flatMap");
    expect(specSource).toContain("setViewportSize(viewport)");
    expect(specSource).toContain("cityClock.minuteOfDay");
    expect(specSource).toContain("cityClock.dayIndex");
    expect(specSource).toContain("readModel?.bounty?.eligibleTargets");
    expect(specSource).toContain("bountyDemoTargets: hostedPresentationState.bountyDemoTargets");
    expect(specSource.match(/await registerAndEnterHostedUiParityGame\(/gu) || []).toHaveLength(2);
  });

  it("serializes the authoritative text marker into the browser callback", () => {
    const helperSource = readFileSync(
      new URL("../e2e/helpers/socialModalParityContract.js", import.meta.url),
      "utf8"
    );
    expect(helperSource).toContain("const authoritativeText = config.authoritativeText;");
    expect(helperSource).toContain("authoritativeText: AUTHORITATIVE_TEXT");
    expect(helperSource.match(/\? authoritativeText/gu)?.length).toBeGreaterThanOrEqual(6);
    expect(helperSource).toContain("signature.scrollTop = 0;");
    expect(helperSource).toContain("windowY: 0");
    expect(helperSource).toContain(".toBeAttached()");
    expect(helperSource).toContain(".toBeHidden()");
  });

  it("isolates transparent modal composites from unrelated page state", () => {
    const helperSource = readFileSync(
      new URL("../e2e/helpers/socialModalParityContract.js", import.meta.url),
      "utf8"
    );
    expect(helperSource).toContain("stableBackdropShellSelector: definition.shellSelector");
    expect(helperSource).toContain(
      'stableBackdropFilterSelector: definition.stableBackdropFilterSelector || ""'
    );
    expect(helperSource).toContain(
      'definition.stableDescendantDevicePixelAlignmentSelector || ""'
    );
    expect(helperSource).toContain(
      'definition.stableDescendantDevicePixelAlignmentMode || "translate"'
    );
    expect(helperSource).toContain(
      "definition.stableTargetDevicePixelAlignment === true"
    );
    expect(helperSource).toContain(
      'definition.stableTargetDevicePixelAlignmentMode || "relative-offset"'
    );
    expect(helperSource).toContain(
      "requestAnimationFrame(() => requestAnimationFrame(resolve));"
    );
    expect(helperSource).toContain(
      'roundedCompositeSelector: definition.roundedCompositeSelector || ""'
    );
    expect(helperSource).not.toContain("mask: definition.shellSelector");
    expect(helperSource).not.toContain("mask: definition.targetSelector");
  });
});
