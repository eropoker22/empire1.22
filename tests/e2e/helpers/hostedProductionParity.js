import { expect, test } from "@playwright/test";
import {
  expectHostedUiParityClean,
  registerAndEnterHostedUiParityGame,
  waitForLiveGame
} from "./hostedUiParityEntry.js";
import {
  captureParitySurface,
  closeSurface,
  expectNoDuplicateVisibleUi,
  openBuildingFromDistrict,
  openDistrictById,
  paritySurfaces
} from "./uiParityCapture.js";
import {
  dismissBlockingGameOverlays,
  dismissOnboardingGuide
} from "./empireSmokeHelpers.js";

const hostedEnabled = process.env.EMPIRE_HOSTED_UI_PARITY_E2E === "1";
const serverInstanceId = process.env.EMPIRE_UI_PARITY_SERVER_ID || "";
const desktopViewport = Object.freeze({ name: "desktop-1440x900", width: 1440, height: 900 });
const mobileViewport = Object.freeze({ name: "mobile-390x844", width: 390, height: 844 });

function toProductionSnapshot(readModel, type, buildingId, recipeId = "") {
  const building = readModel?.district?.buildings?.find?.(
    (candidate) => String(candidate?.buildingId || "") === String(buildingId)
  ) || null;
  const production = type === "pharmacy"
    ? building?.pharmacy
    : type === "drugLab"
      ? building?.drugLab
      : type === "factory"
        ? building?.factory
        : building?.armory;
  const lines = type === "pharmacy" || type === "drugLab"
    ? production?.lines || []
    : production?.productionLines || [];
  const projectedLine = recipeId
    ? lines.find((candidate) => String(candidate?.recipeId || "") === recipeId) || null
    : null;
  const factorySummary = type === "factory"
    ? production?.producedSummary?.find?.(
        (candidate) => String(candidate?.resourceKey || "") === String(projectedLine?.resourceKey || "")
      ) || null
    : null;
  const line = projectedLine
    ? {
        ...projectedLine,
        producedAmount: Number(
          projectedLine.executionMode === "instant"
            ? projectedLine.playerStoredAmount
              ?? factorySummary?.currentAmount
              ?? 0
            : projectedLine.producedAmount
              ?? factorySummary?.currentAmount
              ?? 0
        ),
        producedCapacity: Number(
          projectedLine.producedCapacity
          ?? factorySummary?.capacity
          ?? 0
        )
      }
    : null;
  const resourceKey = String(line?.resourceKey || "");
  const storageItem = readModel?.player?.storage?.groups
    ?.flatMap?.((group) => group?.items || [])
    ?.find?.((item) => String(item?.resourceKey || "") === resourceKey) || null;
  return {
    serverInstanceId: readModel?.server?.serverInstanceId || null,
    currentTick: Number(readModel?.server?.currentTick ?? -1),
    stateVersion: Number(readModel?.server?.stateVersion ?? -1),
    tickRateMs: Number(readModel?.mode?.tickRateMs || 0),
    districtId: readModel?.district?.districtId || null,
    selectedDistrictId: readModel?.server?.selectedDistrictId || null,
    buildingId: building?.buildingId || null,
    buildingTypeId: building?.buildingTypeId || null,
    productionBuildingId: production?.buildingId || null,
    productionDistrictId: production?.districtId || readModel?.district?.districtId || null,
    level: Number(building?.level || production?.level || 0),
    line,
    resourceBalances: { ...(readModel?.player?.resourceBalances || {}) },
    playerBalancePerTick: { ...(readModel?.economyRates?.playerBalancePerTick || {}) },
    hasEconomyRates: Boolean(readModel?.economyRates?.playerBalancePerTick),
    storageItem: storageItem
      ? {
          resourceKey: storageItem.resourceKey,
          currentAmount: Number(storageItem.currentAmount || 0),
          maxAmount: Number(storageItem.maxAmount || 0),
          isFull: storageItem.isFull === true
        }
      : null
  };
}

async function readProductionSnapshot(page, type, buildingId, recipeId = "") {
  const readModel = await page.evaluate(() => (
    window.EmpireGameplaySliceClient?.getCurrentReadModel?.() || null
  ));
  return toProductionSnapshot(readModel, type, buildingId, recipeId);
}

async function waitForRenderedProductionState(page, {
  buildingId,
  expectedStateVersion,
  message,
  predicate,
  recipeId,
  surfaceName
}) {
  await expect.poll(async () => {
    const snapshot = await readProductionSnapshot(page, surfaceName, buildingId, recipeId);
    return snapshot.stateVersion >= expectedStateVersion && predicate(snapshot);
  }, {
    message,
    timeout: 30_000
  }).toBe(true);
}

