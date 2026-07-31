import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import {
  publicBuildingDefinitions
} from "../../packages/game-config/src/public/building-definitions.ts";
import {
  resolveBuildingPresentationDefinition
} from "../../page-assets/js/app/runtime/buildingPresentationContract.js";
import {
  createDistrictBuildingProfileRuntime
} from "../../page-assets/js/app/runtime/districtBuildingProfileRuntime.js";
import {
  DISTRICT_BUILDING_PACKAGE_POOLS,
  DISTRICT_FIXED_BUILDING_PACKAGES_BY_DISTRICT_ID,
  DOWNTOWN_FIXED_BUILDING_PACKAGES_BY_DISTRICT_ID
} from "../../page-assets/js/data/districtPools.js";
import { DISTRICT_BUILDING_TYPE_META } from "../../page-assets/js/data/buildings.js";
import {
  DISTRICT_TYPE_GRID,
  remapDistrictId,
  remapDistrictType
} from "../../page-assets/js/app/map/mapGeometry.js";
import { clamp, hashCell } from "../../page-assets/js/app/runtime/utils.js";
import {
  expectHostedUiParityClean,
  registerAndEnterHostedUiParityGame
} from "./helpers/hostedUiParityEntry.js";
import {
  captureParitySurface,
  captureGameChromeScreenshot,
  closeSurface,
  expectNoDuplicateVisibleUi,
  getBuildingPresentationSignature,
  getGameChromeSignature,
  getParityDomStructureSignature,
  getParitySurfaceSignature,
  getProductionPresentationSignature,
  getVisibleTechnicalBuildingText,
  openBuildingFromDistrict,
  openCityEvents,
  openDistrictById,
  openFirstCityEventDetail,
  openParityLocalDemo,
  openProductionShortcut,
  parityCaptureViewports,
  paritySurfaces,
  parityViewports,
  resolveBuildingParitySurfaceName,
  selectProductionBuildingTab
} from "./helpers/uiParityCapture.js";

const captureEnabled = process.env.EMPIRE_CAPTURE_UI_PARITY_BASELINE === "1";
const hostedEnabled = process.env.EMPIRE_HOSTED_UI_PARITY_E2E === "1";
const serverInstanceId = process.env.EMPIRE_UI_PARITY_SERVER_ID || "";
const productionBuildingTypeIds = new Set(["pharmacy", "drug_lab", "factory", "armory"]);
const sortedBuildingTypeIds = (values) => Array.from(new Set(values)).sort();
const canonicalBuildingTypeIds = Object.freeze(
  publicBuildingDefinitions.map((definition) => definition.buildingTypeId)
);
const parityMapManifest = JSON.parse(readFileSync(
  new URL("../../packages/game-config/src/maps/empire-streets-city-map.json", import.meta.url),
  "utf8"
));
const parityDistrictProfileRuntime = createDistrictBuildingProfileRuntime({
  clamp,
  currentPlayerId: 1,
  defaultDistrictType: "resident",
  districtBuildingPackagePools: DISTRICT_BUILDING_PACKAGE_POOLS,
  districtBuildingTypeMeta: DISTRICT_BUILDING_TYPE_META,
  districtTypeGrid: DISTRICT_TYPE_GRID,
  districtFixedPackagesByDistrictId: DISTRICT_FIXED_BUILDING_PACKAGES_BY_DISTRICT_ID,
  downtownDistrictType: "downtown",
  downtownFixedPackagesByDistrictId: DOWNTOWN_FIXED_BUILDING_PACKAGES_BY_DISTRICT_ID,
  getCurrentPlayerOwnedDistrictIds: () => new Set(),
  getEffectiveOwnedDistrictIds: () => new Set(),
  getResolvedSpyIntel: () => ({ revealedTypeDistrictIds: [] }),
  hashCell,
  remapDistrictId,
  remapDistrictType,
  startPhaseOwnerByDistrictId: new Map(),
  variantNamesByBaseName: {},
  backgroundImagesByBaseName: {}
});
const parityDistrictById = new Map(
  parityDistrictProfileRuntime.getDistrictResourceCatalog()
    .map((district) => [Number(district.id), district])
);
const buildingTypeIdByLocalBaseName = new Map(
  canonicalBuildingTypeIds.map((buildingTypeId) => [
    resolveBuildingPresentationDefinition(buildingTypeId).baseName,
    buildingTypeId
  ])
);
const resolveParityDistrictBuildingTypeIds = (districtId) => {
  const numericDistrictId = Number(String(districtId || "").match(/\d+/u)?.[0] || 0);
  const district = parityDistrictById.get(numericDistrictId);
  const profile = parityDistrictProfileRuntime.resolveDistrictBuildingProfile(district);
  return (profile?.buildings || []).map((building) => (
    buildingTypeIdByLocalBaseName.get(building.baseName)
  )).filter(Boolean);
};
const spawnReachableBuildingTypeIds = sortedBuildingTypeIds(
  parityMapManifest.districts
    .filter((district) => district.isSpawnCandidate)
    .flatMap((district) => resolveParityDistrictBuildingTypeIds(district.id))
);
const nonSpawnBrowserGapTypeIds = canonicalBuildingTypeIds
  .filter((buildingTypeId) => !spawnReachableBuildingTypeIds.includes(buildingTypeId))
  .sort();

