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
  "power_station",
  "recycling_center",
  "stock_exchange",
  "vip_lounge",
  "warehouse"
]);
const authorityDynamicEffectNumberPattern = "[0-9](?:[0-9.,\\u00a0\\u202f ]*[0-9])?";
const authorityDynamicCashRatePattern = new RegExp(
  `^((Clean|Dirty) cash\\s+[+-]?\\$)(${authorityDynamicEffectNumberPattern})(\\/hod)$`,
  "u"
);
const authorityDynamicInfluenceRatePattern = new RegExp(
  `^(Vliv\\s+[+-]?)(${authorityDynamicEffectNumberPattern})(\\/den)$`,
  "u"
);
const authorityDynamicHeatRatePattern = new RegExp(
  `^(Heat\\s+[+-]?)(${authorityDynamicEffectNumberPattern})(\\/den)$`,
  "u"
);
const authorityDynamicPhaseCashHeatPattern = new RegExp(
  `^((?:DEN|NOC):\\s+(clean|dirty)\\s+[+-]?\\$)(${authorityDynamicEffectNumberPattern})(\\/h\\s+->\\s+[+-]?\\$)(${authorityDynamicEffectNumberPattern})(\\/h\\s+·\\s+heat\\s+)(${authorityDynamicEffectNumberPattern})(\\/den\\s+->\\s+)(${authorityDynamicEffectNumberPattern})(\\/den)$`,
  "iu"
);
const authorityDynamicPhaseCashPattern = new RegExp(
  `^((?:DEN|NOC):\\s+(clean|dirty)\\s+[+-]?\\$)(${authorityDynamicEffectNumberPattern})(\\/h\\s+->\\s+[+-]?\\$)(${authorityDynamicEffectNumberPattern})(\\/h(?:\\s+·\\s+.*)?)$`,
  "iu"
);
const authorityDynamicPhaseHeatPattern = new RegExp(
  `^((?:DEN|NOC):\\s+heat\\s+)(${authorityDynamicEffectNumberPattern})(\\/den\\s+->\\s+)(${authorityDynamicEffectNumberPattern})(\\/den)$`,
  "iu"
);
const areAuthorityEvidenceValuesStrictlyEqual = (actual, expected) => {
  if (typeof actual === "number" || typeof expected === "number") {
    return Number.isFinite(actual)
      && Number.isFinite(expected)
      && Object.is(actual, expected);
  }
  if (typeof actual !== typeof expected || !["boolean", "string"].includes(typeof actual)) {
    return false;
  }
  return Object.is(actual, expected);
};
const isAuthorityValueProven = (evidence, key) => (
  Object.hasOwn(evidence?.actual || {}, key)
  && Object.hasOwn(evidence?.expected || {}, key)
  && areAuthorityEvidenceValuesStrictlyEqual(evidence.actual[key], evidence.expected[key])
);
const normalizeAuthorityDynamicPresentation = (presentation, evidence) => {
  const normalizeValue = (key, value, token = key) => (
    isAuthorityValueProven(evidence, key) ? `<dynamic:${token}>` : value
  );
  const normalizeText = (value) => {
    const normalized = String(value || "");
    let match = normalized.match(authorityDynamicCashRatePattern);
    if (match) {
      const cashKind = match[2].toLowerCase();
      return `${match[1]}${normalizeValue(`${cashKind}-cash-rate`, match[3], "cash")}${match[4]}`;
    }
    match = normalized.match(authorityDynamicInfluenceRatePattern);
    if (match) {
      return `${match[1]}${normalizeValue("influence-rate", match[2], "influence")}${match[3]}`;
    }
    match = normalized.match(authorityDynamicHeatRatePattern);
    if (match) {
      return `${match[1]}${normalizeValue("heat-rate", match[2], "heat")}${match[3]}`;
    }
    match = normalized.match(authorityDynamicPhaseCashHeatPattern);
    if (match) {
      const cashKind = match[2].toLowerCase();
      return [
        match[1],
        normalizeValue(`phase-${cashKind}-cash-base`, match[3], "cash"),
        match[4],
        normalizeValue(`phase-${cashKind}-cash-effective`, match[5], "cash"),
        match[6],
        normalizeValue("phase-heat-base", match[7], "heat"),
        match[8],
        normalizeValue("phase-heat-effective", match[9], "heat"),
        match[10]
      ].join("");
    }
    match = normalized.match(authorityDynamicPhaseCashPattern);
    if (match) {
      const cashKind = match[2].toLowerCase();
      return [
        match[1],
        normalizeValue(`phase-${cashKind}-cash-base`, match[3], "cash"),
        match[4],
        normalizeValue(`phase-${cashKind}-cash-effective`, match[5], "cash"),
        match[6]
      ].join("");
    }
    match = normalized.match(authorityDynamicPhaseHeatPattern);
    return match
      ? [
          match[1],
          normalizeValue("phase-heat-base", match[2], "heat"),
          match[3],
          normalizeValue("phase-heat-effective", match[4], "heat"),
          match[5]
        ].join("")
      : normalized;
  };
  const normalizePresentationEntry = (entry) => {
    if (typeof entry === "string") return normalizeText(entry);
    if (!entry || typeof entry !== "object") return entry;
    return {
      ...entry,
      text: normalizeText(entry.text)
    };
  };
  return {
    ...presentation,
    effects: presentation.effects.map(normalizePresentationEntry),
    visibleCopy: presentation.visibleCopy.map(normalizePresentationEntry)
  };
};
const authorityDynamicTextSelector = "[data-building-dynamic-effect]";
test.use({ trace: "off", video: "off" });

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
            const hostedAuthorityEvidence = await collectBuildingAuthorityEvidence(
              serverPage,
              surfaceName,
              buildingTypeId
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
              hostedAuthorityEvidence.actual,
              `${buildingTypeId}/${viewport.name} authority-backed values must match the authoritative projection: ${JSON.stringify(hostedAuthorityEvidence)}`
            ).toEqual(hostedAuthorityEvidence.expected);
            if (buildingTypeId === "power_station") {
              expect(
                hostedAuthorityEvidence.projectedActionEvidence,
                `${buildingTypeId}/${viewport.name} must prove its authoritative reduce-heat action`
              ).toHaveProperty("power_station_reduce_heat");
            }
            expect(
              normalizeAuthorityDynamicPresentation(hostedPresentation, hostedAuthorityEvidence),
              `${buildingTypeId}/${viewport.name} visible presentation`
            ).toEqual(normalizeAuthorityDynamicPresentation(
              localPresentation,
              hostedAuthorityEvidence
            ));
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