async function findProductionControls(shell, recipeId) {
  const card = shell.locator(`article[data-resource-color="${recipeId}"]`).first();
  if (!(await card.count()) || !(await card.isVisible())) return null;
  const plus = card.getByRole("button", { name: /^Přidat výrobu /u });
  const start = card.getByRole("button", { name: /^(?:Vyrobit|Spustit)$/u });
  if (!(await start.count()) || !(await plus.count())) return null;
  return { card, plus, start };
}

async function submitAndReadResponse(page, button) {
  const startedAtMs = Date.now();
  const responsePromise = page.waitForResponse((response) => (
    response.url().includes("/api/gameplay-slice/submit")
    && response.request().method() === "POST"
  ), { timeout: 30_000 });
  await button.click();
  const response = await responsePromise;
  return {
    body: await response.json(),
    request: response.request().postDataJSON(),
    roundTripMs: Math.max(0, Date.now() - startedAtMs)
  };
}

async function openExactProductionBuilding(page, {
  buildingTypeId,
  districtId,
  surfaceName
}) {
  // The authoritative onboarding bridge can mount one render after the game
  // shell becomes ready. Production coverage is not an onboarding test, so
  // clear it before the welcome milestone that completion can synchronously
  // announce, then clear that lifecycle card before the real pointer action.
  await dismissOnboardingGuide(page);
  await dismissBlockingGameOverlays(page);
  await openDistrictById(page, districtId);
  await openBuildingFromDistrict(page, buildingTypeId);
  const shell = page.locator(paritySurfaces[surfaceName].shell);
  await expect(shell).toBeVisible({ timeout: 30_000 });
  await expect(shell).toHaveAttribute("data-ui-owner", "legacy-shared");
  await expect(shell).toHaveAttribute("data-execution-mode", "server-authoritative");
  await expect(shell).toHaveAttribute("data-server-district-id", districtId);
  await expect(shell).toHaveAttribute("data-server-building-type-id", buildingTypeId);
  const buildingId = await shell.getAttribute("data-server-building-id");
  expect(buildingId, "The visible popup must carry the exact physical server building ID").toBeTruthy();
  await expectNoDuplicateVisibleUi(page);
  return { buildingId, shell };
}

async function assertMobileSurfaceFits(page, shell) {
  const box = await shell.locator("[role='dialog']").first().boundingBox();
  expect(box).toBeTruthy();
  expect(box.x).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width).toBeLessThanOrEqual(391);
  const overflow = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth + 1);
}

function assertProductionIdentity(snapshot, {
  buildingId,
  buildingTypeId,
  districtId,
  recipeId,
  resourceKey,
  serverInstanceId: expectedServerInstanceId
}) {
  expect(snapshot.serverInstanceId).toBe(expectedServerInstanceId);
  expect(snapshot.districtId).toBe(districtId);
  expect(snapshot.selectedDistrictId).toBe(districtId);
  expect(snapshot.buildingId).toBe(buildingId);
  expect(snapshot.buildingTypeId).toBe(buildingTypeId);
  expect(snapshot.productionBuildingId).toBe(buildingId);
  expect(snapshot.productionDistrictId).toBe(districtId);
  expect(snapshot.line).toMatchObject({
    recipeId,
    resourceKey
  });
}

function getUnitReservationCosts(line) {
  return Object.fromEntries([
    ["cash", Math.max(0, Number(line?.unitCleanCashCost || 0))],
    ...Object.entries(line?.materialInputCosts || {})
      .map(([resourceKey, amount]) => [resourceKey, Math.max(0, Number(amount || 0))])
  ].filter(([, amount]) => amount > 0));
}

export function assertBalanceTransition(before, after, commandDeltas, message) {
  const tickGap = after.currentTick - before.currentTick;
  expect(tickGap, `${message}: server tick must not move backwards`).toBeGreaterThanOrEqual(0);
  if (tickGap > 0) {
    expect(before.hasEconomyRates, `${message}: tick crossing requires the authoritative rate projection`).toBe(true);
  }
  const evidence = {};
  for (const [resourceKey, commandDelta] of Object.entries(commandDeltas)) {
    const beforeBalance = Number(before.resourceBalances[resourceKey] || 0);
    const passivePerTick = Number(before.playerBalancePerTick[resourceKey] || 0);
    const expected = beforeBalance + passivePerTick * tickGap + Number(commandDelta || 0);
    const actual = Number(after.resourceBalances[resourceKey] || 0);
    expect(actual, `${message}: exact ${resourceKey} balance`).toBeCloseTo(expected, 10);
    evidence[resourceKey] = {
      before: beforeBalance,
      tickGap,
      passivePerTick,
      commandDelta: Number(commandDelta || 0),
      expected,
      actual
    };
  }
  return evidence;
}