const spawnReachableBuildingParityMatrix = Object.freeze([
  Object.freeze({
    key: "park-night-cover",
    districtIds: Object.freeze(["district:2", "district:20", "district:116"]),
    expectedDistrictBuildingTypeIds: Object.freeze(["strip_club", "convenience_store"]),
    coveredBuildingTypeIds: Object.freeze(["strip_club", "convenience_store"])
  }),
  Object.freeze({
    key: "industrial-recycle",
    districtIds: Object.freeze([
      "district:3",
      "district:73",
      "district:114",
      "district:139",
      "district:149",
      "district:155"
    ]),
    expectedDistrictBuildingTypeIds: Object.freeze(["factory", "recycling_center"]),
    coveredBuildingTypeIds: Object.freeze(["factory", "recycling_center"])
  }),
  Object.freeze({
    key: "residential-arcade-garage",
    districtIds: Object.freeze(["district:4", "district:142", "district:154"]),
    expectedDistrictBuildingTypeIds: Object.freeze(["apartment_block", "arcade", "garage"]),
    coveredBuildingTypeIds: Object.freeze(["apartment_block", "arcade", "garage"])
  }),
  Object.freeze({
    key: "industrial-power",
    districtIds: Object.freeze(["district:23", "district:94", "district:144", "district:161"]),
    expectedDistrictBuildingTypeIds: Object.freeze(["factory", "power_station"]),
    coveredBuildingTypeIds: Object.freeze(["power_station"])
  }),
  Object.freeze({
    key: "park-distribution",
    districtIds: Object.freeze([
      "district:27",
      "district:45",
      "district:47",
      "district:118",
      "district:156"
    ]),
    expectedDistrictBuildingTypeIds: Object.freeze(["street_dealers", "smuggling_tunnel"]),
    coveredBuildingTypeIds: Object.freeze(["street_dealers", "smuggling_tunnel"])
  }),
  Object.freeze({
    key: "industrial-armory-warehouse",
    districtIds: Object.freeze(["district:50", "district:70"]),
    expectedDistrictBuildingTypeIds: Object.freeze(["armory", "warehouse"]),
    coveredBuildingTypeIds: Object.freeze(["armory", "warehouse"])
  }),
  Object.freeze({
    key: "residential-recovery",
    districtIds: Object.freeze(["district:65", "district:71"]),
    expectedDistrictBuildingTypeIds: Object.freeze(["recruitment_center", "clinic"]),
    coveredBuildingTypeIds: Object.freeze(["recruitment_center", "clinic"])
  }),
  Object.freeze({
    key: "commercial-mall-pharmacy",
    districtIds: Object.freeze(["district:67", "district:92"]),
    expectedDistrictBuildingTypeIds: Object.freeze(["shopping_mall", "pharmacy", "restaurant"]),
    coveredBuildingTypeIds: Object.freeze(["shopping_mall", "pharmacy", "restaurant"])
  }),
  Object.freeze({
    key: "residential-school",
    districtIds: Object.freeze(["district:90", "district:96"]),
    expectedDistrictBuildingTypeIds: Object.freeze(["arcade", "school"]),
    coveredBuildingTypeIds: Object.freeze(["school"])
  }),
  Object.freeze({
    key: "park-drug-lab",
    districtIds: Object.freeze(["district:91"]),
    expectedDistrictBuildingTypeIds: Object.freeze(["drug_lab", "convenience_store"]),
    coveredBuildingTypeIds: Object.freeze(["drug_lab"])
  }),
  Object.freeze({
    key: "commercial-mobility-exchange",
    districtIds: Object.freeze(["district:95"]),
    expectedDistrictBuildingTypeIds: Object.freeze(["car_dealer", "exchange"]),
    coveredBuildingTypeIds: Object.freeze(["car_dealer", "exchange"])
  }),
  Object.freeze({
    key: "commercial-fitness",
    districtIds: Object.freeze(["district:120", "district:140"]),
    expectedDistrictBuildingTypeIds: Object.freeze(["restaurant", "fitness_club"]),
    coveredBuildingTypeIds: Object.freeze(["fitness_club"])
  })
]);

async function readDistrictBuildingTypeIds(page) {
  return page.locator("[data-district-building-name]").evaluateAll((chips) => chips
    .map((chip) => String(chip.dataset.districtBuildingType || "").trim())
    .filter(Boolean)
    .sort());
}