async function collectBuildingAuthorityEvidence(page, surfaceName, buildingTypeId) {
  const surface = page.locator(`${paritySurfaces[surfaceName].selector}:visible`).last();
  return surface.evaluate((surfaceElement, expectedBuildingTypeId) => {
    const readModel = window.EmpireGameplaySliceClient?.getCurrentReadModel?.()
      || window.empireStreetsGameplaySliceReadModel
      || null;
    const building = (readModel?.district?.buildings || []).find(
      (entry) => entry?.buildingTypeId === expectedBuildingTypeId
    ) || null;
    if (!building) {
      throw new Error(`Authoritative building ${expectedBuildingTypeId} is missing from the selected district.`);
    }

    const parseNumber = (value) => {
      const normalized = String(value || "")
        .replace(/[\u00a0\u202f\s]/gu, "")
        .replace(",", ".");
      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : null;
    };
    const normalizeText = (value) => String(value || "").replace(/\s+/gu, " ").trim();
    const formatMoney = (value) => {
      const amount = Math.max(0, Math.floor(Number(value) || 0));
      return `$${Number(amount.toFixed(1))}`;
    };
    const formatCooldown = (value) => {
      const seconds = Math.max(0, Math.ceil(Number(value || 0) / 1000));
      const minutes = Math.floor(seconds / 60);
      const remainder = seconds % 60;
      return minutes > 0
        ? `${minutes}m ${String(remainder).padStart(2, "0")}s`
        : `${remainder}s`;
    };
    const actual = Object.fromEntries(Array.from(
      surfaceElement.querySelectorAll("[data-building-dynamic-effect]")
    ).filter((element) => (
      element.closest(".district-building-detail-effect-cell")?.offsetParent !== null
    )).map((element) => [
      String(element.dataset.buildingDynamicEffect || ""),
      parseNumber(element.textContent)
    ]));
    const expected = {};
    const passive = building.presentation?.passive || {};
    const visibleEffectTexts = Array.from(
      surfaceElement.querySelectorAll(".district-building-detail-effect-cell")
    ).filter((element) => element.offsetParent !== null)
      .map((element) => normalizeText(element.textContent));
    for (const effectText of visibleEffectTexts) {
      const cashRateMatch = effectText.match(/^(Clean|Dirty) cash\s+[+-]?\$/u);
      if (cashRateMatch) {
        const cashKind = cashRateMatch[1].toLowerCase();
        expected[`${cashKind}-cash-rate`] = Math.max(
          0,
          Math.floor(Number(passive[`${cashKind}PerHour`] || 0))
        );
      }
      if (/^Vliv\s+[+-]?[0-9]/u.test(effectText)) {
        expected["influence-rate"] = Number(
          Math.max(0, Number(passive.influencePerDay || 0)).toFixed(2)
        );
      }
      if (/^Heat\s+[+-]?[0-9]/u.test(effectText)) {
        expected["heat-rate"] = Number(
          Math.max(0, Number(passive.heatPerDay || 0)).toFixed(2)
        );
      }
    }

    const phaseStat = String(
      (building.stats || []).find((stat) => stat?.label === "Efekt fáze")?.value || ""
    );
    const numberPattern = "([0-9](?:[0-9.,\\u00a0\\u202f ]*[0-9])?)";
    const visiblePhaseCashKinds = new Set(visibleEffectTexts.map((effectText) => (
      effectText.match(/^(?:DEN|NOC):\s+(clean|dirty)\s+[+-]?\$/iu)?.[1]?.toLowerCase() || ""
    )).filter(Boolean));
    for (const cashKind of visiblePhaseCashKinds) {
      const baseKey = `phase-${cashKind}-cash-base`;
      const effectiveKey = `phase-${cashKind}-cash-effective`;
      const phaseMatch = phaseStat.match(new RegExp(
        `${cashKind}\\s+\\$${numberPattern}\\/h\\s+->\\s+\\$${numberPattern}\\/h`,
        "iu"
      ));
      expected[baseKey] = parseNumber(phaseMatch?.[1]);
      expected[effectiveKey] = parseNumber(phaseMatch?.[2]);
    }
    if (visibleEffectTexts.some((effectText) => (
      /^(?:DEN|NOC):.*\bheat\s+[0-9]/iu.test(effectText)
    ))) {
      const phaseHeatMatch = phaseStat.match(new RegExp(
        `heat\\s+${numberPattern}\\/den\\s+->\\s+${numberPattern}\\/den`,
        "iu"
      ));
      expected["phase-heat-base"] = parseNumber(phaseHeatMatch?.[1]);
      expected["phase-heat-effective"] = parseNumber(phaseHeatMatch?.[2]);
    }

    for (const key of new Set([...Object.keys(actual), ...Object.keys(expected)])) {
      if (!Number.isFinite(actual[key]) || !Number.isFinite(expected[key])) {
        throw new Error(
          `Authority-backed numeric effect ${key} is missing or not finite for ${expectedBuildingTypeId}.`
        );
      }
    }

    const projectedActionEvidence = {};
    for (const actionId of ["power_station_reduce_heat"]) {
      const actionRows = Array.from(surfaceElement.querySelectorAll(
        `[data-district-building-detail-action-id="${actionId}"]`
      )).filter((element) => element.offsetParent !== null);

      const action = [
        ...(building.specialActions || []),
        ...(building.actions || [])
      ].reverse().find((entry) => entry?.actionId === actionId);
      if (expectedBuildingTypeId !== "power_station") {
        if (actionRows.length > 0 || action) {
          throw new Error(`Unexpected authoritative action ${actionId} is exposed by ${expectedBuildingTypeId}.`);
        }
        continue;
      }
      if (actionRows.length !== 1 || !(actionRows[0] instanceof HTMLButtonElement)) {
        throw new Error(
          `Expected exactly one visible ${actionId} action row for ${expectedBuildingTypeId}, received ${actionRows.length}.`
        );
      }
      if (!action) {
        throw new Error(`Authoritative action ${actionId} is missing from ${expectedBuildingTypeId}.`);
      }
      const actionRow = actionRows[0];

      const keyPrefix = `action-${actionId}`;
      const disabledReason = normalizeText(
        action.disabledReason || action.blockedReason || action.phaseBlockedReason
      );
      const expectedEnabled = action.enabled !== false
        && action.disabled !== true
        && !disabledReason;
      const costRecord = [
        action.effectiveInputCost,
        action.inputCost,
        action.cost
      ].find((value) => value && typeof value === "object" && !Array.isArray(value)) || {};
      const cleanCost = Number(costRecord.cash ?? costRecord["clean-cash"]);
      const expectedCostLabel = Number.isFinite(cleanCost) && cleanCost > 0
        ? `${formatMoney(cleanCost)} clean cash`
        : null;
      const cooldownRemainingTicks = Math.max(
        0,
        Number(action.cooldownRemainingTicks || 0)
      );
      const tickRateMs = Math.max(1, Number(readModel?.mode?.tickRateMs || 1));
      const cooldownRemainingMs = Math.max(
        0,
        Number(action.cooldownRemainingMs || 0) || cooldownRemainingTicks * tickRateMs
      );
      const effectiveCooldownMs = Math.max(
        0,
        Number(action.effectiveCooldownMs || action.cooldownMs || 0)
      );

      actual[`${keyPrefix}-enabled`] = !actionRow.disabled;
      expected[`${keyPrefix}-enabled`] = expectedEnabled;
      actual[`${keyPrefix}-inline-description`] = normalizeText(
        actionRow.querySelector(".building-info-action-row__desc")?.textContent
      );
      expected[`${keyPrefix}-inline-description`] = expectedEnabled
        ? expectedCostLabel
        : disabledReason || expectedCostLabel;
      actual[`${keyPrefix}-cooldown-label`] = normalizeText(
        actionRow.querySelector(".building-info-action-row__cooldown")?.textContent
      );
      expected[`${keyPrefix}-cooldown-label`] = cooldownRemainingMs > 0
        ? `Zbývá ${formatCooldown(cooldownRemainingMs)}`
        : effectiveCooldownMs > 0
          ? `Čekání ${formatCooldown(effectiveCooldownMs)}`
          : "Připraveno";
      projectedActionEvidence[actionId] = {
        cleanCost: Number.isFinite(cleanCost) ? cleanCost : null,
        cooldownRemainingMs,
        effectiveCooldownMs,
        enabled: expectedEnabled
      };
    }

    return {
      actual,
      expected,
      phaseStat,
      projectedActionEvidence,
      projectedPassive: passive
    };
  }, buildingTypeId);
}
