import { expect, test } from "@playwright/test";
import {
  expectHostedUiParityClean,
  loginAndResumeHostedUiParityGame
} from "./helpers/hostedUiParityEntry.js";
import {
  compareParityPngScreenshots,
  PARITY_PNG_CHANNEL_TOLERANCE
} from "./helpers/uiParityCapture.js";
import {
  applyDistrictActionOverlayCanonicalLayoutText,
  captureDistrictActionOverlayScreenshot,
  closeDistrictActionParitySurfaces,
  districtActionOverlayDefinitions,
  districtActionOverlayNames,
  districtActionOverlayParityViewportBatches,
  districtActionOverlayParityViewports,
  districtActionOverlayScenarioEvidence,
  exerciseDistrictActionOverlayFocus,
  exerciseDistrictActionOverlayScroll,
  getDistrictActionOverlayPresentationSignature,
  openDistrictActionOverlayFromVisibleUi,
  openLocalDemoDistrictActionParityRole,
  restoreDistrictActionOverlayCanonicalLayoutText,
  validateDistrictActionOverlayParityCoverage
} from "./helpers/districtActionOverlayParity.js";

const hostedEnabled = process.env.EMPIRE_HOSTED_UI_PARITY_E2E === "1";
const serverInstanceId = process.env.EMPIRE_UI_PARITY_SERVER_ID || "";
const identities = parseIdentities(process.env.EMPIRE_HOSTED_BOOTSTRAP_IDENTITIES_JSON);
const coverageContract = validateDistrictActionOverlayParityCoverage();

