import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import {
  publicBuildingDefinitions
} from "../../packages/game-config/src/public/building-definitions.ts";
import {
  STARTER_DISTRICT_PRODUCTION_BUILDING_TYPES
} from "../../packages/game-core/src/state/starterDistrictProductionBuildings.ts";
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
  parseUiParityDebugBuildingTypes,
  selectUiParityDebugBuildingMatrix,
  UI_PARITY_DEBUG_BUILDING_TYPES_ENV
} from "./helpers/uiParityDebugBuildingFilter.js";
import {
  buildingPopulationBufferDynamicValueSelector,
  captureStableHostedPopulationParitySnapshot,
  captureParitySurface,
  captureGameChromeScreenshot,
  captureIsolatedParityScreenshot,
  closeSurface,
  compareParityPngScreenshotAttempts,
  compareParityPngScreenshots,
  exerciseParitySurfaceScroll,
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
  PARITY_PNG_CHANNEL_TOLERANCE,
  parityCaptureViewports,
  paritySurfaces,
  parityViewports,
  readVisibleDistrictBuildingTypeIds,
  resolveBuildingParitySurfaceName,
  selectProductionBuildingTab,
  settleParityPage,
  syncParityLocalDemoDistrictBuildingsFromHosted
} from "./helpers/uiParityCapture.js";

const captureEnabled = process.env.EMPIRE_CAPTURE_UI_PARITY_BASELINE === "1";
const hostedEnabled = process.env.EMPIRE_HOSTED_UI_PARITY_E2E === "1";
const serverInstanceId = process.env.EMPIRE_UI_PARITY_SERVER_ID || "";
const productionBuildingTypeIds = new Set(STARTER_DISTRICT_PRODUCTION_BUILDING_TYPES);
const sortedBuildingTypeIds = (values) => Array.from(new Set(values)).sort();
const parityViewportBatches = Object.freeze([
  Object.freeze({
    key: "primary",
    label: "desktop-1440x900 through mobile-430x932",
    viewports: Object.freeze(parityViewports.slice(0, 5))
  }),
  Object.freeze({
    key: "secondary",
    label: "tablet-768x1024 through desktop-1920x1080",
    viewports: Object.freeze(parityViewports.slice(5))
  })
]);
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
  [
    ...parityMapManifest.districts
      .filter((district) => (
        district.isSpawnCandidate
        && district.zone !== "downtown"
        && district.zone !== "industrial"
      ))
      .flatMap((district) => resolveParityDistrictBuildingTypeIds(district.id)),
    ...STARTER_DISTRICT_PRODUCTION_BUILDING_TYPES
  ]
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
    key: "residential-arcade-garage",
    districtIds: Object.freeze(["district:4", "district:142", "district:154"]),
    expectedDistrictBuildingTypeIds: Object.freeze(["apartment_block", "arcade", "garage"]),
    coveredBuildingTypeIds: Object.freeze(["apartment_block", "arcade", "garage"])
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
const uiParityDebugBuildingTypeIds = parseUiParityDebugBuildingTypes(
  process.env[UI_PARITY_DEBUG_BUILDING_TYPES_ENV]
);
const selectedSpawnReachableBuildingParityMatrix = selectUiParityDebugBuildingMatrix(
  spawnReachableBuildingParityMatrix,
  uiParityDebugBuildingTypeIds
);

async function readVisibleDistrictHeroContract(page) {
  const districtShell = page.locator(`${paritySurfaces.district.shell}:visible`).last();
  const heroImage = districtShell.locator("img.district-modal-hero__image");
  await expect(heroImage).toBeVisible();
  await expect.poll(() => heroImage.evaluate((image) => ({
    complete: image.complete,
    naturalWidth: image.naturalWidth
  }))).toMatchObject({ complete: true, naturalWidth: expect.any(Number) });
  expect(await heroImage.evaluate((image) => image.naturalWidth)).toBeGreaterThan(0);
  return heroImage.evaluate((image) => {
    const card = image.closest("[data-district-popup-card]");
    const hero = image.closest(".district-modal-hero");
    const cardRect = card?.getBoundingClientRect();
    const relativeRect = (element) => {
      const rect = element?.getBoundingClientRect();
      return rect && cardRect
        ? {
            height: Math.round(rect.height),
            width: Math.round(rect.width),
            x: Math.round(rect.left - cardRect.left),
            y: Math.round(rect.top - cardRect.top)
          }
        : null;
    };
    const imageStyle = getComputedStyle(image);
    return {
      alt: image.getAttribute("alt"),
      heroClasses: Array.from(hero?.classList || []).sort(),
      heroRect: relativeRect(hero),
      imageClasses: Array.from(image.classList).sort(),
      imageRect: relativeRect(image),
      imageStyle: {
        display: imageStyle.display,
        height: imageStyle.height,
        objectFit: imageStyle.objectFit,
        objectPosition: imageStyle.objectPosition,
        opacity: imageStyle.opacity,
        width: imageStyle.width
      },
      src: image.getAttribute("src")
    };
  });
}