function assertPassiveBalanceTransition(before, after, resourceKey, message) {
  const tickGap = after.currentTick - before.currentTick;
  expect(tickGap, `${message}: server tick must not move backwards`).toBeGreaterThanOrEqual(0);
  if (tickGap > 0) {
    expect(before.hasEconomyRates, `${message}: tick crossing requires the authoritative rate projection`).toBe(true);
  }
  const beforeBalance = Number(before.resourceBalances[resourceKey] || 0);
  const passivePerTick = Number(before.playerBalancePerTick[resourceKey] || 0);
  const expected = beforeBalance + passivePerTick * tickGap;
  const actual = Number(after.resourceBalances[resourceKey] || 0);
  expect(actual, `${message}: exact ${resourceKey} balance`).toBeCloseTo(expected, 10);
  return {
    before: beforeBalance,
    tickGap,
    passivePerTick,
    commandDelta: 0,
    expected,
    actual
  };
}

function multiplyCosts(costs, multiplier) {
  return Object.fromEntries(
    Object.entries(costs).map(([resourceKey, amount]) => [
      resourceKey,
      Number(amount || 0) * multiplier
    ])
  );
}

function invertCosts(costs) {
  return multiplyCosts(costs, -1);
}

function summarizeCommand(request) {
  return {
    focusDistrictId: request?.focusDistrictId || null,
    expectedStateVersion: request?.expectedStateVersion ?? null,
    command: {
      type: request?.command?.type || null,
      commandId: request?.command?.id || request?.command?.commandId || null,
      payload: { ...(request?.command?.payload || {}) }
    }
  };
}

function summarizeSnapshot(snapshot, resourceKeys) {
  return {
    serverInstanceId: snapshot.serverInstanceId,
    currentTick: snapshot.currentTick,
    stateVersion: snapshot.stateVersion,
    tickRateMs: snapshot.tickRateMs,
    districtId: snapshot.districtId,
    buildingId: snapshot.buildingId,
    buildingTypeId: snapshot.buildingTypeId,
    productionBuildingId: snapshot.productionBuildingId,
    productionDistrictId: snapshot.productionDistrictId,
    level: snapshot.level,
    line: snapshot.line
      ? {
          recipeId: snapshot.line.recipeId,
          resourceKey: snapshot.line.resourceKey,
          producedAmount: snapshot.line.producedAmount,
          producedCapacity: snapshot.line.producedCapacity,
          queuedAmount: snapshot.line.queuedAmount,
          queueCapacity: snapshot.line.queueCapacity,
          activeAmount: snapshot.line.activeAmount,
          waitingAmount: snapshot.line.waitingAmount,
          unitCleanCashCost: snapshot.line.unitCleanCashCost,
          materialInputCosts: { ...(snapshot.line.materialInputCosts || {}) },
          effectiveUnitDurationTicks: snapshot.line.effectiveUnitDurationTicks,
          remainingTicks: snapshot.line.remainingTicks,
          canStart: snapshot.line.canStart,
          canCancelWaiting: snapshot.line.canCancelWaiting,
          canCollect: snapshot.line.canCollect,
          status: snapshot.line.status
        }
      : null,
    resourceBalances: Object.fromEntries(
      resourceKeys.map((resourceKey) => [
        resourceKey,
        Number(snapshot.resourceBalances[resourceKey] || 0)
      ])
    ),
    playerBalancePerTick: Object.fromEntries(
      resourceKeys.map((resourceKey) => [
        resourceKey,
        Number(snapshot.playerBalancePerTick[resourceKey] || 0)
      ])
    ),
    storageItem: snapshot.storageItem
  };
}

async function attachScreenshot(testInfo, name, page) {
  if (!name) return;
  await testInfo.attach(name, {
    body: await page.screenshot({ animations: "disabled", fullPage: false }),
    contentType: "image/png"
  });
}

