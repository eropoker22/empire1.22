import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import {
  expectHostedUiParityClean,
  loginAndResumeHostedUiParityGame
} from "./helpers/hostedUiParityEntry.js";
import {
  captureIsolatedParityScreenshot,
  closeSurface,
  compareParityPngScreenshots,
  exerciseParitySurfaceScroll,
  expectNoDuplicateVisibleUi,
  getBuildingPresentationSignature,
  getParityDomStructureSignature,
  openBuildingFromDistrict,
  openDistrictById,
  openParityLocalDemo,
  PARITY_PNG_CHANNEL_TOLERANCE,
  paritySurfaces,
  parityViewports,
  readVisibleDistrictBuildingTypeIds,
  resolveBuildingParitySurfaceName
} from "./helpers/uiParityCapture.js";

const hostedEnabled = process.env.EMPIRE_HOSTED_UI_PARITY_E2E === "1";
const serverInstanceId = process.env.EMPIRE_UI_PARITY_SERVER_ID || "";
const identity = process.env.EMPIRE_HOSTED_BOOTSTRAP_USERNAME
  ? {
      username: process.env.EMPIRE_HOSTED_BOOTSTRAP_USERNAME,
      password: process.env.EMPIRE_HOSTED_BOOTSTRAP_PASSWORD,
      networkIdentifier: process.env.EMPIRE_HOSTED_BOOTSTRAP_NETWORK_IDENTIFIER
    }
  : null;