async function readOpenBuildingParity(page, buildingTypeId) {
  const surfaceName = resolveBuildingParitySurfaceName(buildingTypeId);
  const shell = page.locator(`${paritySurfaces[surfaceName].shell}:visible`).last();
  await expect(shell).toBeVisible({ timeout: 30_000 });
  if (productionBuildingTypeIds.has(buildingTypeId)) {
    await expect(shell.locator([
      ".production-recipe-card--loading",
      ".factory-slot--loading"
    ].join(","))).toHaveCount(0, {
      timeout: 30_000
    });
    await selectProductionBuildingTab(page, surfaceName, "stats");
    return {
      surfaceName,
      presentation: await getProductionPresentationSignature(page, surfaceName),
      structure: await getParityDomStructureSignature(page, surfaceName),
      technicalText: await getVisibleTechnicalBuildingText(page, surfaceName)
    };
  }
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
  panelName,
  captureAttempt = 1
}) {
  const recaptureSuffix = captureAttempt > 1 ? `recapture-${captureAttempt}` : "";
  const attachmentName = [
    "building",
    buildingTypeId,
    mode,
    viewportName,
    panelName,
    recaptureSuffix
  ].filter(Boolean).join("--") + ".png";
  const screenshotPath = testInfo.outputPath(attachmentName);
  const surface = page.locator(`${paritySurfaces[surfaceName].selector}:visible`).last();
  const target = ["buildingDetail", "restaurant", "arcade"].includes(surfaceName)
    ? surface.locator(".district-building-detail-card").first()
    : surface;
  const dynamicSelectors = [
    "[data-production-progress]",
    "[data-production-countdown]",
    "[data-countdown]",
    buildingPopulationBufferDynamicValueSelector,
    "time"
  ];
  if (surfaceName === "district") {
    dynamicSelectors.push(
      ".district-popup-owner-avatar-wrap img",
      "[data-district-popup-owner]",
      "[data-district-popup-owner-meta]"
    );
  }
  const screenshotCapture = await captureIsolatedParityScreenshot(page, {
    ignoreSelector: dynamicSelectors.join(","),
    path: screenshotPath,
    roundedCompositeSelector: [
      surfaceName === "district" ? ".district-modal-hero--district" : "",
      surfaceName === "pharmacy" ? ".pharmacy-slot__quantity-btn" : "",
      surfaceName === "pharmacy" ? ".pharmacy-slot__quantity-value" : "",
      surfaceName === "pharmacy" ? ".pharmacy-slot__btn" : ""
    ].filter(Boolean).join(","),
    stableBackdropShellSelector: paritySurfaces[surfaceName].shell,
    target
  });
  await testInfo.attach(attachmentName, {
    path: screenshotPath,
    contentType: "image/png"
  });
  return screenshotCapture;
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
  const attemptResult = await compareParityPngScreenshotAttempts(async (captureAttempt) => {
    const [localCapture, serverCapture] = await Promise.all([
      attachOpenBuildingScreenshot({
        page: localPage,
        testInfo,
        surfaceName,
        buildingTypeId,
        mode: "local-demo",
        viewportName,
        panelName,
        captureAttempt
      }),
      attachOpenBuildingScreenshot({
        page: serverPage,
        testInfo,
        surfaceName,
        buildingTypeId,
        mode: "hosted",
        viewportName,
        panelName,
        captureAttempt
      })
    ]);
    return {
      actualBuffer: serverCapture.screenshot,
      expectedBuffer: localCapture.screenshot,
      ignoreRegions: [
        ...serverCapture.ignoreRegions,
        ...localCapture.ignoreRegions
      ]
    };
  });
  const comparison = {
    ...attemptResult.comparison,
    captureAttemptCount: attemptResult.attemptCount
  };
  await testInfo.attach([
    "building",
    buildingTypeId,
    viewportName,
    panelName,
    "png-diff.json"
  ].join("--"), {
    body: Buffer.from(`${JSON.stringify({
      ...comparison,
      captureAttempts: attemptResult.attempts
    }, null, 2)}\n`, "utf8"),
    contentType: "application/json"
  });
  expect(
    comparison,
    `${buildingTypeId} ${panelName} ${viewportName} PNG channel parity`
  ).toMatchObject({
    dimensionsEqual: true,
    matches: true,
    meaningfulPixelCount: 0
  });
  return comparison;
}