async function focusOpenBuildingSurface(shell) {
  const focusTarget = shell.locator([
    "button:visible:not([disabled])",
    "a[href]:visible",
    "input:visible:not([disabled])",
    "[role='button']:visible:not([aria-disabled='true'])",
    "[role='tab']:visible:not([aria-disabled='true'])"
  ].join(",")).first();
  await expect(focusTarget).toBeVisible();
  await focusTarget.focus();
  await expect(focusTarget).toBeFocused();
}

async function readOpenBuildingParity(page, buildingTypeId) {
  const surfaceName = resolveBuildingParitySurfaceName(buildingTypeId);
  const shell = page.locator(`${paritySurfaces[surfaceName].shell}:visible`).last();
  await expect(shell).toBeVisible({ timeout: 30_000 });
  if (productionBuildingTypeIds.has(buildingTypeId)) {
    await expect(shell.locator(".production-recipe-card--loading")).toHaveCount(0, {
      timeout: 30_000
    });
    await selectProductionBuildingTab(page, surfaceName, "stats");
    await focusOpenBuildingSurface(shell);
    return {
      surfaceName,
      presentation: await getProductionPresentationSignature(page, surfaceName),
      structure: await getParityDomStructureSignature(page, surfaceName),
      technicalText: await getVisibleTechnicalBuildingText(page, surfaceName)
    };
  }
  await focusOpenBuildingSurface(shell);
  return {
    surfaceName,
    presentation: await getBuildingPresentationSignature(page, surfaceName),
    structure: await getParityDomStructureSignature(page, surfaceName),
    technicalText: await getVisibleTechnicalBuildingText(page, surfaceName)
  };
}

