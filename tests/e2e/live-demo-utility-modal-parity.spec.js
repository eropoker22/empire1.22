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
  applyUtilityParityCanonicalContent,
  captureUtilityParityScreenshot,
  closeUtilityParitySurface,
  exerciseUtilityParitySurfaceScroll,
  getUtilityParitySurfaceSignature,
  openUtilityParitySurface,
  restoreUtilityParityCanonicalContent,
  utilityParitySurfaceNames,
  utilityParityViewportBatches,
  utilityParityViewports,
  validateUtilityParityCoverage
} from "./helpers/utilityModalParity.js";

const hostedEnabled = process.env.EMPIRE_HOSTED_UI_PARITY_E2E === "1";
const serverInstanceId = process.env.EMPIRE_UI_PARITY_SERVER_ID || "";
const coverageContract = validateUtilityParityCoverage();

const UTILITY_CANONICAL_TEXT = "<authoritative>";
const UTILITY_CANONICAL_REGISTRY = "__empireUtilityParityCanonicalContentRegistry";

async function flushUtilityCanonicalContentObserver(page) {
  await page.evaluate(() => new Promise((resolve) => (
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  )));
}

test.describe("live/demo utility modal parity canonical lock behavior", () => {
  test("restores latest text and attributes across empty and replaced leaves", async ({ page }) => {
    await page.setContent(`
      <section class="player-popup-card" data-player-popup-card style="display:block;width:320px;height:240px">
        <img data-player-popup-avatar alt="Original avatar" style="display:block;width:48px;height:48px">
        <h3 data-player-popup-name>Original name</h3>
        <strong data-player-popup-identity>Original identity</strong>
        <strong data-player-popup-gang></strong>
      </section>
    `);

    const state = await applyUtilityParityCanonicalContent(page, "profile");
    await expect(page.locator("[data-player-popup-name]")).toHaveText(UTILITY_CANONICAL_TEXT);
    await expect(page.locator("[data-player-popup-identity]")).toHaveText(UTILITY_CANONICAL_TEXT);
    await expect(page.locator("[data-player-popup-gang]")).toHaveText(UTILITY_CANONICAL_TEXT);
    await expect(page.locator("[data-player-popup-avatar]")).toHaveAttribute(
      "alt",
      UTILITY_CANONICAL_TEXT
    );

    await page.evaluate(() => {
      document.querySelector("[data-player-popup-identity]").textContent = "Latest identity";
      document.querySelector("[data-player-popup-gang]").textContent = "Latest gang";
      document.querySelector("[data-player-popup-avatar]").setAttribute("alt", "Latest avatar");
    });
    await flushUtilityCanonicalContentObserver(page);
    await expect(page.locator("[data-player-popup-identity]")).toHaveText(UTILITY_CANONICAL_TEXT);
    await expect(page.locator("[data-player-popup-gang]")).toHaveText(UTILITY_CANONICAL_TEXT);
    await expect(page.locator("[data-player-popup-avatar]")).toHaveAttribute(
      "alt",
      UTILITY_CANONICAL_TEXT
    );

    await page.locator("[data-player-popup-name]").evaluate((element) => {
      const replacement = element.cloneNode(false);
      replacement.textContent = "Replacement name";
      element.replaceWith(replacement);
    });
    await flushUtilityCanonicalContentObserver(page);
    await expect(page.locator("[data-player-popup-name]")).toHaveText(UTILITY_CANONICAL_TEXT);

    await restoreUtilityParityCanonicalContent(page, "profile", state);
    await expect(page.locator("[data-player-popup-name]")).toHaveText("Replacement name");
    await expect(page.locator("[data-player-popup-identity]")).toHaveText("Latest identity");
    await expect(page.locator("[data-player-popup-gang]")).toHaveText("Latest gang");
    await expect(page.locator("[data-player-popup-avatar]")).toHaveAttribute(
      "alt",
      "Latest avatar"
    );
    expect(await page.evaluate((registryProperty) => (
      globalThis[registryProperty] === undefined
    ), UTILITY_CANONICAL_REGISTRY)).toBe(true);
  });

  test("rolls back partial apply and rejects a disconnected capture target", async ({ page }) => {
    await page.setContent(`
      <section class="player-popup-card" data-player-popup-card style="display:block;width:320px;height:240px"></section>
    `);
    const applyError = await applyUtilityParityCanonicalContent(page, "profile")
      .then(() => null, (error) => error);
    expect(applyError).toBeInstanceOf(Error);
    expect(String(applyError?.message || "")).toMatch(/matched no elements/u);
    expect(await page.evaluate((registryProperty) => (
      globalThis[registryProperty] === undefined
    ), UTILITY_CANONICAL_REGISTRY)).toBe(true);

    await page.setContent(`
      <section class="player-popup-card" data-player-popup-card style="display:block;width:320px;height:240px">
        <h3 data-player-popup-name>Original name</h3>
      </section>
    `);
    const state = await applyUtilityParityCanonicalContent(page, "profile");
    await page.locator(".player-popup-card").evaluate((element) => {
      element.replaceWith(element.cloneNode(true));
    });
    const restoreError = await restoreUtilityParityCanonicalContent(page, "profile", state)
      .then(() => null, (error) => error);
    expect(restoreError).toBeInstanceOf(Error);
    expect(String(restoreError?.message || "")).toMatch(/disconnected before restore/u);
    expect(await page.evaluate((registryProperty) => (
      globalThis[registryProperty] === undefined
    ), UTILITY_CANONICAL_REGISTRY)).toBe(true);
    const missingCaptureError = await restoreUtilityParityCanonicalContent(
      page,
      "profile",
      state
    ).then(() => null, (error) => error);
    expect(missingCaptureError).toBeInstanceOf(Error);
    expect(String(missingCaptureError?.message || "")).toMatch(/capture token is missing/u);
  });
});

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
      gangColor: hostedEntry.gangColor,
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

          let localCanonicalContentState = null;
          let hostedCanonicalContentState = null;
          let primaryFailure = null;
          try {
            const canonicalContentApplyResults = await Promise.all([
              applyUtilityParityCanonicalContent(localPage, surfaceName).then(
                (value) => ({ status: "fulfilled", value }),
                (reason) => ({ reason, status: "rejected" })
              ),
              applyUtilityParityCanonicalContent(hostedPage, surfaceName).then(
                (value) => ({ status: "fulfilled", value }),
                (reason) => ({ reason, status: "rejected" })
              )
            ]);
            if (canonicalContentApplyResults[0].status === "fulfilled") {
              localCanonicalContentState = canonicalContentApplyResults[0].value;
            }
            if (canonicalContentApplyResults[1].status === "fulfilled") {
              hostedCanonicalContentState = canonicalContentApplyResults[1].value;
            }
            const canonicalContentApplyFailure = canonicalContentApplyResults
              .find((result) => result.status === "rejected");
            if (canonicalContentApplyFailure) throw canonicalContentApplyFailure.reason;
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

            const localAttachmentName = `${surfaceName}--local-demo--${viewport.name}.png`;
            const hostedAttachmentName = `${surfaceName}--hosted--${viewport.name}.png`;
            const localScreenshotPath = testInfo.outputPath(localAttachmentName);
            const hostedScreenshotPath = testInfo.outputPath(hostedAttachmentName);
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
            await Promise.all([
              testInfo.attach(localAttachmentName, {
                contentType: "image/png",
                path: localScreenshotPath
              }),
              testInfo.attach(hostedAttachmentName, {
                contentType: "image/png",
                path: hostedScreenshotPath
              }),
              testInfo.attach(`${surfaceName}--${viewport.name}--png-diff.json`, {
                body: Buffer.from(`${JSON.stringify(screenshotComparison, null, 2)}\n`, "utf8"),
                contentType: "application/json"
              })
            ]);
            expect(screenshotComparison.dimensionsEqual).toBe(true);
            expect(
              screenshotComparison.meaningfulPixelCount,
              `${viewport.name} ${surfaceName} must have zero meaningful pixels outside authoritative leaves`
            ).toBe(0);
            expect(screenshotComparison.matches).toBe(true);
            completedComparisons.push(`${viewport.name}:${surfaceName}`);
          } catch (error) {
            primaryFailure = error;
            throw error;
          } finally {
            const restorationResults = await Promise.allSettled([
              localCanonicalContentState
                ? restoreUtilityParityCanonicalContent(
                    localPage,
                    surfaceName,
                    localCanonicalContentState
                  )
                : Promise.resolve(),
              hostedCanonicalContentState
                ? restoreUtilityParityCanonicalContent(
                    hostedPage,
                    surfaceName,
                    hostedCanonicalContentState
                  )
                : Promise.resolve()
            ]);
            const closeResults = await Promise.allSettled([
              closeUtilityParitySurface(localPage, surfaceName),
              closeUtilityParitySurface(hostedPage, surfaceName)
            ]);
            const cleanupFailure = [...restorationResults, ...closeResults]
              .find((result) => result.status === "rejected");
            if (cleanupFailure && !primaryFailure) throw cleanupFailure.reason;
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