export async function exerciseHostedProductionLifecycleThroughVisibleUi({
  buildingTypeId,
  captureInfoScreenshotName = "",
  captureInitialParity = false,
  captureStartedScreenshotName = "",
  districtId,
  expectedInitialPlayerOutput = null,
  expectedServerInstanceId = serverInstanceId,
  label,
  onWorkerPollingStarted = () => {},
  page,
  recipeId,
  resourceKey,
  surfaceName,
  evidenceAttachmentName = surfaceName + "-authoritative-instant-production.json",
  testInfo
}) {
  let opened = await openExactProductionBuilding(page, {
    buildingTypeId,
    districtId,
    surfaceName
  });
  const shell = opened.shell;
  const buildingId = opened.buildingId;
  const identity = {
    buildingId,
    buildingTypeId,
    districtId,
    recipeId,
    resourceKey,
    serverInstanceId: expectedServerInstanceId
  };

  if (captureInitialParity) {
    await captureParitySurface(page, {
      mode: "server-authoritative",
      phase: "after",
      viewport: desktopViewport,
      surfaceName
    });
  }
  if (captureInfoScreenshotName) {
    await shell.getByRole("button", { name: "Info", exact: true }).click();
    await attachScreenshot(testInfo, captureInfoScreenshotName, page);
    await shell.getByRole("button", { name: "Výroba", exact: true }).click();
  }

  const initial = await readProductionSnapshot(page, surfaceName, buildingId, recipeId);
  assertProductionIdentity(initial, identity);
  expect(initial.line).toMatchObject({
    executionMode: "instant",
    queuedAmount: 0,
    activeAmount: 0,
    waitingAmount: 0,
    remainingTicks: 0,
    canCancelWaiting: false,
    canCollect: false,
    canStart: true
  });
  expect(initial.line?.producedAmount).toBe(
    Number(initial.resourceBalances[resourceKey] || 0)
  );
  if (expectedInitialPlayerOutput !== null) {
    expect(initial.resourceBalances[resourceKey]).toBe(expectedInitialPlayerOutput);
  }
  expect(initial.storageItem?.isFull).toBe(false);
  expect(initial.storageItem?.maxAmount || 0).toBeGreaterThan(0);
  expect(initial.storageItem?.currentAmount).toBe(
    Number(initial.resourceBalances[resourceKey] || 0)
  );

  const controls = await findProductionControls(shell, recipeId);
  expect(controls, label + " must expose the canonical " + recipeId + " card").toBeTruthy();
  await expect(controls.start).toHaveText("Vyrobit");
  await expect(controls.plus).toBeVisible();
  await expect(controls.plus).toBeEnabled();
  await controls.plus.click();

  const unitCosts = getUnitReservationCosts(initial.line);
  expect(Object.keys(unitCosts).length).toBeGreaterThan(0);
  const producedQuantity = 2;
  const produced = await submitAndReadResponse(page, controls.start);
  expect(produced.request?.command?.type).toBe("craft-item");
  expect(produced.request?.command?.payload).toMatchObject({
    districtId,
    buildingId,
    recipeId,
    quantity: producedQuantity
  });
  expect(produced.body?.accepted).toBe(true);

  const afterProduction = toProductionSnapshot(
    produced.body?.readModel,
    surfaceName,
    buildingId,
    recipeId
  );
  assertProductionIdentity(afterProduction, identity);
  expect(afterProduction.stateVersion).toBeGreaterThan(initial.stateVersion);
  expect(afterProduction.line).toMatchObject({
    executionMode: "instant",
    queuedAmount: 0,
    activeAmount: 0,
    waitingAmount: 0,
    remainingTicks: 0,
    canCancelWaiting: false,
    canCollect: false
  });

  const commandDeltas = invertCosts(multiplyCosts(unitCosts, producedQuantity));
  commandDeltas[resourceKey] = Number(commandDeltas[resourceKey] || 0) + producedQuantity;
  const productionBalanceEvidence = assertBalanceTransition(
    initial,
    afterProduction,
    commandDeltas,
    label + " instant atomic production"
  );
  expect(afterProduction.line?.producedAmount).toBe(
    Number(afterProduction.resourceBalances[resourceKey] || 0)
  );
  expect(afterProduction.storageItem?.currentAmount).toBe(
    Number(afterProduction.resourceBalances[resourceKey] || 0)
  );

  await waitForRenderedProductionState(page, {
    buildingId,
    expectedStateVersion: afterProduction.stateVersion,
    message: label + " command response must render without waiting for worker polling",
    predicate: (snapshot) => (
      snapshot.line?.executionMode === "instant"
      && snapshot.line?.queuedAmount === 0
      && snapshot.line?.activeAmount === 0
      && snapshot.line?.waitingAmount === 0
      && Number(snapshot.resourceBalances[resourceKey] || 0)
        === Number(afterProduction.resourceBalances[resourceKey] || 0)
    ),
    recipeId,
    surfaceName
  });
  await expect(shell).toBeVisible();
  await attachScreenshot(testInfo, captureStartedScreenshotName, page);

  const timing = {
    executionMode: "instant",
    completionWaitMs: 0,
    roundTripMs: produced.roundTripMs,
    server: produced.body?.metadata?.commandTiming || null
  };
  await onWorkerPollingStarted({
    buildingId,
    districtId,
    stateVersion: afterProduction.stateVersion,
    timing
  });

  await page.reload({ waitUntil: "load" });
  await waitForLiveGame(page, expectedServerInstanceId);
  opened = await openExactProductionBuilding(page, {
    buildingTypeId,
    districtId,
    surfaceName
  });
  expect(opened.buildingId).toBe(buildingId);
  const persisted = await readProductionSnapshot(page, surfaceName, buildingId, recipeId);
  assertProductionIdentity(persisted, identity);
  expect(persisted.stateVersion).toBeGreaterThanOrEqual(afterProduction.stateVersion);
  const reloadBalanceEvidence = assertPassiveBalanceTransition(
    afterProduction,
    persisted,
    resourceKey,
    label + " instant output persistence after reload"
  );
  expect(persisted.line).toMatchObject({
    executionMode: "instant",
    queuedAmount: 0,
    activeAmount: 0,
    waitingAmount: 0,
    remainingTicks: 0,
    canCancelWaiting: false,
    canCollect: false
  });
  expect(persisted.line?.producedAmount).toBe(
    Number(persisted.resourceBalances[resourceKey] || 0)
  );

  const resourceKeys = Array.from(new Set([
    "cash",
    resourceKey,
    ...Object.keys(unitCosts)
  ]));
  const evidence = {
    schemaVersion: 2,
    authority: "server-authoritative-visible-ui",
    productionMode: "instant-atomic",
    identity,
    unitProductionCosts: unitCosts,
    commands: {
      produce: summarizeCommand(produced.request)
    },
    balanceEvidence: {
      atomicProduction: productionBalanceEvidence,
      reloadAfterProduction: reloadBalanceEvidence
    },
    timing,
    snapshots: {
      initial: summarizeSnapshot(initial, resourceKeys),
      afterProduction: summarizeSnapshot(afterProduction, resourceKeys),
      afterReload: summarizeSnapshot(persisted, resourceKeys)
    },
    persistence: {
      outputPersisted: true,
      noQueueCreated: true,
      noCollectCommandRequired: true
    }
  };
  await testInfo.attach(evidenceAttachmentName, {
    body: Buffer.from(JSON.stringify(evidence, null, 2) + "\n"),
    contentType: "application/json"
  });
  return {
    evidence,
    shell: opened.shell
  };
}