async function attachOpenBuildingScreenshot({
  page,
  testInfo,
  surfaceName,
  buildingTypeId,
  mode,
  viewportName,
  panelName
}) {
  const attachmentName = [
    "building",
    buildingTypeId,
    mode,
    viewportName,
    panelName
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

async function attachOpenBuildingScreenshotPair({
  localPage,
  serverPage,
  testInfo,
  surfaceName,
  buildingTypeId,
  viewportName,
  panelName
}) {
  await attachOpenBuildingScreenshot({
    page: localPage,
    testInfo,
    surfaceName,
    buildingTypeId,
    mode: "local-demo",
    viewportName,
    panelName
  });
  await attachOpenBuildingScreenshot({
    page: serverPage,
    testInfo,
    surfaceName,
    buildingTypeId,
    mode: "hosted",
    viewportName,
    panelName
  });
}

async function attachGameChromeScreenshotPair({
  localPage,
  serverPage,
  testInfo,
  viewportName
}) {
  for (const [mode, page] of [
    ["local-demo", localPage],
    ["hosted", serverPage]
  ]) {
    const attachmentName = `game-chrome--${mode}--${viewportName}.png`;
    const screenshotPath = testInfo.outputPath(attachmentName);
    await captureGameChromeScreenshot(page, screenshotPath);
    await testInfo.attach(attachmentName, {
      path: screenshotPath,
      contentType: "image/png"
    });
  }
}

async function compareOpenBuildingParity(
  localPage,
  serverPage,
  buildingTypeId,
  screenshotAttachment = null
) {
  await openBuildingFromDistrict(localPage, buildingTypeId);
  await openBuildingFromDistrict(serverPage, buildingTypeId);
  const localStats = await readOpenBuildingParity(localPage, buildingTypeId);
  const serverStats = await readOpenBuildingParity(serverPage, buildingTypeId);

  expect(serverStats.surfaceName, buildingTypeId).toBe(localStats.surfaceName);
  expect(serverStats.presentation, `${buildingTypeId} presentation`).toEqual(
    localStats.presentation
  );
  expect(serverStats.structure, `${buildingTypeId} structure and bounds`).toEqual(
    localStats.structure
  );
  expect(
    localStats.technicalText,
    `${buildingTypeId} local-demo card must not expose technical server internals`
  ).toEqual([]);
  expect(
    serverStats.technicalText,
    `${buildingTypeId} hosted card must not expose SERVER, projection or revision internals`
  ).toEqual([]);

  if (screenshotAttachment) {
    await attachOpenBuildingScreenshotPair({
      localPage,
      serverPage,
      testInfo: screenshotAttachment.testInfo,
      surfaceName: localStats.surfaceName,
      buildingTypeId,
      viewportName: screenshotAttachment.viewportName,
      panelName: productionBuildingTypeIds.has(buildingTypeId) ? "stats" : "detail"
    });
  }

  if (productionBuildingTypeIds.has(buildingTypeId)) {
    await selectProductionBuildingTab(localPage, localStats.surfaceName, "info");
    await selectProductionBuildingTab(serverPage, serverStats.surfaceName, "info");
    expect(
      await getProductionPresentationSignature(serverPage, serverStats.surfaceName),
      `${buildingTypeId} info presentation`
    ).toEqual(
      await getProductionPresentationSignature(localPage, localStats.surfaceName)
    );
    expect(
      await getParityDomStructureSignature(serverPage, serverStats.surfaceName),
      `${buildingTypeId} info structure and bounds`
    ).toEqual(
      await getParityDomStructureSignature(localPage, localStats.surfaceName)
    );
    expect(
      await getVisibleTechnicalBuildingText(localPage, localStats.surfaceName),
      `${buildingTypeId} local-demo info tab must not expose technical server internals`
    ).toEqual([]);
    expect(
      await getVisibleTechnicalBuildingText(serverPage, serverStats.surfaceName),
      `${buildingTypeId} hosted info tab must not expose SERVER, projection or revision internals`
    ).toEqual([]);
    if (screenshotAttachment) {
      await attachOpenBuildingScreenshotPair({
        localPage,
        serverPage,
        testInfo: screenshotAttachment.testInfo,
        surfaceName: localStats.surfaceName,
        buildingTypeId,
        viewportName: screenshotAttachment.viewportName,
        panelName: "info"
      });
    }
  }

  await closeSurface(localPage, localStats.surfaceName);
  await closeSurface(serverPage, serverStats.surfaceName);
}

test.describe("canonical building parity coverage contract", () => {
  test("declares every spawn-reachable public type and the honest browser gaps", () => {
    const plannedBuildingTypeIds = sortedBuildingTypeIds(
      spawnReachableBuildingParityMatrix.flatMap((entry) => entry.coveredBuildingTypeIds)
    );

    expect(new Set(canonicalBuildingTypeIds).size).toBe(publicBuildingDefinitions.length);
    expect(plannedBuildingTypeIds).toEqual(spawnReachableBuildingTypeIds);
    expect(sortedBuildingTypeIds([
      ...plannedBuildingTypeIds,
      ...nonSpawnBrowserGapTypeIds
    ])).toEqual(sortedBuildingTypeIds(canonicalBuildingTypeIds));
    expect(parityViewports.map(({ width, height }) => `${width}x${height}`)).toEqual([
      "1440x900",
      "390x844",
      "320x568",
      "360x800",
      "430x932",
      "768x1024",
      "820x1180",
      "1024x768",
      "1366x768",
      "1920x1080"
    ]);
    expect(nonSpawnBrowserGapTypeIds).toEqual([
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

    for (const entry of spawnReachableBuildingParityMatrix) {
      for (const districtId of entry.districtIds) {
        const district = parityMapManifest.districts.find(
          (candidate) => candidate.id === districtId
        );
        expect(district?.isSpawnCandidate, districtId).toBe(true);
        expect(
          sortedBuildingTypeIds(resolveParityDistrictBuildingTypeIds(districtId)),
          districtId
        ).toEqual(sortedBuildingTypeIds(entry.expectedDistrictBuildingTypeIds));
      }
    }
  });
});

test.describe("live/demo UI parity baseline", () => {
  test.skip(!captureEnabled, "Set EMPIRE_CAPTURE_UI_PARITY_BASELINE=1 to create baseline artifacts.");
  test.setTimeout(360_000);

  test("captures explicit local-demo reference surfaces", async ({ page }) => {
    await openParityLocalDemo(page, {
      ownedDistrictIds: [21, 24, 66, 68],
      startDistrictId: 21
    });
    for (const viewport of parityCaptureViewports) {
      await page.setViewportSize(viewport);
      await openDistrictById(page, "district:21");
      await captureParitySurface(page, {
        mode: "local-demo",
        phase: "baseline",
        viewport,
        surfaceName: "district"
      });
      await openBuildingFromDistrict(page, "restaurant");
      await expect(page.locator("[data-district-building-detail-popup]:not([hidden])")).toBeVisible();
      await captureParitySurface(page, {
        mode: "local-demo",
        phase: "baseline",
        viewport,
        surfaceName: "restaurant"
      });
      await closeSurface(page, "restaurant");
      await closeSurface(page, "district");

      await openDistrictById(page, "district:24");
      await openBuildingFromDistrict(page, "arcade");
      const arcadePresentation = await getBuildingPresentationSignature(page, "arcade");
      await captureParitySurface(page, {
        mode: "local-demo",
        phase: "baseline",
        viewport,
        surfaceName: "arcade"
      });
      expect(arcadePresentation.actionGrid.columnCount).toBe(viewport.width >= 721 ? 2 : 1);
      expect(arcadePresentation.actionGrid.rowCount).toBe(viewport.width >= 721 ? 1 : 2);
      await closeSurface(page, "arcade");
      await closeSurface(page, "district");

      for (const type of ["pharmacy", "drugLab", "factory", "armory"]) {
        await openProductionShortcut(page, type);
        await captureParitySurface(page, {
          mode: "local-demo",
          phase: "baseline",
          viewport,
          surfaceName: type
        });
        await closeSurface(page, type);
      }

      await openCityEvents(page);
      await captureParitySurface(page, {
        mode: "local-demo",
        phase: "baseline",
        viewport,
        surfaceName: "cityEvents"
      });
      await openFirstCityEventDetail(page);
      await captureParitySurface(page, {
        mode: "local-demo",
        phase: "baseline",
        viewport,
        surfaceName: "cityEventDetail"
      });
      await closeSurface(page, "cityEventDetail");
      await closeSurface(page, "cityEvents");
    }
  });

  test.describe("hosted server-authoritative reference", () => {
    test.skip(!hostedEnabled || !serverInstanceId, "Hosted parity capture requires the local PostgreSQL/API/worker server.");

    test("captures commercial district, Restaurant, Pharmacy and City Events", async ({ page }) => {
      const entry = await registerAndEnterHostedUiParityGame(page, {
        serverInstanceId,
        spawnDistrictIds: [
          "district:26",
          "district:42",
          "district:138",
          "district:152",
          "district:157"
        ],
        identityPrefix: "ParityCom"
      });
      for (const viewport of parityCaptureViewports) {
        await page.setViewportSize(viewport);
        await openDistrictById(page, entry.spawnDistrictId);
        await captureParitySurface(page, {
          mode: "server-authoritative",
          phase: "baseline",
          viewport,
          surfaceName: "district"
        });
        await openBuildingFromDistrict(page, "restaurant");
        await expect(page.locator("[data-district-building-detail-popup]:not([hidden])")).toBeVisible({ timeout: 30_000 });
        await captureParitySurface(page, {
          mode: "server-authoritative",
          phase: "baseline",
          viewport,
          surfaceName: "restaurant"
        });
        await closeSurface(page, "restaurant");
        await closeSurface(page, "district");
        await openProductionShortcut(page, "pharmacy");
        await captureParitySurface(page, {
          mode: "server-authoritative",
          phase: "baseline",
          viewport,
          surfaceName: "pharmacy"
        });
        await closeSurface(page, "pharmacy");
        await openCityEvents(page);
        await captureParitySurface(page, {
          mode: "server-authoritative",
          phase: "baseline",
          viewport,
          surfaceName: "cityEvents"
        });
        const unlockedOffer = page.locator("#events-tasklist [data-event-open]").first();
        await page.locator(".events-agent").first().click();
        if (await unlockedOffer.isVisible().catch(() => false)) {
          await openFirstCityEventDetail(page);
          await captureParitySurface(page, {
            mode: "server-authoritative",
            phase: "baseline",
            viewport,
            surfaceName: "cityEventDetail"
          });
          await closeSurface(page, "cityEventDetail");
        }
        await closeSurface(page, "cityEvents");
      }
    });

    test("captures Drug Lab", async ({ page }) => {
      await registerAndEnterHostedUiParityGame(page, {
        serverInstanceId,
        spawnDistrictIds: [
          "district:56",
          "district:58",
          "district:63",
          "district:91",
          "district:100",
          "district:106",
          "district:125"
        ],
        identityPrefix: "ParityPark"
      });
      for (const viewport of parityCaptureViewports) {
        await page.setViewportSize(viewport);
        await openProductionShortcut(page, "drugLab");
        await captureParitySurface(page, {
          mode: "server-authoritative",
          phase: "baseline",
          viewport,
          surfaceName: "drugLab"
        });
        await closeSurface(page, "drugLab");
      }
    });

    test("captures Factory and Armory", async ({ page }) => {
      await registerAndEnterHostedUiParityGame(page, {
        serverInstanceId,
        spawnDistrictIds: [
          "district:68",
          "district:73",
          "district:94",
          "district:134",
          "district:139",
          "district:161"
        ],
        identityPrefix: "ParityInd"
      });
      for (const viewport of parityCaptureViewports) {
        await page.setViewportSize(viewport);
        for (const type of ["factory", "armory"]) {
          await openProductionShortcut(page, type);
          await captureParitySurface(page, {
            mode: "server-authoritative",
            phase: "baseline",
            viewport,
            surfaceName: type
          });
          await closeSurface(page, type);
        }
      }
    });
  });
});

test.describe("live/demo shared presentation parity", () => {
  test.skip(
    !hostedEnabled || !serverInstanceId,
    "Set EMPIRE_HOSTED_UI_PARITY_E2E=1 and EMPIRE_UI_PARITY_SERVER_ID for hosted parity."
  );
  test.setTimeout(360_000);

  test("whole-game chrome keeps shared DOM, styles and bounds at all ten viewports", async ({
    browser
  }, testInfo) => {
    testInfo.annotations.push(
      {
        type: "local-demo-state",
        description: "Local demo presentation state is initialized through the browser localStorage helper."
      },
      {
        type: "hosted-entry",
        description: "Hosted player enters a pre-created local server through registration, lobby, spawn and faction browser UI."
      },
      {
        type: "screenshot-contract",
        description: "Screenshots mask authoritative values and map pixels as evidence; DOM, computed styles and bounds are asserted instead of false pixel equality."
      }
    );
    const localContext = await browser.newContext({ viewport: parityViewports[0] });
    const serverContext = await browser.newContext({ viewport: parityViewports[0] });
    const localPage = await localContext.newPage();
    const serverPage = await serverContext.newPage();
    const coverage = [];
    try {
      const entry = await registerAndEnterHostedUiParityGame(serverPage, {
        serverInstanceId,
        spawnDistrictIds: [
          "district:26",
          "district:42",
          "district:67",
          "district:92",
          "district:138",
          "district:152",
          "district:157"
        ],
        identityPrefix: "ParityChrome"
      });
      const hostedMapPhase = await serverPage.evaluate(() => {
        const readModel = window.EmpireGameplaySliceClient?.getCurrentReadModel?.()
          || window.empireStreetsGameplaySliceReadModel
          || null;
        return readModel?.player?.dayNight?.phaseId === "night" ? "night" : "day";
      });
      const sharedDistrictId = Number(String(entry.spawnDistrictId).replace(/^district:/u, ""));
      await openParityLocalDemo(localPage, {
        ownedDistrictIds: [sharedDistrictId],
        startDistrictId: sharedDistrictId,
        mapPhase: hostedMapPhase
      });

      for (const viewport of parityViewports) {
        await localPage.setViewportSize(viewport);
        await serverPage.setViewportSize(viewport);
        await Promise.all([
          localPage.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve()))),
          serverPage.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve())))
        ]);
        const localSignature = await getGameChromeSignature(localPage);
        const serverSignature = await getGameChromeSignature(serverPage);
        expect(
          serverSignature,
          `${viewport.name} whole-game chrome DOM, computed styles, bounds and scroll behavior`
        ).toEqual(localSignature);
        await attachGameChromeScreenshotPair({
          localPage,
          serverPage,
          testInfo,
          viewportName: viewport.name
        });
        coverage.push({
          assertion: "DOM_STYLE_BOUNDS_PASS",
          screenshotClaim: "MASKED_EVIDENCE_ONLY",
          viewport: viewport.name
        });
      }

      expect(coverage).toHaveLength(parityViewports.length);
      await testInfo.attach("whole-game-chrome-parity-coverage.json", {
        body: Buffer.from(`${JSON.stringify({
          authoritativeValueMasking: true,
          comparisons: coverage.length,
          localDemoState: "browser-localStorage-initialized",
          pixelEqualityAsserted: false,
          serverEntry: "browser-registration-lobby-spawn-faction",
          coverage
        }, null, 2)}\n`, "utf8"),
        contentType: "application/json"
      });
      await expectNoDuplicateVisibleUi(serverPage);
      await expectHostedUiParityClean(serverPage, entry.diagnostics);
    } finally {
      await localContext.close();
      await serverContext.close();
    }
  });

  test("district, Restaurant and Pharmacy keep the shared visible structure", async ({ browser }) => {
    const localContext = await browser.newContext({ viewport: parityViewports[0] });
    const serverContext = await browser.newContext({ viewport: parityViewports[0] });
    const localPage = await localContext.newPage();
    const serverPage = await serverContext.newPage();
    try {
      const entry = await registerAndEnterHostedUiParityGame(serverPage, {
        serverInstanceId,
        spawnDistrictIds: [
          "district:26",
          "district:42",
          "district:138",
          "district:152",
          "district:157"
        ],
        identityPrefix: "ParityShared"
      });
      const hostedMapPhase = await serverPage.evaluate(() => {
        const readModel = window.EmpireGameplaySliceClient?.getCurrentReadModel?.()
          || window.empireStreetsGameplaySliceReadModel
          || null;
        return readModel?.player?.dayNight?.phaseId === "night" ? "night" : "day";
      });
      const sharedDistrictId = Number(String(entry.spawnDistrictId).replace(/^district:/u, ""));
      await openParityLocalDemo(localPage, {
        ownedDistrictIds: [sharedDistrictId],
        startDistrictId: sharedDistrictId,
        mapPhase: hostedMapPhase
      });
      await openDistrictById(localPage, entry.spawnDistrictId);
      const localDistrict = await getParitySurfaceSignature(localPage, "district");
      await captureParitySurface(localPage, {
        mode: "local-demo",
        phase: "after",
        viewport: parityViewports[0],
        surfaceName: "district"
      });
      await openBuildingFromDistrict(localPage, "restaurant");
      const localRestaurant = await getParitySurfaceSignature(localPage, "restaurant");
      const localRestaurantPresentation = await getBuildingPresentationSignature(
        localPage,
        "restaurant"
      );
      await closeSurface(localPage, "restaurant");
      await closeSurface(localPage, "district");
      await openProductionShortcut(localPage, "pharmacy");
      await localPage.locator("[data-production-building-tab='pharmacy:info']").click();
      const localPharmacy = await getParitySurfaceSignature(localPage, "pharmacy");
      await closeSurface(localPage, "pharmacy");

      await openDistrictById(serverPage, entry.spawnDistrictId);
      const serverDistrict = await getParitySurfaceSignature(serverPage, "district");
      await captureParitySurface(serverPage, {
        mode: "server-authoritative",
        phase: "after",
        viewport: parityViewports[0],
        surfaceName: "district"
      });
      await openBuildingFromDistrict(serverPage, "restaurant");
      const serverRestaurant = await getParitySurfaceSignature(serverPage, "restaurant");
      const serverRestaurantPresentation = await getBuildingPresentationSignature(
        serverPage,
        "restaurant"
      );
      await closeSurface(serverPage, "restaurant");
      await openDistrictById(serverPage, entry.spawnDistrictId);
      await openBuildingFromDistrict(serverPage, "pharmacy");
      await expect(serverPage.locator("[data-pharmacy-popup]")).toBeVisible();
      await serverPage.locator("[data-production-building-tab='pharmacy:info']").click();
      const serverPharmacy = await getParitySurfaceSignature(serverPage, "pharmacy");

      for (const [surface, localSignature, serverSignature, prefix] of [
        ["district", localDistrict, serverDistrict, "district-popup"],
        ["restaurant", localRestaurant, serverRestaurant, "district-building-detail"],
        ["pharmacy", localPharmacy, serverPharmacy, "pharmacy"]
      ]) {
        const expectedClasses = localSignature.canonicalClassNames.filter((className) => (
          className.includes(prefix)
        ));
        expect(expectedClasses.length, `${surface} must expose canonical shared classes`).toBeGreaterThan(0);
        expect(serverSignature.canonicalClassNames).toEqual(expect.arrayContaining(expectedClasses));
        expect(serverSignature.owner).toBe(localSignature.owner);
      }
      expect(serverRestaurantPresentation.title).toBe(localRestaurantPresentation.title);
      expect(serverRestaurantPresentation.sectionHeadings).toEqual(
        localRestaurantPresentation.sectionHeadings
      );
      expect(serverRestaurantPresentation.mechanics).toEqual(localRestaurantPresentation.mechanics);
      expect(serverRestaurantPresentation.effects).toEqual(localRestaurantPresentation.effects);
      expect(serverRestaurantPresentation.actions).toEqual(localRestaurantPresentation.actions);
      await expectNoDuplicateVisibleUi(serverPage);
      await closeSurface(serverPage, "pharmacy");
      await expectHostedUiParityClean(serverPage, entry.diagnostics);
    } finally {
      await localContext.close();
      await serverContext.close();
    }
  });

  test("Herna keeps demo action copy and responsive grid", async ({ browser }) => {
    const localContext = await browser.newContext({ viewport: parityViewports[0] });
    const serverContext = await browser.newContext({ viewport: parityViewports[0] });
    const localPage = await localContext.newPage();
    const serverPage = await serverContext.newPage();
    try {
      const entry = await registerAndEnterHostedUiParityGame(serverPage, {
        serverInstanceId,
        spawnDistrictIds: ["district:24"],
        identityPrefix: "ParityArcade"
      });
      const hostedMapPhase = await serverPage.evaluate(() => {
        const readModel = window.EmpireGameplaySliceClient?.getCurrentReadModel?.()
          || window.empireStreetsGameplaySliceReadModel
          || null;
        return readModel?.player?.dayNight?.phaseId === "night" ? "night" : "day";
      });
      await openParityLocalDemo(localPage, {
        ownedDistrictIds: [24],
        startDistrictId: 24,
        mapPhase: hostedMapPhase
      });

      for (const viewport of parityViewports) {
        await localPage.setViewportSize(viewport);
        await serverPage.setViewportSize(viewport);
        await openDistrictById(localPage, "district:24");
        await openBuildingFromDistrict(localPage, "arcade");
        const localPresentation = await getBuildingPresentationSignature(localPage, "arcade");
        await captureParitySurface(localPage, {
          mode: "local-demo",
          phase: "after",
          viewport,
          surfaceName: "arcade"
        });

        await openDistrictById(serverPage, entry.spawnDistrictId);
        await openBuildingFromDistrict(serverPage, "arcade");
        const serverPresentation = await getBuildingPresentationSignature(serverPage, "arcade");
        await captureParitySurface(serverPage, {
          mode: "server-authoritative",
          phase: "after",
          viewport,
          surfaceName: "arcade"
        });

        expect(serverPresentation.title).toBe(localPresentation.title);
        expect(serverPresentation.sectionHeadings).toEqual(localPresentation.sectionHeadings);
        expect(serverPresentation.mechanics).toEqual(localPresentation.mechanics);
        expect(serverPresentation.effects).toEqual(localPresentation.effects);
        expect(serverPresentation.actions).toEqual(localPresentation.actions);
        expect(serverPresentation.actionGrid.display).toBe(localPresentation.actionGrid.display);
        expect(serverPresentation.actionGrid.gridTemplateColumns).toBe(
          localPresentation.actionGrid.gridTemplateColumns
        );
        expect(serverPresentation.actionGrid.columnCount).toBe(
          localPresentation.actionGrid.columnCount
        );
        expect(serverPresentation.actionGrid.rowCount).toBe(localPresentation.actionGrid.rowCount);
        const expectedColumns = viewport.width >= 721 ? 2 : 1;
        const expectedRows = viewport.width >= 721 ? 1 : 2;
        expect(localPresentation.actionGrid.columnCount).toBe(expectedColumns);
        expect(localPresentation.actionGrid.rowCount).toBe(expectedRows);
        expect(serverPresentation.actionGrid.columnCount).toBe(expectedColumns);
        expect(serverPresentation.actionGrid.rowCount).toBe(expectedRows);

        await closeSurface(localPage, "arcade");
        await closeSurface(serverPage, "arcade");
        await closeSurface(localPage, "district");
        await closeSurface(serverPage, "district");
      }

      await expectNoDuplicateVisibleUi(serverPage);
      await expectHostedUiParityClean(serverPage, entry.diagnostics);
    } finally {
      await localContext.close();
      await serverContext.close();
    }
  });
});

