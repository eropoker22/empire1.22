import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path) => readFileSync(resolve(process.cwd(), path), "utf8").replace(/\r\n/gu, "\n");

describe("live/demo UI parity source contract", () => {
  const gameRedesignCss = read("page-assets/css/styles-game-redesign.css");
  const gameCss = read("page-assets/css/styles.css");
  const paritySpec = read("tests/e2e/live-demo-ui-parity.spec.js");
  const parityCapture = read("tests/e2e/helpers/uiParityCapture.js");
  const hostedEntry = read("tests/e2e/helpers/hostedUiParityEntry.js");
  const eventRumorBridge = read("page-assets/js/app/runtime/eventRumorBridge.js");
  const localHostedRunner = read("scripts/run-local-hosted-full.mjs");

  it("keeps the tablet game shell on the canonical three-column layout", () => {
    expect(gameRedesignCss).toMatch(
      /@media \(min-width: 721px\) and \(max-width: 900px\) \{\s*\.game-layout--shell \{\s*display: grid;\s*grid-template-columns: minmax\(0, 1fr\) minmax\(0, 3\.01fr\) minmax\(0, 1\.945fr\);/u
    );
  });

  it("keeps the essential profile and settings triggers reachable at tablet widths", () => {
    expect(gameRedesignCss).toMatch(
      /@media \(min-width: 721px\) and \(max-width: 900px\) \{[\s\S]*?\.player-profile-trigger\.nav-btn--profile \{\s*display: inline-flex;\s*align-items: center;\s*justify-content: center;/u
    );
    expect(gameRedesignCss).toMatch(
      /@media \(min-width: 721px\) and \(max-width: 900px\) \{[\s\S]*?\.game-utility-actions \{\s*display: flex;\s*width: 100%;\s*margin-left: 0;\s*justify-content: center;/u
    );
  });

  it("stabilizes the shared building and City Events screenshot backdrops", () => {
    expect(parityCapture).toContain('gamePhase = "live"');
    expect(parityCapture).toContain("gamePhase: configuredGamePhase");
    expect(paritySpec).toContain(
      "stableBackdropShellSelector: paritySurfaces[surfaceName].shell"
    );
    expect(paritySpec).toContain(
      'stableRasterSelector: surfaceName === "district" ? ".district-modal-hero__image" : ""'
    );
    expect(parityCapture).toContain("export const districtPopupStableBackdropFilterSelector");
    expect(parityCapture).toContain('".district-popup-card"');
    expect(parityCapture).toContain('".district-popup-buildings"');
    expect(parityCapture).toContain('".district-popup-action"');
    expect(paritySpec).toContain("? districtPopupStableBackdropFilterSelector");
    expect(paritySpec).toContain(
      'stableTargetStyleProperties: surfaceName === "district"'
    );
    expect(paritySpec).toContain(
      '"--district-owner-avatar-opacity": "0",\n          "--district-owner-avatar-url": "none"'
    );
    expect(paritySpec).toContain(
      'stableDescendantDevicePixelAlignmentSelector: surfaceName === "district"'
    );
    expect(paritySpec).toContain('".district-popup-owner-label, .district-popup-buildings__chip--button"');
    expect(paritySpec).toContain(".district-popup-buildings__chip--button");
    expect(paritySpec).toContain(
      'roundedCompositeRasterFringePx: surfaceName === "district" ? 4 : 2'
    );
    expect(paritySpec).toContain('if (surfaceName === "district") {');
    expect(paritySpec).toContain(
      "expectedBuildingTypeIds: await readVisibleDistrictBuildingTypeIds(serverPage)"
    );
    expect(paritySpec).toContain('.replace(/^(?:district:)+/u, "")');
    expect(paritySpec).toContain(
      '`district ${districtId} must settle after authoritative screenshot synchronization`'
    );
    expect(paritySpec).toContain("productionRuntimeSpecificContentSelector");
    expect(paritySpec).toContain("additionalDynamicContentSelector");
    expect(parityCapture).toContain("export const productionRuntimeSpecificContentSelector");
    expect(parityCapture).toContain('".pharmacy-slot-grid"');
    expect(parityCapture).toContain('".factory-slot-grid"');
    expect(parityCapture).toContain("dynamicExtentContentSelector: additionalDynamicContentSelector");
    expect(parityCapture).toContain('height: hasDynamicExtent(element) ? "<dynamic>"');
    expect(parityCapture).toContain('canScrollY: dynamicExtent ? "<dynamic>" : canScrollY');
    expect(parityCapture).toContain("normalizeDynamicContentScrollExtent");
    expect(paritySpec).toContain("ignoreRasterFringePx:");
    expect(paritySpec).toContain("? 28");
    expect(paritySpec).not.toContain("hosted scroll overflow mode");
    expect(paritySpec).toContain('surfaceName === "buildingDetail"');
    expect(paritySpec).toContain('".building-detail-title__badge--count"');
    expect(paritySpec).toContain(
      'const hasStableBuildingCountBadge = surfaceName === "buildingDetail"'
    );
    expect(paritySpec).toContain(
      'await target.locator(`${buildingCountBadgeSelector}:visible`).count() > 0'
    );
    expect(paritySpec).toContain(': hasStableBuildingCountBadge');
    expect(paritySpec).toContain(
      'stableDescendantDevicePixelAlignmentMode: ["buildingDetail", "district"].includes(surfaceName)'
    );
    expect(paritySpec).toContain('? "paint-origin"');
    expect(paritySpec).toContain(
      'stableTargetDevicePixelAlignment: surfaceName === "district"'
    );
    expect(paritySpec).toContain(
      'stableTargetDevicePixelAlignmentMode: surfaceName === "district"'
    );
    expect(paritySpec).toContain('? "position-offset"');
    expect(paritySpec).toContain(
      'stableTargetPaintOrigin: surfaceName === "district"'
    );
    expect(parityCapture).toContain(
      'stableTargetDevicePixelAlignmentMode = "relative-offset"'
    );
    expect(parityCapture).toContain(
      '["position-offset", "relative-offset", "translate"].includes(alignmentMode)'
    );
    expect(parityCapture).toContain("stableTargetStyleProperties = {}");
    expect(parityCapture).toContain(
      'targetElement.style.setProperty(propertyName, value, "important")'
    );
    expect(parityCapture).toContain(
      'captureRule.style.setProperty(propertyName, value, "important")'
    );
    expect(parityCapture).toContain(
      'data-parity-capture-stable-target-style-sheet'
    );
    expect(parityCapture).toContain("entry.previousPriority");
    expect(parityCapture).toContain(
      'setProperty("filter", "none", "important")'
    );
    expect(parityCapture).toContain(
      'setProperty("transform", "none", "important")'
    );
    expect(parityCapture).toContain(
      'const captureAttribute = "data-parity-capture-stable-raster"'
    );
    expect(parityCapture).toContain("removeAttribute(captureAttribute)");
    expect(paritySpec).toContain(
      'surfaceName === "pharmacy" ? ".pharmacy-slot__metric" : ""'
    );
    expect(paritySpec).toContain(
      'surfaceName === "pharmacy" ? ".pharmacy-slot__quantity-btn" : ""'
    );
    expect(paritySpec).toContain(
      'surfaceName === "pharmacy" ? ".pharmacy-slot__quantity-value" : ""'
    );
    expect(paritySpec).toContain(
      'surfaceName === "pharmacy" ? ".pharmacy-slot__btn" : ""'
    );
    expect(paritySpec).toContain(
      "stableBackdropShellSelector: paritySurfaces.cityEvents.shell"
    );
    expect(paritySpec).toContain("screenshotEntries.push([mode, screenshotCapture, screenshotPath])");
  });

  it("normalizes dynamic Street News before signatures and captures hosted first", () => {
    expect(paritySpec).toContain(
      "await Promise.all([\n            clearParityStreetNews(localPage),\n            clearParityStreetNews(serverPage)\n          ]);"
    );
    expect(paritySpec).toContain(
      "[\"hosted\", serverPage],\n      [\"local-demo\", localPage]"
    );
    expect(paritySpec).toContain("} while (!comparison.matches && attempt < 3);");
    expect(paritySpec).toContain("attempts: attempt");
    expect(paritySpec).toContain(
      'element.dataset.streetNewsRumorPublication = "paused";'
    );
    expect(paritySpec).toContain("await expect(feedItems).toHaveCount(0);");
    expect(paritySpec).toContain("await expect(emptyState).toBeVisible();");
    expect(eventRumorBridge).toContain(
      'root?.dataset?.streetNewsRumorPublication === "paused"'
    );
    expect(paritySpec).toContain(
      "acknowledgedServerMilestoneIds: [\"welcome\", \"first-purge\", \"lockdown\", \"winners\"]"
    );
    expect(hostedEntry).toContain("acknowledgedServerMilestoneIds = []");
    expect(hostedEntry).toContain("empire:server-milestone:seen:${encodeURIComponent(instanceId)}");
  });

  it("keeps tablet chat geometry independent from dynamic server copy", () => {
    expect(gameCss).toMatch(
      /@media \(min-width: 721px\) and \(max-width: 840px\) \{\s*html body\.game-body #global-chat-card\.right-panel-card \{\s*min-height: 164px;\s*height: 164px;\s*max-height: 164px;/u
    );
  });

  it("retries a real visible building-chip click across runtime rerenders", () => {
    expect(parityCapture).toContain("const clickDeadline = Date.now() + 5_000");
    expect(parityCapture).toContain("const canonicalBuildingTypeId = presentationDefinition?.buildingTypeId");
    expect(parityCapture).toContain("const resolveVisiblePointerTarget = () => page.evaluate");
    expect(parityCapture).toContain("document.querySelectorAll(shellSelector)");
    expect(parityCapture).toContain("await page.mouse.click(point.x, point.y)");
    expect(parityCapture).not.toContain("await page.mouse.down()");
    expect(parityCapture).not.toContain("await page.mouse.up()");
    expect(parityCapture).toContain("document.elementFromPoint(x, y)");
    expect(parityCapture).not.toContain("button.boundingBox()");
    expect(parityCapture).toContain("if (await openedBuildingSurface.isVisible().catch(() => false)) {");
    expect(parityCapture).toContain("await alignLocalStandardBuildingLayout()");
    expect(parityCapture).toContain("requestAnimationFrame(resolve)");
  });

  it("keeps the building-type filter debug-only without weakening the full matrix", () => {
    expect(paritySpec).toContain(
      "const selectedSpawnReachableBuildingParityMatrix = selectUiParityDebugBuildingMatrix("
    );
    expect(paritySpec).toContain(
      "spawnReachableBuildingParityMatrix.flatMap((entry) => entry.coveredBuildingTypeIds)"
    );
    expect(paritySpec).toContain(
      "for (const matrixEntry of selectedSpawnReachableBuildingParityMatrix)"
    );
    expect(localHostedRunner).toContain(
      "requires --suite=ui-parity as the only suite"
    );
    expect(localHostedRunner).toContain(
      "This is not a comprehensive parity gate."
    );
    expect(localHostedRunner).toContain(
      'name: "spawn-building-matrix-debug"'
    );
    expect(localHostedRunner).toContain(
      'grep: "live/demo spawn-reachable canonical building matrix"'
    );
  });

  it("rechecks the hosted population snapshot before local-demo opening", () => {
    const compareOpenBuilding = paritySpec.indexOf("async function compareOpenBuildingParity(");
    const serverOpen = paritySpec.indexOf(
      "await openBuildingFromDistrict(serverPage, buildingTypeId);",
      compareOpenBuilding
    );
    const stableCapture = paritySpec.indexOf(
      "await captureStableHostedPopulationParitySnapshot(",
      serverOpen
    );
    const serverRead = paritySpec.indexOf(
      "() => readOpenBuildingParity(serverPage, buildingTypeId)",
      stableCapture
    );
    const stableRead = paritySpec.indexOf(
      "const serverStats = stablePopulationCapture.hostedSnapshot;",
      serverRead
    );
    const localOpen = paritySpec.indexOf(
      "await openBuildingFromDistrict(localPage, buildingTypeId);",
      stableRead
    );

    expect(compareOpenBuilding).toBeGreaterThan(-1);
    expect(serverOpen).toBeGreaterThan(-1);
    expect(stableCapture).toBeGreaterThan(serverOpen);
    expect(serverRead).toBeGreaterThan(stableCapture);
    expect(stableRead).toBeGreaterThan(serverRead);
    expect(localOpen).toBeGreaterThan(stableRead);
    expect(parityCapture).toContain("PARITY_POPULATION_SNAPSHOT_MAX_ATTEMPTS = 3");
    expect(parityCapture).toContain("parityPopulationBufferSnapshotsMatch(");
  });

  it("neutralizes transient pointer state without discarding natural modal focus", () => {
    expect(parityCapture).toContain("export async function settleParityPointer(");
    expect(parityCapture).toContain("await settleParityPointer(page, locator);");
    expect(paritySpec).toContain("await settleParityPointer(page, shell);");
  });
});