test.describe("fixture-backed live/demo district action overlay parity", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(
    !hostedEnabled || !serverInstanceId || identities.length !== 3,
    "District action overlay parity requires the guarded three-player multiplayer-core harness."
  );
  test.setTimeout(300_000);

  const hostedClients = new Map();
  const localClients = new Map();
  const contexts = [];
  const completedComparisons = [];

  test.beforeAll(async ({ browser }) => {
    const initialViewport = districtActionOverlayParityViewports[0];
    const sortedIdentities = [...identities].sort((left, right) => (
      left.username.localeCompare(right.username)
    ));
    const hostedRoles = ["creator", "target", "hunter"];
    for (let index = 0; index < hostedRoles.length; index += 1) {
      const context = await browser.newContext({
        baseURL: process.env.PLAYWRIGHT_E2E_BASE_URL,
        viewport: initialViewport
      });
      contexts.push(context);
      const page = await context.newPage();
      page.setDefaultTimeout(20_000);
      const entry = await loginAndResumeHostedUiParityGame(page, sortedIdentities[index]);
      hostedClients.set(hostedRoles[index], { entry, page });
    }

    const hostedMapPhase = await hostedClients.get("creator").page.evaluate(() => {
      const readModel = window.EmpireGameplaySliceClient?.getCurrentReadModel?.()
        || window.empireStreetsGameplaySliceReadModel
        || null;
      return readModel?.player?.dayNight?.phaseId === "night" ? "night" : "day";
    });
    for (const localRole of ["creator", "occupier", "attacker"]) {
      const context = await browser.newContext({
        baseURL: process.env.PLAYWRIGHT_E2E_BASE_URL,
        viewport: initialViewport
      });
      contexts.push(context);
      const page = await context.newPage();
      page.setDefaultTimeout(20_000);
      await openLocalDemoDistrictActionParityRole(page, localRole, {
        mapPhase: hostedMapPhase
      });
      localClients.set(localRole, { page });
    }
  });

  test.afterAll(async () => {
    await Promise.allSettled(contexts.map((context) => context.close()));
  });

  for (const viewportBatch of districtActionOverlayParityViewportBatches) {
    for (const surfaceName of districtActionOverlayNames) {
      test(`${viewportBatch.key} ${surfaceName} keeps DOM, classes, styles, bounds, focus, scroll and pixels`, async ({}, testInfo) => {
        const definition = districtActionOverlayDefinitions[surfaceName];
        const localPage = localClients.get(definition.localRole).page;
        const hostedPage = hostedClients.get(definition.hostedRole).page;
        testInfo.annotations.push(
          {
            type: "viewport-batch",
            description: `${viewportBatch.key}: ${viewportBatch.viewports.map(({ name }) => name).join(", ")}`
          },
          {
            type: "hosted-entry",
            description: districtActionOverlayScenarioEvidence.hostedEntry
          },
          {
            type: "scenario-setup",
            description: districtActionOverlayScenarioEvidence.hostedScenario
          },
          {
            type: "state-boundary",
            description: districtActionOverlayScenarioEvidence.stateBoundary
          },
          {
            type: "result-surface",
            description: districtActionOverlayScenarioEvidence.resultSurface
          },
          {
            type: "visible-trigger",
            description: "Both modes use a real canvas click and the visible district action control."
          },
          {
            type: "mask-contract",
            description: "Only authoritative leaf values are masked; shells, rows, controls, classes and layout remain compared."
          }
        );

        for (const viewport of viewportBatch.viewports) {
          await Promise.all([
            localPage.setViewportSize(viewport),
            hostedPage.setViewportSize(viewport)
          ]);
          await Promise.all([
            openDistrictActionOverlayFromVisibleUi(localPage, surfaceName, { authority: "local-demo" }),
            openDistrictActionOverlayFromVisibleUi(hostedPage, surfaceName, { authority: "hosted" })
          ]);

          let localCanonicalLayoutTextState = null;
          let hostedCanonicalLayoutTextState = null;
          let primaryFailure = null;
          try {
            localCanonicalLayoutTextState =
              await applyDistrictActionOverlayCanonicalLayoutText(localPage, surfaceName);
            hostedCanonicalLayoutTextState =
              await applyDistrictActionOverlayCanonicalLayoutText(hostedPage, surfaceName);
            const [localSignature, hostedSignature] = await Promise.all([
              getDistrictActionOverlayPresentationSignature(localPage, surfaceName),
              getDistrictActionOverlayPresentationSignature(hostedPage, surfaceName)
            ]);
            expect(
              hostedSignature,
              `${viewport.name} ${surfaceName} normalized presentation contract`
            ).toEqual(localSignature);

            const [localFocus, hostedFocus] = await Promise.all([
              exerciseDistrictActionOverlayFocus(localPage, surfaceName),
              exerciseDistrictActionOverlayFocus(hostedPage, surfaceName)
            ]);
            expect(hostedFocus, `${viewport.name} ${surfaceName} focus traversal`).toEqual(localFocus);

            const [localScroll, hostedScroll] = await Promise.all([
              exerciseDistrictActionOverlayScroll(localPage, surfaceName),
              exerciseDistrictActionOverlayScroll(hostedPage, surfaceName)
            ]);
            expect(hostedScroll, `${viewport.name} ${surfaceName} scroll behavior`).toEqual(localScroll);

            const localScreenshotPath = testInfo.outputPath(
              `${surfaceName}--local-demo--${viewport.name}.png`
            );
            const hostedScreenshotPath = testInfo.outputPath(
              `${surfaceName}--hosted--${viewport.name}.png`
            );
            const [localCapture, hostedCapture] = await Promise.all([
              captureDistrictActionOverlayScreenshot(localPage, {
                path: localScreenshotPath,
                surfaceName
              }),
              captureDistrictActionOverlayScreenshot(hostedPage, {
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
              `${viewport.name} ${surfaceName} must have zero meaningful pixels outside dynamic leaves`
            ).toBe(0);
            expect(screenshotComparison.matches).toBe(true);
            completedComparisons.push(`${viewport.name}:${surfaceName}`);
          } catch (error) {
            primaryFailure = error;
            throw error;
          } finally {
            const restorationResults = await Promise.allSettled([
              localCanonicalLayoutTextState
                ? restoreDistrictActionOverlayCanonicalLayoutText(
                    localPage,
                    surfaceName,
                    localCanonicalLayoutTextState
                  )
                : Promise.resolve(),
              hostedCanonicalLayoutTextState
                ? restoreDistrictActionOverlayCanonicalLayoutText(
                    hostedPage,
                    surfaceName,
                    hostedCanonicalLayoutTextState
                  )
                : Promise.resolve()
            ]);
            const closeResults = await Promise.allSettled([
              closeDistrictActionParitySurfaces(localPage),
              closeDistrictActionParitySurfaces(hostedPage)
            ]);
            const cleanupFailure = [...restorationResults, ...closeResults]
              .find((result) => result.status === "rejected");
            if (cleanupFailure && !primaryFailure) throw cleanupFailure.reason;
          }
        }
      });
    }
  }

  test("district action overlay parity coverage guard is complete", async ({}, testInfo) => {
    const expectedComparisons = districtActionOverlayParityViewportBatches.flatMap(({ viewports }) => (
      districtActionOverlayNames.flatMap((surfaceName) => (
        viewports.map((viewport) => `${viewport.name}:${surfaceName}`)
      ))
    ));
    expect(completedComparisons).toEqual(expectedComparisons);
    expect(coverageContract).toMatchObject({
      actionIds: ["spy", "rob", "heist", "attack", "occupy"],
      batchCount: districtActionOverlayParityViewportBatches.length,
      comparisonCount: districtActionOverlayNames.length
        * districtActionOverlayParityViewports.length,
      surfaceNames: districtActionOverlayNames,
      viewportNames: districtActionOverlayParityViewports.map(({ name }) => name)
    });
    for (const { entry, page } of hostedClients.values()) {
      await expectHostedUiParityClean(page, entry.diagnostics);
    }
    await testInfo.attach("district-action-overlay-contract.json", {
      body: Buffer.from(`${JSON.stringify({
        ...coverageContract,
        evidence: districtActionOverlayScenarioEvidence,
        hostedEntriesReused: hostedClients.size,
        viewportBatches: districtActionOverlayParityViewportBatches
      }, null, 2)}\n`, "utf8"),
      contentType: "application/json"
    });
  });
});

function parseIdentities(value) {
  if (!value) return [];
  const parsed = JSON.parse(value);
  expect(Array.isArray(parsed)).toBe(true);
  for (const identity of parsed) {
    expect(identity).toMatchObject({
      username: expect.any(String),
      gangName: expect.any(String),
      password: expect.any(String),
      networkIdentifier: expect.any(String)
    });
  }
  return parsed;
}