test.describe("live/demo spawn-reachable canonical building matrix", () => {
  test.skip(
    !hostedEnabled || !serverInstanceId,
    "Hosted matrix needs the parity server."
  );
  test.setTimeout(1_200_000);

  for (const matrixEntry of spawnReachableBuildingParityMatrix) {
    test(`${matrixEntry.key} keeps canonical cards structurally identical`, async ({
      browser
    }, testInfo) => {
      const localContext = await browser.newContext({ viewport: parityViewports[0] });
      const serverContext = await browser.newContext({ viewport: parityViewports[0] });
      const localPage = await localContext.newPage();
      const serverPage = await serverContext.newPage();
      const coverage = [];
      try {
        const entry = await registerAndEnterHostedUiParityGame(serverPage, {
          serverInstanceId,
          spawnDistrictIds: matrixEntry.districtIds,
          identityPrefix: `ParityMatrix-${matrixEntry.key}`
        });
        const hostedMapPhase = await serverPage.evaluate(() => {
          const readModel = window.EmpireGameplaySliceClient?.getCurrentReadModel?.()
            || window.empireStreetsGameplaySliceReadModel
            || null;
          return readModel?.player?.dayNight?.phaseId === "night" ? "night" : "day";
        });
        const sharedDistrictId = Number(String(entry.spawnDistrictId).replace(/^district:/u, ""));
        await openParityLocalDemo(localPage, {
          ownedDistrictIds: [sharedDistrictId],
          startDistrictId: sharedDistrictId,
          mapPhase: hostedMapPhase
        });

        for (const viewport of parityViewports) {
          await localPage.setViewportSize(viewport);
          await serverPage.setViewportSize(viewport);
          await openDistrictById(localPage, entry.spawnDistrictId);
          await openDistrictById(serverPage, entry.spawnDistrictId);

          await expect(
            localPage.locator("[data-district-building-name]"),
            `${entry.spawnDistrictId} local building card count`
          ).toHaveCount(matrixEntry.expectedDistrictBuildingTypeIds.length);
          expect(
            await readDistrictBuildingTypeIds(serverPage),
            `${entry.spawnDistrictId} authoritative building card registry`
          ).toEqual(sortedBuildingTypeIds(matrixEntry.expectedDistrictBuildingTypeIds));

          for (const buildingTypeId of matrixEntry.coveredBuildingTypeIds) {
            await compareOpenBuildingParity(
              localPage,
              serverPage,
              buildingTypeId,
              { testInfo, viewportName: viewport.name }
            );
            coverage.push({
              buildingTypeId,
              screenshotClaim: "EVIDENCE_ONLY",
              screenshots: productionBuildingTypeIds.has(buildingTypeId) ? 4 : 2,
              structure: "PASS",
              viewport: viewport.name
            });
          }

          await closeSurface(localPage, "district");
          await closeSurface(serverPage, "district");
        }

        expect(
          entry.diagnostics.submitRequests,
          `${matrixEntry.key} is an opening-only visible flow`
        ).toEqual([]);
        expect(coverage).toHaveLength(
          matrixEntry.coveredBuildingTypeIds.length * parityViewports.length
        );
        expect(new Set(coverage.map((entry) => (
          `${entry.buildingTypeId}/${entry.viewport}`
        ))).size).toBe(coverage.length);
        await testInfo.attach(`${matrixEntry.key}-building-parity-coverage.json`, {
          body: Buffer.from(`${JSON.stringify({
            buildingTypeIds: matrixEntry.coveredBuildingTypeIds,
            comparisons: coverage.length,
            pixelEqualityAsserted: false,
            screenshots: coverage.reduce((sum, entry) => sum + entry.screenshots, 0),
            viewports: parityViewports.map((viewport) => viewport.name),
            coverage
          }, null, 2)}\n`, "utf8"),
          contentType: "application/json"
        });
        await expectNoDuplicateVisibleUi(serverPage);
        await expectHostedUiParityClean(serverPage, entry.diagnostics);
      } finally {
        await localContext.close();
        await serverContext.close();
      }
    });
  }
});