const matrix = JSON.parse(readFileSync(
  new URL("../../tools/seed/hosted-building-parity-non-spawn-matrix.json", import.meta.url),
  "utf8"
));
const selectedMatrixKeys = new Set(
  String(process.env.EMPIRE_UI_PARITY_NON_SPAWN_KEYS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
);
const unknownMatrixKeys = [...selectedMatrixKeys].filter((key) => (
  !matrix.some((entry) => entry.key === key)
));
if (unknownMatrixKeys.length > 0) {
  throw new Error(`Unknown non-spawn parity matrix keys: ${unknownMatrixKeys.join(", ")}.`);
}
const selectedMatrix = selectedMatrixKeys.size > 0
  ? matrix.filter((entry) => selectedMatrixKeys.has(entry.key))
  : matrix;
const parityOwnedDistrictIds = Object.freeze(
  matrix.map((entry) => Number(String(entry.districtId).replace(/^district:/u, "")))
);
const expectedBuildingTypeIds = Object.freeze([
  "airport",
  "casino",
  "central_bank",
  "city_hall",
  "court",
  "lobby_club",
  "parliament",
  "port",
  "stock_exchange",
  "vip_lounge"
]);
const normalizeAuthorityDynamicPresentation = (presentation) => {
  const normalizeText = (value) => String(value || "").replace(
    /^(Vliv\s+)[+-]?[\d.,]+(?=\/den$)/u,
    "$1<dynamic>"
  );
  return {
    ...presentation,
    effects: presentation.effects.map(normalizeText),
    visibleCopy: presentation.visibleCopy.map(normalizeText)
  };
};
const authorityDynamicTextSelector = "[data-building-dynamic-effect='influence']";
test.use({ trace: "on", video: "off" });

test.describe("fixture-backed hosted non-spawn canonical building parity", () => {
  test.describe.configure({ mode: "parallel" });
  test.skip(
    !hostedEnabled || !serverInstanceId || !identity,
    "Non-spawn parity needs the guarded fixture server and its ready player."
  );
  test.setTimeout(1_200_000);

  test("declares complete non-spawn matrix coverage", async () => {
    expect(parityViewports).toHaveLength(10);
    expect(
      matrix.flatMap((entry) => entry.coveredBuildingTypeIds).sort()
    ).toEqual(expectedBuildingTypeIds);
    expect(new Set(matrix.map((entry) => entry.districtId)).size).toBe(matrix.length);
    await test.info().attach("non-spawn-building-parity-matrix-contract.json", {
      body: Buffer.from(`${JSON.stringify({
        fixtureScenario: "building-parity-non-spawn",
        buildingTypeIds: expectedBuildingTypeIds,
        channelTolerance: PARITY_PNG_CHANNEL_TOLERANCE,
        comparisons: expectedBuildingTypeIds.length * parityViewports.length,
        maxMeaningfulPixels: 0,
        matrixEntries: matrix.map((entry) => ({
          buildingTypeIds: entry.coveredBuildingTypeIds,
          districtId: entry.districtId,
          key: entry.key
        })),
        pixelEqualityAsserted: false,
        pixelParityAsserted: true,
        screenshots: expectedBuildingTypeIds.length * parityViewports.length * 2,
        viewports: parityViewports.map((viewport) => viewport.name)
      }, null, 2)}\n`, "utf8"),
      contentType: "application/json"
    });
  });

  for (const matrixEntry of selectedMatrix) {
    test(`${matrixEntry.key} matches its non-spawn cards at every canonical viewport`, async ({
      browser
    }, testInfo) => {
      testInfo.annotations.push({
        type: "fixture",
        description: `PostgreSQL worker scenario building-parity-non-spawn/${matrixEntry.key}`
      });
      const contextOptions = {
        baseURL: process.env.PLAYWRIGHT_E2E_BASE_URL,
        viewport: parityViewports[0]
      };
      const localContext = await browser.newContext(contextOptions);
      const serverContext = await browser.newContext(contextOptions);
      const localPage = await localContext.newPage();
      const serverPage = await serverContext.newPage();
      const coverage = [];
      try {
        const entry = await loginAndResumeHostedUiParityGame(serverPage, identity);
        const hostedState = await serverPage.evaluate(() => {
          const readModel = window.EmpireGameplaySliceClient?.getCurrentReadModel?.()
            || window.empireStreetsGameplaySliceReadModel
            || null;
          return {
            mapPhase: readModel?.player?.dayNight?.phaseId || null,
            serverInstanceId: readModel?.server?.serverInstanceId || null
          };
        });
        expect(hostedState.serverInstanceId).toBe(serverInstanceId);
        expect(hostedState.mapPhase).toBe("day");

        const ownedDistrictId = Number(matrixEntry.districtId.replace(/^district:/u, ""));
        await openParityLocalDemo(localPage, {
          ownedDistrictIds: parityOwnedDistrictIds,
          startDistrictId: ownedDistrictId,
          mapPhase: hostedState.mapPhase
        });

        for (const viewport of parityViewports) {
          await localPage.setViewportSize(viewport);
          await serverPage.setViewportSize(viewport);
          await openDistrictById(localPage, matrixEntry.districtId);
          await openDistrictById(serverPage, matrixEntry.districtId);
          const expectedDistrictBuildingTypeIds = [
            ...matrixEntry.expectedDistrictBuildingTypeIds
          ].sort();
          await expect(
            localPage.locator(`${paritySurfaces.district.shell}:visible`).last()
              .locator("[data-district-building-name]"),
            `${matrixEntry.key} local building card count`
          ).toHaveCount(expectedDistrictBuildingTypeIds.length);
          await expect.poll(
            () => readVisibleDistrictBuildingTypeIds(serverPage),
            { message: `${matrixEntry.key} authoritative building registry` }
          ).toEqual(expectedDistrictBuildingTypeIds);

          for (const buildingTypeId of matrixEntry.coveredBuildingTypeIds) {
            await openDistrictById(localPage, matrixEntry.districtId);
            await openDistrictById(serverPage, matrixEntry.districtId);
            await openBuildingFromDistrict(localPage, buildingTypeId);
            await openBuildingFromDistrict(serverPage, buildingTypeId);
            const surfaceName = resolveBuildingParitySurfaceName(buildingTypeId);
            expect(surfaceName, buildingTypeId).toBe("buildingDetail");
            const localPresentation = await getBuildingPresentationSignature(
              localPage,
              surfaceName
            );
            const hostedPresentation = await getBuildingPresentationSignature(
              serverPage,
              surfaceName
            );
            const localStructure = await getParityDomStructureSignature(
              localPage,
              surfaceName,
              { additionalDynamicTextSelector: authorityDynamicTextSelector }
            );
            const hostedStructure = await getParityDomStructureSignature(
              serverPage,
              surfaceName,
              { additionalDynamicTextSelector: authorityDynamicTextSelector }
            );

            expect(
              normalizeAuthorityDynamicPresentation(hostedPresentation),
              `${buildingTypeId}/${viewport.name} visible presentation`
            ).toEqual(normalizeAuthorityDynamicPresentation(localPresentation));
            expect(
              hostedStructure,
              `${buildingTypeId}/${viewport.name} normalized DOM, classes, styles and bounds`
            ).toEqual(localStructure);
            expect(
              localStructure.focus.activeElement?.insideSurface,
              `${buildingTypeId}/${viewport.name} local-demo natural focus`
            ).toBe(true);
            expect(
              hostedStructure.focus.activeElement?.insideSurface,
              `${buildingTypeId}/${viewport.name} hosted natural focus`
            ).toBe(true);
            const localScroll = await exerciseParitySurfaceScroll(localPage, surfaceName);
            const hostedScroll = await exerciseParitySurfaceScroll(serverPage, surfaceName);
            expect(
              hostedScroll,
              `${buildingTypeId}/${viewport.name} scroll behavior`
            ).toEqual(localScroll);
            expect(localScroll.resetTop).toBe(true);
            expect(hostedScroll.resetTop).toBe(true);
            if (localScroll.available) {
              expect(localScroll.reachedBottom).toBe(true);
              expect(hostedScroll.reachedBottom).toBe(true);
            }

            const screenshotComparison = await attachBuildingScreenshotPair({
              buildingTypeId,
              localPage,
              serverPage,
              surfaceName,
              testInfo,
              viewportName: viewport.name
            });
            coverage.push({
              buildingTypeId,
              districtId: matrixEntry.districtId,
              screenshotClaim: "ZERO_MEANINGFUL_PIXELS_PASS",
              screenshotComparison,
              structure: "PASS",
              viewport: viewport.name
            });
            await closeSurface(localPage, surfaceName);
            await closeSurface(serverPage, surfaceName);
          }

          await closeSurface(localPage, "district");
          await closeSurface(serverPage, "district");
        }

        expect(coverage).toHaveLength(
          matrixEntry.coveredBuildingTypeIds.length * parityViewports.length
        );
        expect(
          new Set(coverage.map((result) => `${result.buildingTypeId}/${result.viewport}`)).size
        ).toBe(coverage.length);
        expect(
          entry.diagnostics.submitRequests,
          `${matrixEntry.key} is an opening-only visible flow`
        ).toEqual([]);
        await expectNoDuplicateVisibleUi(serverPage);
        await expectHostedUiParityClean(serverPage, entry.diagnostics);
        await testInfo.attach(`${matrixEntry.key}-non-spawn-building-parity-coverage.json`, {
          body: Buffer.from(`${JSON.stringify({
            fixtureScenario: "building-parity-non-spawn",
            matrixKey: matrixEntry.key,
            districtId: matrixEntry.districtId,
            buildingTypeIds: matrixEntry.coveredBuildingTypeIds,
            channelTolerance: PARITY_PNG_CHANNEL_TOLERANCE,
            comparisons: coverage.length,
            maxMeaningfulPixels: 0,
            pixelEqualityAsserted: false,
            pixelParityAsserted: true,
            screenshots: matrixEntry.coveredBuildingTypeIds.length * parityViewports.length * 2,
            viewports: parityViewports.map((viewport) => viewport.name),
            coverage
          }, null, 2)}\n`, "utf8"),
          contentType: "application/json"
        });
      } finally {
        await Promise.allSettled([
          localContext.close(),
          serverContext.close()
        ]);
      }
    });
  }
});

async function attachBuildingScreenshotPair({
  buildingTypeId,
  localPage,
  serverPage,
  surfaceName,
  testInfo,
  viewportName
}) {
  const screenshotEntries = [];
  for (const [mode, page] of [
    ["local-demo", localPage],
    ["hosted", serverPage]
  ]) {
    const attachmentName = [
      "non-spawn-building",
      buildingTypeId,
      mode,
      viewportName
    ].join("--") + ".png";
    const screenshotPath = testInfo.outputPath(attachmentName);
    const surface = page.locator(`${paritySurfaces[surfaceName].selector}:visible`).last();
    const target = surface.locator(".district-building-detail-card").first();
    const dynamicContentSelector = [
      "[data-production-progress]",
      "[data-production-countdown]",
      "[data-countdown]",
      "[data-district-building-detail-effects]",
      "time"
    ].join(",");
    const screenshotCapture = await captureIsolatedParityScreenshot(page, {
      ignoreSelector: dynamicContentSelector,
      path: screenshotPath,
      stableBackdropShellSelector: paritySurfaces[surfaceName].shell,
      target
    });
    await testInfo.attach(attachmentName, {
      path: screenshotPath,
      contentType: "image/png"
    });
    screenshotEntries.push([mode, screenshotCapture]);
  }
  const screenshotCaptures = new Map(screenshotEntries);
  const serverCapture = screenshotCaptures.get("hosted");
  const localCapture = screenshotCaptures.get("local-demo");
  const comparison = compareParityPngScreenshots(
    serverCapture.screenshot,
    localCapture.screenshot,
    {
      ignoreRegions: [
        ...serverCapture.ignoreRegions,
        ...localCapture.ignoreRegions
      ]
    }
  );
  await testInfo.attach(
    `non-spawn-building--${buildingTypeId}--${viewportName}--png-diff.json`,
    {
      body: Buffer.from(`${JSON.stringify(comparison, null, 2)}\n`, "utf8"),
      contentType: "application/json"
    }
  );
  expect(comparison, `${buildingTypeId} ${viewportName} PNG channel parity`).toMatchObject({
    dimensionsEqual: true,
    matches: true,
    meaningfulPixelCount: 0
  });
  return comparison;
}
