import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import {
  expectHostedUiParityClean,
  loginAndResumeHostedUiParityGame
} from "./helpers/hostedUiParityEntry.js";
import {
  closeSurface,
  expectNoDuplicateVisibleUi,
  getBuildingPresentationSignature,
  getParityDomStructureSignature,
  openBuildingFromDistrict,
  openDistrictById,
  openParityLocalDemo,
  paritySurfaces,
  parityViewports,
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
const desktopScreenshotViewportName = "desktop-1440x900";

test.use({ trace: "on", video: "off" });

test.describe("fixture-backed hosted non-spawn canonical building parity", () => {
  test.skip(
    !hostedEnabled || !serverInstanceId || !identity,
    "Non-spawn parity needs the guarded fixture server and its ready player."
  );
  test.setTimeout(1_200_000);

  test("matches all ten non-spawn cards at every canonical viewport", async ({
    browser
  }, testInfo) => {
    testInfo.annotations.push({
      type: "fixture",
      description: "PostgreSQL worker scenario building-parity-non-spawn"
    });
    expect(parityViewports).toHaveLength(10);
    expect(
      matrix.flatMap((entry) => entry.coveredBuildingTypeIds).sort()
    ).toEqual(expectedBuildingTypeIds);
    expect(new Set(matrix.map((entry) => entry.districtId)).size).toBe(matrix.length);

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

      const ownedDistrictIds = matrix.map((matrixEntry) => (
        Number(matrixEntry.districtId.replace(/^district:/u, ""))
      ));
      await openParityLocalDemo(localPage, {
        ownedDistrictIds,
        startDistrictId: ownedDistrictIds[0],
        mapPhase: hostedState.mapPhase
      });

      for (const viewport of parityViewports) {
        await localPage.setViewportSize(viewport);
        await serverPage.setViewportSize(viewport);
        for (const matrixEntry of matrix) {
          await openDistrictById(localPage, matrixEntry.districtId);
          await openDistrictById(serverPage, matrixEntry.districtId);
          const expectedDistrictBuildingTypeIds = [
            ...matrixEntry.expectedDistrictBuildingTypeIds
          ].sort();
          expect(
            await readDistrictBuildingTypeIds(localPage),
            `${matrixEntry.key} local building registry`
          ).toEqual(expectedDistrictBuildingTypeIds);
          expect(
            await readDistrictBuildingTypeIds(serverPage),
            `${matrixEntry.key} authoritative building registry`
          ).toEqual(expectedDistrictBuildingTypeIds);

          for (const buildingTypeId of matrixEntry.coveredBuildingTypeIds) {
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
              surfaceName
            );
            const hostedStructure = await getParityDomStructureSignature(
              serverPage,
              surfaceName
            );

            expect(
              hostedPresentation,
              `${buildingTypeId}/${viewport.name} visible presentation`
            ).toEqual(localPresentation);
            expect(
              hostedStructure,
              `${buildingTypeId}/${viewport.name} normalized DOM, classes, styles and bounds`
            ).toEqual(localStructure);

            if (viewport.name === desktopScreenshotViewportName) {
              await attachBuildingScreenshotPair({
                buildingTypeId,
                localPage,
                serverPage,
                surfaceName,
                testInfo,
                viewportName: viewport.name
              });
            }
            coverage.push({
              buildingTypeId,
              districtId: matrixEntry.districtId,
              structure: "PASS",
              viewport: viewport.name
            });
            await closeSurface(localPage, surfaceName);
            await closeSurface(serverPage, surfaceName);
          }

          await closeSurface(localPage, "district");
          await closeSurface(serverPage, "district");
        }
      }

      expect(coverage).toHaveLength(expectedBuildingTypeIds.length * parityViewports.length);
      expect(
        new Set(coverage.map((result) => `${result.buildingTypeId}/${result.viewport}`)).size
      ).toBe(coverage.length);
      expect(
        entry.diagnostics.submitRequests,
        "Non-spawn parity is an opening-only visible flow"
      ).toEqual([]);
      await expectNoDuplicateVisibleUi(serverPage);
      await expectHostedUiParityClean(serverPage, entry.diagnostics);
      await testInfo.attach("non-spawn-building-parity-coverage.json", {
        body: Buffer.from(`${JSON.stringify({
          fixtureScenario: "building-parity-non-spawn",
          buildingTypeIds: expectedBuildingTypeIds,
          comparisons: coverage.length,
          screenshots: expectedBuildingTypeIds.length * 2,
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
});

async function readDistrictBuildingTypeIds(page) {
  return page.locator("[data-district-building-name]").evaluateAll((chips) => chips
    .map((chip) => String(chip.dataset.districtBuildingType || "").trim())
    .filter(Boolean)
    .sort());
}

async function attachBuildingScreenshotPair({
  buildingTypeId,
  localPage,
  serverPage,
  surfaceName,
  testInfo,
  viewportName
}) {
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
    await page.locator(`${paritySurfaces[surfaceName].shell}:visible`).last().screenshot({
      path: screenshotPath,
      animations: "disabled",
      caret: "hide"
    });
    await testInfo.attach(attachmentName, {
      path: screenshotPath,
      contentType: "image/png"
    });
  }
}
