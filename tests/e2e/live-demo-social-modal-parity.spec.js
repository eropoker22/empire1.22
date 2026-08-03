import { expect, test } from "@playwright/test";
import {
  expectHostedUiParityClean,
  registerAndEnterHostedUiParityGame
} from "./helpers/hostedUiParityEntry.js";
import {
  compareParityPngScreenshots,
  openParityLocalDemo,
  PARITY_PNG_CHANNEL_TOLERANCE,
  syncParityLocalDemoMarketFromHosted
} from "./helpers/uiParityCapture.js";
import {
  captureSocialModalParityScreenshot,
  closeSocialModalParitySurface,
  exerciseSocialModalParityScroll,
  getSocialModalParitySignature,
  openSocialModalParitySurface,
  socialModalParitySurfaceNames,
  socialModalParitySurfaces,
  socialModalParityViewportBatches,
  socialModalParityViewports,
  validateSocialModalParityCoverage
} from "./helpers/socialModalParityContract.js";

const hostedEnabled = process.env.EMPIRE_HOSTED_UI_PARITY_E2E === "1";
const serverInstanceId = process.env.EMPIRE_UI_PARITY_SERVER_ID || "";
const coverageContract = validateSocialModalParityCoverage();
const selectedViewportBatchKeys = new Set(
  String(process.env.EMPIRE_UI_PARITY_SOCIAL_BATCH_KEYS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
);
const unknownViewportBatchKeys = [...selectedViewportBatchKeys].filter((key) => (
  !socialModalParityViewportBatches.some((batch) => batch.key === key)
));
if (unknownViewportBatchKeys.length > 0) {
  throw new Error(
    `Unknown social parity viewport batch keys: ${unknownViewportBatchKeys.join(", ")}.`
  );
}
const selectedViewportBatches = selectedViewportBatchKeys.size > 0
  ? socialModalParityViewportBatches.filter((batch) => selectedViewportBatchKeys.has(batch.key))
  : socialModalParityViewportBatches;

test.describe("live/demo social modal parity", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(
    !hostedEnabled || !serverInstanceId,
    "Set EMPIRE_HOSTED_UI_PARITY_E2E=1 and EMPIRE_UI_PARITY_SERVER_ID for hosted social modal parity."
  );
  test.setTimeout(240_000);

  let localContext;
  let hostedContext;
  let localPage;
  let hostedPage;
  let hostedEntry;
  const completedComparisons = [];

  test.beforeAll(async ({ browser }) => {
    const spawnDistrictIds = [
      "district:67",
      "district:92",
      "district:138",
      "district:152",
      "district:157",
      "district:68",
      "district:73",
      "district:94",
      "district:134",
      "district:139",
      "district:26",
      "district:42"
    ];
    for (let peerIndex = 0; peerIndex < 2; peerIndex += 1) {
      const peerContext = await browser.newContext({ viewport: socialModalParityViewports[0] });
      const peerPage = await peerContext.newPage();
      try {
        const peerEntry = await registerAndEnterHostedUiParityGame(peerPage, {
          serverInstanceId,
          spawnDistrictIds,
          identityPrefix: `ParitySocialPeer${peerIndex + 1}`
        });
        await expectHostedUiParityClean(peerPage, peerEntry.diagnostics);
      } finally {
        await peerContext.close();
      }
    }

    localContext = await browser.newContext({ viewport: socialModalParityViewports[0] });
    hostedContext = await browser.newContext({ viewport: socialModalParityViewports[0] });
    localPage = await localContext.newPage();
    hostedPage = await hostedContext.newPage();
    hostedEntry = await registerAndEnterHostedUiParityGame(hostedPage, {
      serverInstanceId,
      spawnDistrictIds,
      identityPrefix: "ParitySocialMain"
    });
    await expect.poll(() => hostedPage.evaluate(() => {
      const readModel = window.EmpireGameplaySliceClient?.getCurrentReadModel?.()
        || window.empireStreetsGameplaySliceReadModel
        || null;
      return (readModel?.bounty?.eligibleTargets || []).filter((target) => target?.canTarget !== false).length;
    }), {
      message: "The real hosted peer must become a visible Bounty target.",
      timeout: 30_000
    }).toBeGreaterThan(0);
    const hostedPresentationState = await hostedPage.evaluate(() => {
      const readModel = window.EmpireGameplaySliceClient?.getCurrentReadModel?.()
        || window.empireStreetsGameplaySliceReadModel
        || null;
      const offerWindowId = String(readModel?.market?.normalMarket?.offerWindowId || "0:day");
      const [dayIndexPart, offerPhase] = offerWindowId.split(":");
      const cityClock = readModel?.player?.cityEvents?.cityClock || {};
      return {
        bountyDemoTargets: Array.isArray(readModel?.bounty?.eligibleTargets)
          ? readModel.bounty.eligibleTargets
          : [],
        mapPhase: readModel?.player?.dayNight?.phaseId === "night" ? "night" : "day",
        marketCityDayIndex: Math.max(
          0,
          Number.isFinite(Number(cityClock.dayIndex))
            ? Number(cityClock.dayIndex)
            : Number.parseInt(dayIndexPart || "0", 10) || 0
        ),
        marketCityMinutes: Number.isFinite(Number(cityClock.minuteOfDay))
          ? Number(cityClock.minuteOfDay)
          : offerPhase === "evening" ? 20 * 60 : 12 * 60
      };
    });
    const sharedDistrictId = Number(String(hostedEntry.spawnDistrictId).replace(/^district:/u, ""));
    await openParityLocalDemo(localPage, {
      bountyDemoTargets: hostedPresentationState.bountyDemoTargets,
      mapPhase: hostedPresentationState.mapPhase,
      marketCityDayIndex: hostedPresentationState.marketCityDayIndex,
      marketCityMinutes: hostedPresentationState.marketCityMinutes,
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

  for (const viewportBatch of selectedViewportBatches) {
    for (const surfaceName of socialModalParitySurfaceNames) {
      test(`${viewportBatch.key} ${surfaceName} keeps demo DOM, styles, bounds, focus, scroll and pixels`, async ({}, testInfo) => {
        testInfo.annotations.push(
          {
            type: "viewport-batch",
            description: `${viewportBatch.key}: ${viewportBatch.viewports.map(({ name }) => name).join(", ")}`
          },
          {
            type: "hosted-entry",
            description: "Two hosted browser entries are reused while the real pages resize across the canonical matrix."
          },
          {
            type: "visible-trigger",
            description: `${surfaceName} opens and closes through visible game.html controls.`
          },
          {
            type: "mask-contract",
            description: "Only authoritative value leaves are masked; shells, sections, collections, controls and layout remain compared."
          }
        );

        for (const viewport of viewportBatch.viewports) {
          await Promise.all([
            localPage.setViewportSize(viewport),
            hostedPage.setViewportSize(viewport)
          ]);
          if (surfaceName === "market") {
            await syncParityLocalDemoMarketFromHosted(localPage, hostedPage);
          }
          await Promise.all([
            openSocialModalParitySurface(localPage, surfaceName),
            openSocialModalParitySurface(hostedPage, surfaceName)
          ]);

          try {
            const [localSignature, hostedSignature] = await Promise.all([
              getSocialModalParitySignature(localPage, surfaceName),
              getSocialModalParitySignature(hostedPage, surfaceName)
            ]);
            expect(
              hostedSignature,
              `${viewport.name} ${surfaceName} normalized DOM, sections, classes, computed styles, bounds and focus`
            ).toEqual(localSignature);

            const [localScroll, hostedScroll] = await Promise.all([
              exerciseSocialModalParityScroll(localPage, surfaceName),
              exerciseSocialModalParityScroll(hostedPage, surfaceName)
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
              captureSocialModalParityScreenshot(localPage, {
                path: localScreenshotPath,
                surfaceName
              }),
              captureSocialModalParityScreenshot(hostedPage, {
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
              testInfo.attach(`${surfaceName}--local-demo--${viewport.name}.png`, {
                contentType: "image/png",
                path: localScreenshotPath
              }),
              testInfo.attach(`${surfaceName}--hosted--${viewport.name}.png`, {
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
          } finally {
            const [localCloseFocus, hostedCloseFocus] = await Promise.all([
              closeSocialModalParitySurface(localPage, surfaceName),
              closeSocialModalParitySurface(hostedPage, surfaceName)
            ]);
            expect(hostedCloseFocus, `${viewport.name} ${surfaceName} close-focus behavior`)
              .toEqual(localCloseFocus);
            expect(localCloseFocus.restoredToTrigger).toBe(
              socialModalParitySurfaces[surfaceName].expectedFocusRestore
            );
          }
        }
      });
    }
  }

  test("social modal parity coverage guard is complete", async ({}, testInfo) => {
    const expectedComparisons = selectedViewportBatches.flatMap(({ viewports }) => (
      socialModalParitySurfaceNames.flatMap((surfaceName) => (
        viewports.map((viewport) => `${viewport.name}:${surfaceName}`)
      ))
    ));
    expect(completedComparisons).toEqual(expectedComparisons);
    expect(coverageContract).toMatchObject({
      batchCount: socialModalParityViewportBatches.length,
      comparisonCount: socialModalParitySurfaceNames.length * socialModalParityViewports.length,
      surfaceNames: socialModalParitySurfaceNames,
      viewportNames: socialModalParityViewports.map(({ name }) => name)
    });
    await expectHostedUiParityClean(hostedPage, hostedEntry.diagnostics);
    await testInfo.attach("social-modal-parity-coverage.json", {
      body: Buffer.from(`${JSON.stringify({
        authoritativeLeafMaskingOnly: true,
        completedComparisons,
        hostedAccountsCreated: 3,
        hostedEntry: "two-real-accounts-registration-lobby-visible-spawn-faction-game",
        localDemoAuthority: true,
        meaningfulPixelTolerance: 0,
        selectedViewportBatchKeys: selectedViewportBatches.map(({ key }) => key),
        surfaceNames: socialModalParitySurfaceNames,
        viewportBatches: selectedViewportBatches
      }, null, 2)}\n`, "utf8"),
      contentType: "application/json"
    });
  });
});