async function attachGameChromeScreenshotPair({
  localPage,
  serverPage,
  testInfo,
  viewportName
}) {
  let comparison = null;
  let screenshotEntries = [];
  let attempt = 0;
  do {
    attempt += 1;
    await Promise.all([
      clearParityStreetNews(localPage),
      clearParityStreetNews(serverPage)
    ]);
    screenshotEntries = [];
    for (const [mode, page] of [
      ["hosted", serverPage],
      ["local-demo", localPage]
    ]) {
      const attachmentName = `game-chrome--${mode}--${viewportName}.png`;
      const screenshotPath = testInfo.outputPath(attachmentName);
      const screenshotCapture = await captureGameChromeScreenshot(page, screenshotPath);
      screenshotEntries.push([mode, screenshotCapture, screenshotPath]);
    }
    const screenshotCaptures = new Map(
      screenshotEntries.map(([mode, capture]) => [mode, capture])
    );
    const serverCapture = screenshotCaptures.get("hosted");
    const localCapture = screenshotCaptures.get("local-demo");
    comparison = compareParityPngScreenshots(
      serverCapture.screenshot,
      localCapture.screenshot,
      {
        ignoreRegions: [
          ...serverCapture.ignoreRegions,
          ...localCapture.ignoreRegions
        ]
      }
    );
  } while (!comparison.matches && attempt < 3);
  for (const [mode, , screenshotPath] of screenshotEntries) {
    await testInfo.attach(`game-chrome--${mode}--${viewportName}.png`, {
      path: screenshotPath,
      contentType: "image/png"
    });
  }
  await testInfo.attach(`game-chrome--${viewportName}--png-diff.json`, {
    body: Buffer.from(`${JSON.stringify({ ...comparison, attempts: attempt }, null, 2)}\n`, "utf8"),
    contentType: "application/json"
  });
  expect(comparison, `${viewportName} ignored leaf-value game chrome PNG channel parity`)
    .toMatchObject({
      dimensionsEqual: true,
      matches: true,
      meaningfulPixelCount: 0
    });
  return comparison;
}

async function clearParityStreetNews(page) {
  const root = page.locator("#game-root");
  await expect(root).toBeVisible();
  await root.evaluate((element) => {
    element.dataset.streetNewsRumorPublication = "paused";
  });
  const clearButton = root.locator("[data-building-action-clear]");
  const emptyState = root.locator("[data-building-action-empty]");
  const feedItems = root.locator(
    "[data-building-action-feed] > .building-action-status__item"
  );
  await expect(clearButton).toBeVisible();
  if (await clearButton.isEnabled()) {
    await clearButton.click();
  }
  await clearButton.evaluate((element) => element.blur());
  await settleParityPage(page);
  await expect(feedItems).toHaveCount(0);
  await expect(emptyState).toBeVisible();
  await expect(clearButton).toBeDisabled();
}

async function waitForSettledAllianceLabel(page) {
  const label = page.locator("[data-gang-alliance]");
  await expect(label).toBeVisible();
  await expect.poll(async () => String(await label.textContent() || "").trim()).not.toBe("Načítám…");
}

async function compareOpenBuildingParity(
  localPage,
  serverPage,
  buildingTypeId,
  screenshotAttachment = null
) {
  const screenshotComparisons = [];
  await openBuildingFromDistrict(serverPage, buildingTypeId);
  const stablePopulationCapture = await captureStableHostedPopulationParitySnapshot(
    localPage,
    serverPage,
    buildingTypeId,
    () => readOpenBuildingParity(serverPage, buildingTypeId)
  );
  const serverStats = stablePopulationCapture.hostedSnapshot;
  await openBuildingFromDistrict(localPage, buildingTypeId);
  const localStats = await readOpenBuildingParity(localPage, buildingTypeId);

  expect(serverStats.surfaceName, buildingTypeId).toBe(localStats.surfaceName);
  expect(serverStats.presentation, `${buildingTypeId} presentation`).toEqual(
    localStats.presentation
  );
  expect(serverStats.structure, `${buildingTypeId} structure and bounds`).toEqual(
    localStats.structure
  );
  expect(
    localStats.structure.focus.activeElement?.insideSurface,
    `${buildingTypeId} local-demo natural focus must enter the shared surface`
  ).toBe(true);
  expect(
    serverStats.structure.focus.activeElement?.insideSurface,
    `${buildingTypeId} hosted natural focus must enter the shared surface`
  ).toBe(true);
  const localScroll = await exerciseParitySurfaceScroll(localPage, localStats.surfaceName);
  const serverScroll = await exerciseParitySurfaceScroll(serverPage, serverStats.surfaceName);
  expect(serverScroll, `${buildingTypeId} scroll behavior`).toEqual(localScroll);
  expect(localScroll.resetTop, `${buildingTypeId} local-demo scroll reset`).toBe(true);
  expect(serverScroll.resetTop, `${buildingTypeId} hosted scroll reset`).toBe(true);
  if (localScroll.available) {
    expect(localScroll.reachedBottom, `${buildingTypeId} local-demo scroll bottom`).toBe(true);
    expect(serverScroll.reachedBottom, `${buildingTypeId} hosted scroll bottom`).toBe(true);
  }
  expect(
    localStats.technicalText,
    `${buildingTypeId} local-demo card must not expose technical server internals`
  ).toEqual([]);
  expect(
    serverStats.technicalText,
    `${buildingTypeId} hosted card must not expose SERVER, projection or revision internals`
  ).toEqual([]);

  if (screenshotAttachment) {
    screenshotComparisons.push(await attachOpenBuildingScreenshotPair({
      localPage,
      serverPage,
      testInfo: screenshotAttachment.testInfo,
      surfaceName: localStats.surfaceName,
      buildingTypeId,
      viewportName: screenshotAttachment.viewportName,
      panelName: productionBuildingTypeIds.has(buildingTypeId) ? "stats" : "detail"
    }));
    if (
      buildingTypeId === "drug_lab"
      && parityCaptureViewports.some(({ name }) => name === screenshotAttachment.viewport.name)
    ) {
      await captureParitySurface(serverPage, {
        mode: "server-authoritative",
        phase: "baseline",
        viewport: screenshotAttachment.viewport,
        surfaceName: serverStats.surfaceName
      });
    }
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
      screenshotComparisons.push(await attachOpenBuildingScreenshotPair({
        localPage,
        serverPage,
        testInfo: screenshotAttachment.testInfo,
        surfaceName: localStats.surfaceName,
        buildingTypeId,
        viewportName: screenshotAttachment.viewportName,
        panelName: "info"
      }));
    }
  }

  await closeSurface(localPage, localStats.surfaceName);
  await closeSurface(serverPage, serverStats.surfaceName);
  return screenshotComparisons;
}

