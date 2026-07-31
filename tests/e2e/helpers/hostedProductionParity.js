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

const hostedEnabled = process.env.EMPIRE_HOSTED_UI_PARITY_E2E === "1";
const serverInstanceId = process.env.EMPIRE_UI_PARITY_SERVER_ID || "";
const desktopViewport = Object.freeze({ name: "desktop-1440x900", width: 1440, height: 900 });
const mobileViewport = Object.freeze({ name: "mobile-390x844", width: 390, height: 844 });
const completionHeadroomTicks = 3;
const maximumProductionLifecycleTimeoutMs = 30 * 60_000;

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
          projectedLine.producedAmount
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
  const start = card.getByRole("button", { name: "Spustit", exact: true });
  const cancel = card.getByRole("button", { name: /^Zrušit čekající výrobu /u });
  if (!(await start.count()) || !(await plus.count()) || !(await cancel.count())) return null;
  return { card, plus, start, cancel };
}

async function findEnabledButton(buttons) {
  for (let index = 0; index < await buttons.count(); index += 1) {
    const button = buttons.nth(index);
    if (await button.isVisible() && await button.isEnabled()) return button;
  }
  return null;
}

async function waitForEnabledButton(buttons, message) {
  await expect.poll(async () => Boolean(await findEnabledButton(buttons)), {
    message,
    timeout: 30_000
  }).toBe(true);
  return findEnabledButton(buttons);
}

async function submitAndReadResponse(page, button) {
  const responsePromise = page.waitForResponse((response) => (
    response.url().includes("/api/gameplay-slice/submit")
    && response.request().method() === "POST"
  ), { timeout: 30_000 });
  await button.click();
  const response = await responsePromise;
  return {
    body: await response.json(),
    request: response.request().postDataJSON()
  };
}

