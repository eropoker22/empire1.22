import { expect, test } from "@playwright/test";
import {
  expectHostedUiParityClean,
  registerAndEnterHostedUiParityGame
} from "./helpers/hostedUiParityEntry.js";
import {
  compareParityPngScreenshots,
  openParityLocalDemo,
  PARITY_PNG_CHANNEL_TOLERANCE
} from "./helpers/uiParityCapture.js";
import {
  captureUtilityParityScreenshot,
  closeUtilityParitySurface,
  exerciseUtilityParitySurfaceScroll,
  getUtilityParitySurfaceSignature,
  openUtilityParitySurface,
  utilityParitySurfaceNames,
  utilityParityViewportBatches,
  utilityParityViewports,
  validateUtilityParityCoverage
} from "./helpers/utilityModalParity.js";

const hostedEnabled = process.env.EMPIRE_HOSTED_UI_PARITY_E2E === "1";
const serverInstanceId = process.env.EMPIRE_UI_PARITY_SERVER_ID || "";
const coverageContract = validateUtilityParityCoverage();

test.describe("live/demo utility modal parity", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(
    !hostedEnabled || !serverInstanceId,
    "Set EMPIRE_HOSTED_UI_PARITY_E2E=1 and EMPIRE_UI_PARITY_SERVER_ID for hosted utility parity."
  );
  test.setTimeout(240_000);

  let localContext;
  let hostedContext;
  let localPage;
  let hostedPage;
  let hostedEntry;
  const completedComparisons = [];

  test.beforeAll(async ({ browser }) => {
    const initialViewport = utilityParityViewports[0];
    localContext = await browser.newContext({ viewport: initialViewport });
    hostedContext = await browser.newContext({ viewport: initialViewport });
    localPage = await localContext.newPage();
    hostedPage = await hostedContext.newPage();
    hostedEntry = await registerAndEnterHostedUiParityGame(hostedPage, {
      serverInstanceId,
      spawnDistrictIds: [
        "district:152",
        "district:157",
        "district:26",
        "district:42",
        "district:67",
        "district:92",
        "district:138"
      ],
      identityPrefix: "ParityUtility"
    });
    const hostedMapPhase = await hostedPage.evaluate(() => {
      const readModel = window.EmpireGameplaySliceClient?.getCurrentReadModel?.()
        || window.empireStreetsGameplaySliceReadModel
        || null;
      return readModel?.player?.dayNight?.phaseId === "night" ? "night" : "day";
    });
    const sharedDistrictId = Number(
      String(hostedEntry.spawnDistrictId).replace(/^district:/u, "")
    );
    await openParityLocalDemo(localPage, {
      mapPhase: hostedMapPhase,
      ownedDistrictIds: [sharedDistrictId],
      startDistrictId: sharedDistrictId
    });
  });

  test.afterAll(async () => {
    await Promise.all([
      localContext?.close(),
      hostedContext?.close()
    ].filter(Boolean));
  });

  for (const viewportBatch of utilityParityViewportBatches) {
    for (const surfaceName of utilityParitySurfaceNames) {
      test(`${viewportBatch.key} ${surfaceName} keeps shared DOM, styles, bounds, focus, scroll and pixels`, async ({}, testInfo) => {
        testInfo.annotations.push(
          {
            type: "viewport-batch",
            description: `${viewportBatch.key}: ${viewportBatch.viewports.map(({ name }) => name).join(", ")}`
          },
          {
            type: "local-demo-state",
            description: "Local demo enters game.html through the browser localStorage presentation helper."
          },
          {
            type: "hosted-entry",
            description: "One hosted player entry is reused while both real pages are resized across the canonical matrix."
          },
          {
            type: "visible-trigger",
            description: `${surfaceName} opens through the visible game.html control; onboarding opens from Settings.`
          },
          {
            type: "mask-contract",
            description: "Only authoritative leaf values are masked; shells, sections, collections, controls and layout remain compared."
          }
        );

        for (const viewport of viewportBatch.viewports) {
          await Promise.all([
            localPage.setViewportSize(viewport),
            hostedPage.setViewportSize(viewport)
          ]);
          await Promise.all([
            openUtilityParitySurface(localPage, surfaceName),
            openUtilityParitySurface(hostedPage, surfaceName)
          ]);

          try {
            const [localSignature, hostedSignature] = await Promise.all([
              getUtilityParitySurfaceSignature(localPage, surfaceName),
              getUtilityParitySurfaceSignature(hostedPage, surfaceName)
            ]);
            expect(
              hostedSignature,
              `${viewport.name} ${surfaceName} normalized DOM, section order, classes, styles, bounds and focus`
            ).toEqual(localSignature);

            const [localScroll, hostedScroll] = await Promise.all([
              exerciseUtilityParitySurfaceScroll(localPage, surfaceName),
              exerciseUtilityParitySurfaceScroll(hostedPage, surfaceName)
            ]);
            expect(
              hostedScroll,
              `${viewport.name} ${surfaceName} scroll availability, extent and reset behavior`
            ).toEqual(localScroll);

            const localScreenshotPath = testInfo.outputPath(
              `${surfaceName}--local-demo--${viewport.name}.png`
            );
            const hostedScreenshotPath = testInfo.outputPath(
              `${surfaceName}--hosted--${viewport.name}.png`
            );
            const [localCapture, hostedCapture] = await Promise.all([
              captureUtilityParityScreenshot(localPage, {
                path: localScreenshotPath,
                surfaceName
              }),
              captureUtilityParityScreenshot(hostedPage, {
                path: hostedScreenshotPath,
                surfaceName
              })
            ]);
            await Promise.all([
              testInfo.attach(`${surfaceName}--local-demo--${viewport.name}.png`, {
                contentType: "image/png",
                path: localScreenshotPath
              }),
              testInfo.attach(`${surfaceName}--hosted--${viewport.name}.png`, {
                contentType: "image/png",
                path: hostedScreenshotPath
              })
            ]);
            const screenshotComparison = compareParityPngScreenshots(
              hostedCapture.screenshot,
              localCapture.screenshot,
              {
                channelTolerance: PARITY_PNG_CHANNEL_TOLERANCE,
                ignoreRegions: [
                  ...hostedCapture.ignoreRegions,
                  ...localCapture.ignoreRegions
                ]
              }
            );
            await testInfo.attach(`${surfaceName}--${viewport.name}--png-diff.json`, {
              body: Buffer.from(`${JSON.stringify(screenshotComparison, null, 2)}\n`, "utf8"),
              contentType: "application/json"
            });
            expect(screenshotComparison.dimensionsEqual).toBe(true);
            expect(
              screenshotComparison.meaningfulPixelCount,
              `${viewport.name} ${surfaceName} must have zero meaningful pixels outside authoritative leaves`
            ).toBe(0);
            expect(screenshotComparison.matches).toBe(true);
            completedComparisons.push(`${viewport.name}:${surfaceName}`);
          } finally {
            await Promise.all([
              closeUtilityParitySurface(localPage, surfaceName),
              closeUtilityParitySurface(hostedPage, surfaceName)
            ]);
          }
        }
      });
    }
  }

  test("utility parity coverage guard is complete", async ({}, testInfo) => {
    const expectedComparisons = utilityParityViewportBatches.flatMap(({ viewports }) => (
      utilityParitySurfaceNames.flatMap((surfaceName) => (
        viewports.map((viewport) => `${viewport.name}:${surfaceName}`)
      ))
    ));
    expect(completedComparisons).toEqual(expectedComparisons);
    expect(coverageContract).toMatchObject({
      batchCount: utilityParityViewportBatches.length,
      comparisonCount: utilityParitySurfaceNames.length * utilityParityViewports.length,
      surfaceNames: utilityParitySurfaceNames,
      viewportNames: utilityParityViewports.map(({ name }) => name)
    });
    await expectHostedUiParityClean(hostedPage, hostedEntry.diagnostics);
    await testInfo.attach("utility-modal-parity-coverage.json", {
      body: Buffer.from(`${JSON.stringify({
        authoritativeLeafMaskingOnly: true,
        completedComparisons,
        expectedSurfaces: utilityParitySurfaceNames,
        hostedAccountsCreated: 1,
        hostedEntry: "registration-lobby-visible-spawn-faction-game",
        localDemoEntry: "game.html-local-demo-browser-state",
        meaningfulPixelTolerance: 0,
        viewportBatches: utilityParityViewportBatches
      }, null, 2)}\n`, "utf8"),
      contentType: "application/json"
    });
  });
});