test.describe("canonical building parity coverage contract", () => {
  test("declares every spawn-reachable public type and the honest browser gaps", () => {
    const plannedBuildingTypeIds = sortedBuildingTypeIds(
      [
        ...spawnReachableBuildingParityMatrix.flatMap((entry) => entry.coveredBuildingTypeIds),
        ...STARTER_DISTRICT_PRODUCTION_BUILDING_TYPES
      ]
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
      "power_station",
      "recycling_center",
      "stock_exchange",
      "vip_lounge",
      "warehouse"
    ]);

    for (const entry of spawnReachableBuildingParityMatrix) {
      for (const districtId of entry.districtIds) {
        const district = parityMapManifest.districts.find(
          (candidate) => candidate.id === districtId
        );
        expect(district?.isSpawnCandidate, districtId).toBe(true);
        expect(["downtown", "industrial"]).not.toContain(district?.zone);
        expect(
          sortedBuildingTypeIds(resolveParityDistrictBuildingTypeIds(districtId)),
          districtId
        ).toEqual(sortedBuildingTypeIds(entry.expectedDistrictBuildingTypeIds));
      }
    }
  });
});

test.describe("live/demo UI parity baseline", () => {
  test.describe.configure({ mode: "parallel" });
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
  test.describe.configure({ mode: "parallel" });
  test.skip(
    !hostedEnabled || !serverInstanceId,
    "Set EMPIRE_HOSTED_UI_PARITY_E2E=1 and EMPIRE_UI_PARITY_SERVER_ID for hosted parity."
  );
  test.setTimeout(360_000);

  test.describe.serial("whole-game chrome viewport batches", () => {
    let localContext;
    let serverContext;
    let localPage;
    let serverPage;
    let entry;
    const coverage = [];

    test.beforeAll(async ({ browser }) => {
      localContext = await browser.newContext({ viewport: parityViewports[0] });
      serverContext = await browser.newContext({ viewport: parityViewports[0] });
      localPage = await localContext.newPage();
      serverPage = await serverContext.newPage();
      entry = await registerAndEnterHostedUiParityGame(serverPage, {
        serverInstanceId,
        acknowledgedServerMilestoneIds: ["welcome", "first-purge", "lockdown", "winners"],
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
        gangColor: entry.gangColor,
        ownedDistrictIds: [sharedDistrictId],
        startDistrictId: sharedDistrictId,
        mapPhase: hostedMapPhase
      });
      await clearParityStreetNews(localPage);
      await clearParityStreetNews(serverPage);
      await Promise.all([
        waitForSettledAllianceLabel(localPage),
        waitForSettledAllianceLabel(serverPage)
      ]);
      await expect(serverPage.locator("[data-gang-faction]")).not.toHaveText("—");
      await expect.poll(async () => Number.parseInt(
        String(await serverPage.locator("[data-gang-districts]").textContent() || "0"),
        10
      )).toBeGreaterThan(0);
      await expect(serverPage.locator("[data-gang-faction]")).toHaveText(
        String(await localPage.locator("[data-gang-faction]").textContent() || "").trim()
      );
      await expect(serverPage.locator("[data-gang-districts]")).toHaveText(
        String(await localPage.locator("[data-gang-districts]").textContent() || "").trim()
      );
    });

    test.afterAll(async () => {
      await Promise.all([
        localContext?.close(),
        serverContext?.close()
      ].filter(Boolean));
    });

    for (const [batchIndex, viewportBatch] of parityViewportBatches.entries()) {
      test(`whole-game chrome keeps shared DOM, styles and bounds (${viewportBatch.label})`, async ({}, testInfo) => {
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
            description: `Only authoritative leaf values and map pixels are masked; every remaining pixel must stay within ${PARITY_PNG_CHANNEL_TOLERANCE} channel levels with zero meaningful pixels.`
          },
          {
            type: "viewport-batch",
            description: `${viewportBatch.key}: ${viewportBatch.viewports.map(({ name }) => name).join(", ")}`
          }
        );

        for (const viewport of viewportBatch.viewports) {
          await localPage.setViewportSize(viewport);
          await serverPage.setViewportSize(viewport);
          await Promise.all([settleParityPage(localPage), settleParityPage(serverPage)]);
          await Promise.all([
            clearParityStreetNews(localPage),
            clearParityStreetNews(serverPage)
          ]);
          const localSignature = await getGameChromeSignature(localPage);
          const serverSignature = await getGameChromeSignature(serverPage);
          expect(
            serverSignature,
            `${viewport.name} whole-game chrome DOM, computed styles, bounds and scroll behavior`
          ).toEqual(localSignature);
          const screenshotComparison = await attachGameChromeScreenshotPair({
            localPage,
            serverPage,
            testInfo,
            viewportName: viewport.name
          });
          coverage.push({
            assertion: "DOM_STYLE_BOUNDS_PASS",
            screenshotClaim: "MASKED_LEAF_VALUES_ZERO_MEANINGFUL_PIXELS_PASS",
            screenshotComparison,
            viewport: viewport.name
          });
        }

        if (batchIndex === parityViewportBatches.length - 1) {
          expect(coverage).toHaveLength(parityViewports.length);
          await testInfo.attach("whole-game-chrome-parity-coverage.json", {
            body: Buffer.from(`${JSON.stringify({
              authoritativeValueMasking: true,
              channelTolerance: PARITY_PNG_CHANNEL_TOLERANCE,
              comparisons: coverage.length,
              maxMeaningfulPixels: 0,
              localDemoState: "browser-localStorage-initialized",
              pixelEqualityAsserted: false,
              pixelParityAsserted: true,
              serverEntry: "browser-registration-lobby-spawn-faction",
              coverage
            }, null, 2)}\n`, "utf8"),
            contentType: "application/json"
          });
          await expectNoDuplicateVisibleUi(serverPage);
          await expectHostedUiParityClean(serverPage, entry.diagnostics);
        }
      });
    }
  });

  test.describe.serial("City Events compact viewport batches", () => {
    let localContext;
    let serverContext;
    let localPage;
    let serverPage;
    let entry;

    test.beforeAll(async ({ browser }) => {
      localContext = await browser.newContext({ viewport: parityViewports[0] });
      serverContext = await browser.newContext({ viewport: parityViewports[0] });
      localPage = await localContext.newPage();
      serverPage = await serverContext.newPage();
      entry = await registerAndEnterHostedUiParityGame(serverPage, {
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
        identityPrefix: "ParityCityEvents"
      });
      const hostedMapPhase = await serverPage.evaluate(() => {
        const readModel = window.EmpireGameplaySliceClient?.getCurrentReadModel?.()
          || window.empireStreetsGameplaySliceReadModel
          || null;
        return readModel?.player?.dayNight?.phaseId === "night" ? "night" : "day";
      });
      await openParityLocalDemo(localPage, {
        gangColor: entry.gangColor,
        ownedDistrictIds: [Number(String(entry.spawnDistrictId).replace(/^district:/u, ""))],
        startDistrictId: Number(String(entry.spawnDistrictId).replace(/^district:/u, "")),
        mapPhase: hostedMapPhase
      });
    });

    test.afterAll(async () => {
      await Promise.all([
        localContext?.close(),
        serverContext?.close()
      ].filter(Boolean));
    });

    for (const [batchIndex, viewportBatch] of parityViewportBatches.entries()) {
      test(`City Events compact presentation is identical (${viewportBatch.label})`, async ({}, testInfo) => {
        testInfo.annotations.push(
          {
            type: "state-contract",
            description: "Both modes are compared before agent selection; only the dynamic next-refresh clock is masked."
          },
          {
            type: "viewport-batch",
            description: `${viewportBatch.key}: ${viewportBatch.viewports.map(({ name }) => name).join(", ")}`
          }
        );

        for (const viewport of viewportBatch.viewports) {
          await Promise.all([
            localPage.setViewportSize(viewport),
            serverPage.setViewportSize(viewport)
          ]);
          await Promise.all([
            openCityEvents(localPage),
            openCityEvents(serverPage)
          ]);
          await expect(localPage.locator("#events-modal")).toHaveClass(/events-modal--compact/u);
          await expect(serverPage.locator("#events-modal")).toHaveClass(/events-modal--compact/u);
          expect(
            await getParityDomStructureSignature(serverPage, "cityEvents"),
            `${viewport.name} City Events compact DOM, styles, bounds, focus and scroll`
          ).toEqual(await getParityDomStructureSignature(localPage, "cityEvents"));
          const localRefreshLabel = await localPage
            .locator("#events-refresh-countdown")
            .textContent();
          expect(localRefreshLabel).toMatch(
            /^MĚSTSKÝ ČAS · další úkoly \d{2}:\d{2}$/u
          );
          await expect(serverPage.locator("#events-refresh-countdown")).toHaveText(
            localRefreshLabel || ""
          );

          const screenshotEntries = await Promise.all([
            ["local-demo", localPage],
            ["hosted", serverPage]
          ].map(async ([mode, page]) => {
            const target = page.locator(`${paritySurfaces.cityEvents.selector}:visible`).last();
            await expect(target.locator(".events-agent img")).toHaveCount(3);
            await expect.poll(() => target.locator(".events-agent img").evaluateAll((images) => (
              images.every((image) => image.complete && image.naturalWidth > 0)
            ))).toBe(true);
            const screenshotPath = testInfo.outputPath(
              `city-events-compact--${mode}--${viewport.name}.png`
            );
            const screenshotCapture = await captureIsolatedParityScreenshot(page, {
              ignoreSelector: [
                "[data-topbar-clean-money]",
                "[data-topbar-dirty-money]",
                "[data-topbar-influence]",
                "[data-topbar-spy-label]",
                "[data-topbar-spy-value]"
              ].join(","),
              path: screenshotPath,
              stableBackdropShellSelector: paritySurfaces.cityEvents.shell,
              target
            });
            await testInfo.attach(`city-events-compact--${mode}--${viewport.name}.png`, {
              path: screenshotPath,
              contentType: "image/png"
            });
            return [mode, screenshotCapture];
          }));
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
          await testInfo.attach(`city-events-compact--${viewport.name}--png-diff.json`, {
            body: Buffer.from(`${JSON.stringify(comparison, null, 2)}\n`, "utf8"),
            contentType: "application/json"
          });
          expect(comparison, `${viewport.name} City Events compact PNG channel parity`)
            .toMatchObject({
              dimensionsEqual: true,
              matches: true,
              meaningfulPixelCount: 0
            });
          await Promise.all([
            closeSurface(localPage, "cityEvents"),
            closeSurface(serverPage, "cityEvents")
          ]);
        }

        if (batchIndex === parityViewportBatches.length - 1) {
          await expectNoDuplicateVisibleUi(serverPage);
          await expectHostedUiParityClean(serverPage, entry.diagnostics);
        }
      });
    }
  });

  test.describe.serial("district and owned-building viewport batches", () => {
    let localContext;
    let serverContext;
    let localPage;
    let serverPage;
    let entry;

    test.beforeAll(async ({ browser }) => {
      localContext = await browser.newContext({ viewport: parityViewports[0] });
      serverContext = await browser.newContext({ viewport: parityViewports[0] });
      localPage = await localContext.newPage();
      serverPage = await serverContext.newPage();
      entry = await registerAndEnterHostedUiParityGame(serverPage, {
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
        gangColor: entry.gangColor,
        ownedDistrictIds: [sharedDistrictId],
        startDistrictId: sharedDistrictId,
        mapPhase: hostedMapPhase
      });
    });

    test.afterAll(async () => {
      await Promise.all([
        localContext?.close(),
        serverContext?.close()
      ].filter(Boolean));
    });

    for (const viewportBatch of parityViewportBatches) {
      test(`district keeps the shared visible structure (${viewportBatch.label})`, async ({}, testInfo) => {
        testInfo.annotations.push({
          type: "viewport-batch",
          description: `${viewportBatch.key}: ${viewportBatch.viewports.map(({ name }) => name).join(", ")}`
        });

        for (const viewport of viewportBatch.viewports) {
          await localPage.setViewportSize(viewport);
          await serverPage.setViewportSize(viewport);
          await openDistrictById(localPage, entry.spawnDistrictId);
          await openDistrictById(serverPage, entry.spawnDistrictId);
          await syncParityLocalDemoDistrictBuildingsFromHosted(localPage, serverPage, {
            districtId: entry.spawnDistrictId,
            expectedBuildingTypeIds: sortedBuildingTypeIds([
              ...resolveParityDistrictBuildingTypeIds(entry.spawnDistrictId),
              ...STARTER_DISTRICT_PRODUCTION_BUILDING_TYPES
            ])
          });
          const localDistrict = await getParitySurfaceSignature(localPage, "district");
          const serverDistrict = await getParitySurfaceSignature(serverPage, "district");
          const localDistrictStructure = await getParityDomStructureSignature(localPage, "district");
          const serverDistrictStructure = await getParityDomStructureSignature(serverPage, "district");
          const localDistrictHero = await readVisibleDistrictHeroContract(localPage);
          const serverDistrictHero = await readVisibleDistrictHeroContract(serverPage);
          const expectedDistrictClasses = localDistrict.canonicalClassNames.filter((className) => (
            className.includes("district-popup")
          ));
          expect(expectedDistrictClasses.length, "district must expose canonical shared classes")
            .toBeGreaterThan(0);
          expect(
            expectedDistrictClasses.filter((className) => (
              !serverDistrict.canonicalClassNames.includes(className)
            )),
            `${viewport.name} hosted district missing canonical demo classes`
          ).toEqual([]);
          expect(serverDistrict.owner).toBe(localDistrict.owner);
          const [localBuildingMeta, serverBuildingMeta] = await Promise.all([
            localPage.locator("[data-district-popup-buildings-meta]:visible").allTextContents(),
            serverPage.locator("[data-district-popup-buildings-meta]:visible").allTextContents()
          ]);
          expect(localBuildingMeta.map((value) => value.trim()).filter(Boolean)).toEqual([]);
          expect(serverBuildingMeta.map((value) => value.trim()).filter(Boolean)).toEqual([]);
          expect(localDistrictHero.src, "district popup must render a canonical hero image")
            .toBeTruthy();
          expect(
            serverDistrictHero,
            `${viewport.name} district popup canonical hero source, styles and bounds`
          ).toEqual(localDistrictHero);
          expect(
            serverDistrictStructure,
            `${viewport.name} district exact DOM, copy, computed styles, bounds and focus contract`
          ).toEqual(localDistrictStructure);
          const localDistrictScroll = await exerciseParitySurfaceScroll(localPage, "district");
          const serverDistrictScroll = await exerciseParitySurfaceScroll(serverPage, "district");
          expect(serverDistrictScroll, `${viewport.name} district scroll behavior`)
            .toEqual(localDistrictScroll);
          await attachOpenBuildingScreenshotPair({
            localPage,
            serverPage,
            testInfo,
            surfaceName: "district",
            buildingTypeId: "district-popup",
            viewportName: viewport.name,
            panelName: "overview"
          });
          if (parityCaptureViewports.some(({ name }) => name === viewport.name)) {
            await captureParitySurface(localPage, {
              mode: "local-demo",
              phase: "after",
              viewport,
              surfaceName: "district"
            });
            await captureParitySurface(serverPage, {
              mode: "server-authoritative",
              phase: "after",
              viewport,
              surfaceName: "district"
            });
          }
          await closeSurface(localPage, "district");
          await closeSurface(serverPage, "district");
        }
      });
    }

    test("Restaurant and Pharmacy keep the shared visible structure", async () => {
      await localPage.setViewportSize(parityViewports[0]);
      await serverPage.setViewportSize(parityViewports[0]);
      await openDistrictById(localPage, entry.spawnDistrictId);
      await openDistrictById(serverPage, entry.spawnDistrictId);
      await openBuildingFromDistrict(localPage, "restaurant");
      await openBuildingFromDistrict(serverPage, "restaurant");
      const localRestaurant = await getParitySurfaceSignature(localPage, "restaurant");
      const serverRestaurant = await getParitySurfaceSignature(serverPage, "restaurant");
      const localRestaurantPresentation = await getBuildingPresentationSignature(
        localPage,
        "restaurant"
      );
      const serverRestaurantPresentation = await getBuildingPresentationSignature(
        serverPage,
        "restaurant"
      );
      await closeSurface(localPage, "restaurant");
      await closeSurface(serverPage, "restaurant");
      await closeSurface(localPage, "district");
      await closeSurface(serverPage, "district");
      await openProductionShortcut(localPage, "pharmacy");
      await openDistrictById(serverPage, entry.spawnDistrictId);
      await openBuildingFromDistrict(serverPage, "pharmacy");
      await expect(serverPage.locator("[data-pharmacy-popup]")).toBeVisible();
      await localPage.locator("[data-production-building-tab='pharmacy:info']").click();
      await serverPage.locator("[data-production-building-tab='pharmacy:info']").click();
      const localPharmacy = await getParitySurfaceSignature(localPage, "pharmacy");
      const serverPharmacy = await getParitySurfaceSignature(serverPage, "pharmacy");

      for (const [surface, localSignature, serverSignature, prefix] of [
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
      await closeSurface(localPage, "pharmacy");
      await closeSurface(serverPage, "pharmacy");
      await expectHostedUiParityClean(serverPage, entry.diagnostics);
    });
  });

  test.describe.serial("Herna responsive viewport batches", () => {
    let localContext;
    let serverContext;
    let localPage;
    let serverPage;
    let entry;

    test.beforeAll(async ({ browser }) => {
      localContext = await browser.newContext({ viewport: parityViewports[0] });
      serverContext = await browser.newContext({ viewport: parityViewports[0] });
      localPage = await localContext.newPage();
      serverPage = await serverContext.newPage();
      entry = await registerAndEnterHostedUiParityGame(serverPage, {
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
        gangColor: entry.gangColor,
        ownedDistrictIds: [24],
        startDistrictId: 24,
        mapPhase: hostedMapPhase
      });
    });

    test.afterAll(async () => {
      await Promise.all([
        localContext?.close(),
        serverContext?.close()
      ].filter(Boolean));
    });

    for (const [batchIndex, viewportBatch] of parityViewportBatches.entries()) {
      test(`Herna keeps demo action copy and responsive grid (${viewportBatch.label})`, async ({}, testInfo) => {
        testInfo.annotations.push({
          type: "viewport-batch",
          description: `${viewportBatch.key}: ${viewportBatch.viewports.map(({ name }) => name).join(", ")}`
        });

        for (const viewport of viewportBatch.viewports) {
          await localPage.setViewportSize(viewport);
          await serverPage.setViewportSize(viewport);
          await Promise.all([
            (async () => {
              await openDistrictById(localPage, "district:24");
              await openBuildingFromDistrict(localPage, "arcade");
            })(),
            (async () => {
              await openDistrictById(serverPage, entry.spawnDistrictId);
              await openBuildingFromDistrict(serverPage, "arcade");
            })()
          ]);
          const [
            localPresentation,
            serverPresentation,
            localStructure,
            serverStructure
          ] = await Promise.all([
            getBuildingPresentationSignature(localPage, "arcade"),
            getBuildingPresentationSignature(serverPage, "arcade"),
            getParityDomStructureSignature(localPage, "arcade"),
            getParityDomStructureSignature(serverPage, "arcade")
          ]);

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
          expect(serverPresentation.actionGrid.rowCount).toBe(
            localPresentation.actionGrid.rowCount
          );
          const expectedColumns = viewport.width >= 721 ? 2 : 1;
          const expectedRows = viewport.width >= 721 ? 1 : 2;
          expect(localPresentation.actionGrid.columnCount).toBe(expectedColumns);
          expect(localPresentation.actionGrid.rowCount).toBe(expectedRows);
          expect(serverPresentation.actionGrid.columnCount).toBe(expectedColumns);
          expect(serverPresentation.actionGrid.rowCount).toBe(expectedRows);

          expect(
            serverStructure,
            `${viewport.name} Herna exact DOM, copy, styles, bounds and focus contract`
          ).toEqual(localStructure);
          await attachOpenBuildingScreenshotPair({
            localPage,
            serverPage,
            testInfo,
            surfaceName: "arcade",
            buildingTypeId: "arcade",
            viewportName: viewport.name,
            panelName: "overview"
          });

          await Promise.all([
            closeSurface(localPage, "arcade"),
            closeSurface(serverPage, "arcade")
          ]);
          await Promise.all([
            closeSurface(localPage, "district"),
            closeSurface(serverPage, "district")
          ]);
        }

        if (batchIndex === parityViewportBatches.length - 1) {
          await expectNoDuplicateVisibleUi(serverPage);
          await expectHostedUiParityClean(serverPage, entry.diagnostics);
        }
      });
    }
  });
});