async function openExactProductionBuilding(page, {
  buildingTypeId,
  districtId,
  surfaceName
}) {
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

function assertBalanceTransition(before, after, commandDeltas, message) {
  const tickGap = after.currentTick - before.currentTick;
  expect(tickGap, `${message}: server tick must not move backwards`).toBeGreaterThanOrEqual(0);
  expect(tickGap, `${message}: visible command sequence must fit within one authoritative tick`).toBeLessThanOrEqual(1);
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

function createCompletionTiming(snapshot) {
  const remainingTicks = Math.max(1, Math.ceil(Number(snapshot.line?.remainingTicks || 0)));
  const tickRateMs = Math.max(1, Math.ceil(Number(snapshot.tickRateMs || 0)));
  return {
    remainingTicks,
    tickRateMs,
    expectedCompletionTick: snapshot.currentTick + remainingTicks,
    projectedDurationMs: remainingTicks * tickRateMs,
    headroomTicks: completionHeadroomTicks,
    timeoutMs: (remainingTicks + completionHeadroomTicks) * tickRateMs,
    intervals: [
      Math.max(250, Math.min(2_000, Math.floor(tickRateMs / 4))),
      Math.max(1_000, Math.min(5_000, Math.floor(tickRateMs / 2)))
    ]
  };
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
  baseTestTimeoutMs,
  buildingTypeId,
  captureInfoScreenshotName = "",
  captureInitialParity = false,
  captureStartedScreenshotName = "",
  districtId,
  expectedInitialPlayerOutput = null,
  expectedServerInstanceId = serverInstanceId,
  label,
  maxTestTimeoutMs = maximumProductionLifecycleTimeoutMs,
  onWorkerPollingStarted = () => {},
  page,
  recipeId,
  resourceKey,
  surfaceName,
  evidenceAttachmentName = `${surfaceName}-authoritative-production-lifecycle.json`,
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
      expect(initial.line?.canStart, `${label} ${recipeId} must be startable`).toBe(true);
      expect(initial.line?.producedAmount).toBe(0);
      if (expectedInitialPlayerOutput !== null) {
        expect(initial.resourceBalances[resourceKey]).toBe(expectedInitialPlayerOutput);
      }
      expect(initial.storageItem?.isFull).toBe(false);
      expect(initial.storageItem?.maxAmount || 0).toBeGreaterThan(0);
      expect(initial.storageItem?.currentAmount).toBe(
        Number(initial.resourceBalances[resourceKey] || 0)
      );

      const initialControls = await findProductionControls(shell, recipeId);
      expect(initialControls, `${label} must expose the canonical ${recipeId} card`).toBeTruthy();
      await expect(initialControls.plus).toBeVisible();
      await expect(initialControls.plus).toBeEnabled();
      await initialControls.plus.click();
      const started = await submitAndReadResponse(page, initialControls.start);
      expect(started.request?.command?.type).toBe("craft-item");
      expect(started.request?.command?.payload?.districtId).toBe(districtId);
      expect(started.request?.command?.payload?.buildingId).toBe(buildingId);
      expect(started.request?.command?.payload?.recipeId).toBe(recipeId);
      expect(started.request?.command?.payload?.quantity).toBe(2);
      expect(started.body?.accepted).toBe(true);
      const afterStart = toProductionSnapshot(
        started.body?.readModel,
        surfaceName,
        buildingId,
        recipeId
      );
      assertProductionIdentity(afterStart, identity);
      expect(afterStart.stateVersion).toBeGreaterThan(initial.stateVersion);
      expect(afterStart.line).toMatchObject({
        queuedAmount: 2,
        activeAmount: 1,
        waitingAmount: 1,
        canCancelWaiting: true
      });
      const unitCosts = getUnitReservationCosts(afterStart.line);
      expect(Object.keys(unitCosts).length).toBeGreaterThan(0);
      const startReservationEvidence = assertBalanceTransition(
        initial,
        afterStart,
        invertCosts(multiplyCosts(unitCosts, 2)),
        `${label} initial two-unit reservation`
      );
      await waitForRenderedProductionState(page, {
        buildingId,
        expectedStateVersion: afterStart.stateVersion,
        message: `${label} start response must render before cancellation`,
        predicate: (snapshot) => (
          snapshot.line?.queuedAmount === 2
          && snapshot.line?.waitingAmount === 1
        ),
        recipeId,
        surfaceName
      });
      await expect(shell).toBeVisible();
      await attachScreenshot(testInfo, captureStartedScreenshotName, page);

      const startedControls = await findProductionControls(shell, recipeId);
      expect(startedControls).toBeTruthy();
      const cancel = await waitForEnabledButton(
        startedControls.card.getByRole("button", { name: /^Zrušit čekající výrobu /u }),
        `${label} must expose cancellation for the waiting reserved unit`
      );
      expect(cancel, "A queued second unit must expose the authoritative cancel action").toBeTruthy();
      const cancelled = await submitAndReadResponse(page, cancel);
      const expectedCancelType = surfaceName === "pharmacy"
        ? "cancel-pharmacy-production"
        : surfaceName === "drugLab"
          ? "cancel-drug-lab-production"
          : "cancel-production-line";
      expect(cancelled.request?.command?.type).toBe(expectedCancelType);
      expect(cancelled.request?.command?.payload?.districtId).toBe(districtId);
      expect(cancelled.request?.command?.payload?.buildingId).toBe(buildingId);
      expect(cancelled.request?.command?.payload?.recipeId).toBe(recipeId);
      expect(cancelled.body?.accepted).toBe(true);
      const afterCancel = toProductionSnapshot(
        cancelled.body?.readModel,
        surfaceName,
        buildingId,
        recipeId
      );
      assertProductionIdentity(afterCancel, identity);
      expect(afterCancel.line).toMatchObject({
        queuedAmount: 1,
        activeAmount: 1,
        waitingAmount: 0,
        canCancelWaiting: false
      });
      const cancellationRefundEvidence = assertBalanceTransition(
        afterStart,
        afterCancel,
        unitCosts,
        `${label} exact waiting-unit reservation refund`
      );
      await waitForRenderedProductionState(page, {
        buildingId,
        expectedStateVersion: afterCancel.stateVersion,
        message: `${label} cancellation response must render before the new start`,
        predicate: (snapshot) => (
          snapshot.line?.queuedAmount === 1
          && snapshot.line?.waitingAmount === 0
        ),
        recipeId,
        surfaceName
      });
      await expect(shell).toBeVisible();

      const cancelledControls = await findProductionControls(shell, recipeId);
      expect(cancelledControls).toBeTruthy();
      const restart = await waitForEnabledButton(
        cancelledControls.card.getByRole("button", { name: "Spustit", exact: true }),
        `${label} must allow one new visible queued unit`
      );
      const restarted = await submitAndReadResponse(page, restart);
      expect(restarted.request?.command?.type).toBe("craft-item");
      expect(restarted.request?.command?.payload).toMatchObject({
        districtId,
        buildingId,
        recipeId,
        quantity: 1
      });
      expect(restarted.body?.accepted).toBe(true);
      const afterRestart = toProductionSnapshot(
        restarted.body?.readModel,
        surfaceName,
        buildingId,
        recipeId
      );
      assertProductionIdentity(afterRestart, identity);
      expect(afterRestart.line).toMatchObject({
        queuedAmount: 2,
        activeAmount: 1,
        waitingAmount: 1
      });
      const restartReservationEvidence = assertBalanceTransition(
        afterCancel,
        afterRestart,
        invertCosts(unitCosts),
        `${label} new one-unit reservation`
      );
      await waitForRenderedProductionState(page, {
        buildingId,
        expectedStateVersion: afterRestart.stateVersion,
        message: `${label} new start response must render before worker polling`,
        predicate: (snapshot) => (
          snapshot.line?.queuedAmount === 2
          && snapshot.line?.waitingAmount === 1
        ),
        recipeId,
        surfaceName
      });

      const timing = createCompletionTiming(afterRestart);
      expect(
        timing.timeoutMs,
        `${label} canonical completion timeout must remain within the 30 minute manual gate`
      ).toBeLessThanOrEqual(maxTestTimeoutMs);
      const derivedTestTimeoutMs = (
        Number(baseTestTimeoutMs || testInfo.timeout) + timing.timeoutMs
      );
      expect(
        derivedTestTimeoutMs,
        `${label} total derived test timeout must remain within 30 minutes`
      ).toBeLessThanOrEqual(maxTestTimeoutMs);
      testInfo.setTimeout(Math.max(testInfo.timeout, derivedTestTimeoutMs));
      await onWorkerPollingStarted({
        buildingId,
        districtId,
        stateVersion: afterRestart.stateVersion,
        timing
      });
      await expect.poll(async () => {
        const snapshot = await readProductionSnapshot(
          page,
          surfaceName,
          buildingId,
          recipeId
        );
        return Boolean(
          snapshot.line?.producedAmount === 1
          && snapshot.line?.canCollect === true
          && snapshot.line?.queuedAmount === 1
          && snapshot.line?.activeAmount === 1
          && snapshot.line?.waitingAmount === 0
        );
      }, {
        message: `${label} must complete the original active unit through canonical worker ticks`,
        timeout: timing.timeoutMs,
        intervals: timing.intervals
      }).toBe(true);
      const completed = await readProductionSnapshot(
        page,
        surfaceName,
        buildingId,
        recipeId
      );
      assertProductionIdentity(completed, identity);
      expect(completed.currentTick).toBeGreaterThanOrEqual(timing.expectedCompletionTick);
      expect(completed.currentTick).toBeLessThanOrEqual(
        timing.expectedCompletionTick + timing.headroomTicks
      );
      const completionBalanceEvidence = assertPassiveBalanceTransition(
        afterRestart,
        completed,
        resourceKey,
        `${label} worker completion before collection`
      );
      expect(completed.line).toMatchObject({
        producedAmount: 1,
        queuedAmount: 1,
        activeAmount: 1,
        waitingAmount: 0,
        canCollect: true
      });

      const collectSelector = surfaceName === "factory"
        ? "[data-factory-collect]"
        : "[data-production-building-collect]";
      const collect = shell.locator(collectSelector);
      await expect(collect).toBeVisible();
      await expect(collect).toBeEnabled();
      const collectedResult = await submitAndReadResponse(page, collect);
      expect(collectedResult.request?.command?.type).toBe("collect-production");
      expect(collectedResult.request?.command?.payload).toMatchObject({
        districtId,
        buildingId,
        resourceKey
      });
      expect(collectedResult.body?.accepted).toBe(true);
      const collected = toProductionSnapshot(
        collectedResult.body?.readModel,
        surfaceName,
        buildingId,
        recipeId
      );
      assertProductionIdentity(collected, identity);
      const collectionEvidence = assertBalanceTransition(
        completed,
        collected,
        { [resourceKey]: 1 },
        `${label} authoritative collection`
      );
      expect(collected.line).toMatchObject({
        producedAmount: 0,
        queuedAmount: 1,
        activeAmount: 1,
        waitingAmount: 0,
        canCollect: false
      });

      await page.reload({ waitUntil: "load" });
      await waitForLiveGame(page);
      opened = await openExactProductionBuilding(page, {
        buildingTypeId,
        districtId,
        surfaceName
      });
      expect(opened.buildingId).toBe(buildingId);
      const persisted = await readProductionSnapshot(page, surfaceName, buildingId, recipeId);
      assertProductionIdentity(persisted, identity);
      expect(persisted.stateVersion).toBeGreaterThanOrEqual(collected.stateVersion);
      const reloadBalanceEvidence = assertPassiveBalanceTransition(
        collected,
        persisted,
        resourceKey,
        `${label} collected output persistence after reload`
      );
      expect(persisted.line).toMatchObject({
        producedAmount: 0,
        queuedAmount: 1,
        activeAmount: 1,
        waitingAmount: 0,
        canCollect: false
      });

      const resourceKeys = Array.from(new Set([
        "cash",
        resourceKey,
        ...Object.keys(unitCosts)
      ]));
      const evidence = {
        schemaVersion: 1,
        authority: "server-authoritative-visible-ui",
        identity,
        unitReservationCosts: unitCosts,
        commands: {
          initialStart: summarizeCommand(started.request),
          cancelWaiting: summarizeCommand(cancelled.request),
          newStart: summarizeCommand(restarted.request),
          collect: summarizeCommand(collectedResult.request)
        },
        balanceEvidence: {
          initialTwoUnitReservation: startReservationEvidence,
          waitingUnitRefund: cancellationRefundEvidence,
          newOneUnitReservation: restartReservationEvidence,
          completionWithoutCollection: completionBalanceEvidence,
          collection: collectionEvidence,
          reloadAfterCollection: reloadBalanceEvidence
        },
        timing: {
          ...timing,
          derivedTestTimeoutMs,
          observedCompletionTick: completed.currentTick,
          observedLagTicks: completed.currentTick - timing.expectedCompletionTick
        },
        snapshots: {
          initial: summarizeSnapshot(initial, resourceKeys),
          afterStart: summarizeSnapshot(afterStart, resourceKeys),
          afterCancel: summarizeSnapshot(afterCancel, resourceKeys),
          afterRestart: summarizeSnapshot(afterRestart, resourceKeys),
          completed: summarizeSnapshot(completed, resourceKeys),
          collected: summarizeSnapshot(collected, resourceKeys),
          afterReload: summarizeSnapshot(persisted, resourceKeys)
        },
        persistence: {
          collectedBalancePersisted: true,
          localOutputDrained: true,
          secondUnitStillAuthoritativeAndActive: true
        }
      };
      await testInfo.attach(evidenceAttachmentName, {
        body: Buffer.from(`${JSON.stringify(evidence, null, 2)}\n`),
        contentType: "application/json"
      });
      return {
        evidence,
        expectedCancelType,
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
        .filter((type) => [
          "craft-item",
          "cancel-pharmacy-production",
          "cancel-drug-lab-production",
          "cancel-production-line",
          "collect-production"
        ].includes(type))).toEqual([
        "craft-item",
        result.expectedCancelType,
        "craft-item",
        "collect-production"
      ]);
    });
  });
}
