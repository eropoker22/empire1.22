import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  utilityParitySurfaceNames,
  utilityParitySurfaces,
  utilityParityViewportBatches,
  utilityParityViewports,
  validateUtilityParityCoverage
} from "../e2e/helpers/utilityModalParity.js";

describe("utility modal parity coverage contract", () => {
  it("locks the seven highest-risk surfaces and full canonical viewport matrix", () => {
    expect(utilityParitySurfaceNames).toEqual([
      "profile",
      "storage",
      "wanted",
      "settings",
      "about",
      "leaderboard",
      "onboarding"
    ]);
    expect(utilityParityViewports).toEqual([
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
    expect(validateUtilityParityCoverage()).toEqual({
      batchCount: 5,
      comparisonCount: 70,
      surfaceNames: utilityParitySurfaceNames,
      viewportNames: utilityParityViewports.map(({ name }) => name)
    });
    expect(utilityParityViewportBatches).toHaveLength(5);
    expect(utilityParityViewportBatches.every(({ viewports }) => viewports.length === 2)).toBe(true);
    expect(utilityParityViewportBatches.flatMap(({ viewports }) => viewports))
      .toEqual(utilityParityViewports);
  });

  it("requires visible triggers, close actions and multiple guarded sections", () => {
    for (const surfaceName of utilityParitySurfaceNames) {
      const definition = utilityParitySurfaces[surfaceName];
      expect(definition.triggerSelector).toBeTruthy();
      expect(definition.closeSelector).toBeTruthy();
      expect(definition.shellSelector).toBeTruthy();
      expect(definition.targetSelector).toBeTruthy();
      expect(definition.requiredSectionSelectors.length).toBeGreaterThanOrEqual(2);
    }
    expect(utilityParitySurfaces.onboarding.triggerSelector).toBe("[data-onboarding-launch]");
    expect(utilityParitySurfaces.leaderboard.requiredSectionSelectors).toEqual(
      expect.arrayContaining([
        ".leaderboard-control-strip",
        ".leaderboard-popup-tabs",
        ".leaderboard-my-rank",
        ".leaderboard-board",
        ".leaderboard-popup-stats",
        ".leaderboard-popup-list"
      ])
    );
  });

  it("masks only authoritative leaves and never a shell, card or collection", () => {
    const forbiddenSelectors = new Set([
      "*",
      "body",
      "html",
      "[data-leaderboard-list]",
      "[data-leaderboard-my-rank]",
      "[data-leaderboard-stats]"
    ]);
    for (const surfaceName of utilityParitySurfaceNames) {
      const definition = utilityParitySurfaces[surfaceName];
      const masks = String(definition.dynamicLeafSelector || "")
        .split(",")
        .map((selector) => selector.trim())
        .filter(Boolean);
      expect(masks).not.toContain(definition.shellSelector);
      expect(masks).not.toContain(definition.targetSelector);
      expect(masks.some((selector) => forbiddenSelectors.has(selector))).toBe(false);
    }
    expect(utilityParitySurfaces.storage.dynamicLeafSelector).toBe("[data-storage-value]");
    expect(utilityParitySurfaces.leaderboard.dynamicLeafSelector).not.toContain(
      "[data-leaderboard-list]"
    );
  });

  it("fails closed when coverage or mask scope drifts", () => {
    expect(() => validateUtilityParityCoverage({
      surfaceNames: utilityParitySurfaceNames.slice(0, -1)
    })).toThrow(/complete canonical list/u);
    expect(() => validateUtilityParityCoverage({
      viewports: utilityParityViewports.slice(0, 1)
    })).toThrow(/full canonical 10-viewport matrix/u);
    expect(() => validateUtilityParityCoverage({
      viewportBatches: utilityParityViewportBatches.slice(0, -1)
    })).toThrow(/canonical matrix exactly once/u);
    expect(() => validateUtilityParityCoverage({
      surfaces: {
        ...utilityParitySurfaces,
        profile: {
          ...utilityParitySurfaces.profile,
          dynamicLeafSelector: utilityParitySurfaces.profile.targetSelector
        }
      }
    })).toThrow(/masks a structural container/u);
  });

  it("keeps the utility spec inside the local-hosted ui-parity gate", () => {
    const runnerSource = readFileSync(
      new URL("../../scripts/run-local-hosted-full.mjs", import.meta.url),
      "utf8"
    );
    const specSource = readFileSync(
      new URL("../e2e/live-demo-utility-modal-parity.spec.js", import.meta.url),
      "utf8"
    );
    expect(runnerSource).toContain("live-demo-utility-modal-parity.spec.js");
    expect(runnerSource).toContain('name: "utility-modals"');
    expect(runnerSource).toContain('grep: "live/demo utility modal parity"');
    expect(specSource).toContain('test.describe.configure({ mode: "serial" })');
    expect(specSource).toContain("utilityParityViewportBatches");
    expect(specSource).toContain("setViewportSize(viewport)");
    expect(specSource.match(/await registerAndEnterHostedUiParityGame\(/gu) || []).toHaveLength(1);
  });
});