test.describe("live/demo spawn-reachable canonical building matrix", () => {
  test.describe.configure({ mode: "parallel" });
  test.skip(
    !hostedEnabled || !serverInstanceId,
    "Hosted matrix needs the parity server."
  );
  test.setTimeout(1_200_000);

  for (const matrixEntry of selectedSpawnReachableBuildingParityMatrix) {
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
          gangColor: entry.gangColor,
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
            localPage.locator(`${paritySurfaces.district.shell}:visible`).last()
              .locator("[data-district-building-name]"),
            `${entry.spawnDistrictId} local building card count`
          ).toHaveCount(matrixEntry.expectedDistrictBuildingTypeIds.length);
          await expect.poll(
            () => readVisibleDistrictBuildingTypeIds(serverPage),
            { message: `${entry.spawnDistrictId} authoritative building card registry` }
          ).toEqual(sortedBuildingTypeIds([
            ...matrixEntry.expectedDistrictBuildingTypeIds,
            ...STARTER_DISTRICT_PRODUCTION_BUILDING_TYPES
          ]));

          for (const buildingTypeId of matrixEntry.coveredBuildingTypeIds) {
            await openDistrictById(localPage, entry.spawnDistrictId);
            await openDistrictById(serverPage, entry.spawnDistrictId);
            const screenshotComparisons = await compareOpenBuildingParity(
              localPage,
              serverPage,
              buildingTypeId,
              { testInfo, viewport, viewportName: viewport.name }
            );
            coverage.push({
              buildingTypeId,
              screenshotClaim: "ZERO_MEANINGFUL_PIXELS_PASS",
              screenshotComparisons,
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
            channelTolerance: PARITY_PNG_CHANNEL_TOLERANCE,
            comparisons: coverage.length,
            maxMeaningfulPixels: 0,
            pixelEqualityAsserted: false,
            pixelParityAsserted: true,
            debugBuildingTypeIds: uiParityDebugBuildingTypeIds,
            comprehensiveParityGate: uiParityDebugBuildingTypeIds.length === 0,
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