export function defineHostedProductionParityTest({
  buildingTypeId,
  identityPrefix,
  label,
  recipeId,
  resourceKey,
  spawnDistrictIds,
  surfaceName
}) {
  test.describe(`hosted ${label} presentation`, () => {
    test.skip(
      !hostedEnabled || !serverInstanceId,
      "Set EMPIRE_HOSTED_UI_PARITY_E2E=1 and EMPIRE_UI_PARITY_SERVER_ID for hosted PostgreSQL coverage."
    );
    test.setTimeout(360_000);

    test(`uses the shared ${label} modal and completes production through visible UI`, async ({
      page
    }, testInfo) => {
      await page.setViewportSize(desktopViewport);
      const entry = await registerAndEnterHostedUiParityGame(page, {
        serverInstanceId,
        spawnDistrictIds,
        identityPrefix
      });
      const result = await exerciseHostedProductionLifecycleThroughVisibleUi({
        baseTestTimeoutMs: 360_000,
        buildingTypeId,
        captureInitialParity: true,
        districtId: entry.spawnDistrictId,
        expectedInitialPlayerOutput: 0,
        expectedServerInstanceId: serverInstanceId,
        label,
        page,
        recipeId,
        resourceKey,
        surfaceName,
        testInfo
      });

      await page.setViewportSize(mobileViewport);
      await assertMobileSurfaceFits(page, result.shell);
      await captureParitySurface(page, {
        mode: "server-authoritative",
        phase: "after",
        viewport: mobileViewport,
        surfaceName
      });
      await expectNoDuplicateVisibleUi(page);
      await closeSurface(page, surfaceName);
      await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe("hidden");
      await expectHostedUiParityClean(page, entry.diagnostics);
      expect(entry.diagnostics.submitRequests
        .map((request) => request?.command?.type)
        .filter((type) => type === "craft-item" || type === "collect-production"))
        .toEqual(["craft-item"]);
    });
  });
}
