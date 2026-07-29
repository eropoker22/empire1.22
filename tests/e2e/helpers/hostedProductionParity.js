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

async function readProductionSnapshot(page, type, buildingId, recipeId = "") {
  return page.evaluate(({ requestedBuildingId, requestedRecipeId, requestedType }) => {
    const readModel = window.EmpireGameplaySliceClient?.getCurrentReadModel?.() || null;
    const building = readModel?.district?.buildings?.find?.(
      (candidate) => String(candidate?.buildingId || "") === String(requestedBuildingId)
    ) || null;
    const production = requestedType === "pharmacy"
      ? building?.pharmacy
      : requestedType === "drugLab"
        ? building?.drugLab
        : requestedType === "factory"
          ? building?.factory
          : building?.armory;
    const lines = requestedType === "pharmacy" || requestedType === "drugLab"
      ? production?.lines || []
      : production?.productionLines || [];
    const line = requestedRecipeId
      ? lines.find((candidate) => String(candidate?.recipeId || "") === requestedRecipeId) || null
      : null;
    return {
      buildingId: building?.buildingId || null,
      districtId: readModel?.district?.districtId || null,
      level: Number(building?.level || production?.level || 0),
      line,
      resourceBalances: readModel?.player?.resourceBalances || null,
      stateVersion: readModel?.server?.stateVersion ?? null
    };
  }, {
    requestedBuildingId: buildingId,
    requestedRecipeId: recipeId,
    requestedType: type
  });
}

async function findStartableProductionCard(shell) {
  const startButtons = shell.getByRole("button", { name: "Spustit", exact: true });
  for (let index = 0; index < await startButtons.count(); index += 1) {
    const start = startButtons.nth(index);
    if (!(await start.isVisible()) || !(await start.isEnabled())) continue;
    const card = start.locator("xpath=ancestor::article[1]");
    const plus = card.getByRole("button", { name: /^Přidat výrobu /u });
    if (await plus.count() && await plus.isVisible() && await plus.isEnabled()) {
      return { card, plus, start };
    }
  }
  return null;
}

async function findEnabledButton(buttons) {
  for (let index = 0; index < await buttons.count(); index += 1) {
    const button = buttons.nth(index);
    if (await button.isVisible() && await button.isEnabled()) return button;
  }
  return null;
}

async function submitAndReadResponse(page, button) {
  const responsePromise = page.waitForResponse((response) => (
    response.url().includes("/api/gameplay-slice/submit")
    && response.request().method() === "POST"
  ));
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

export function defineHostedProductionParityTest({
  buildingTypeId,
  identityPrefix,
  label,
  spawnDistrictIds,
  surfaceName
}) {
  test.describe(`hosted ${label} presentation`, () => {
    test.skip(
      !hostedEnabled || !serverInstanceId,
      "Set EMPIRE_HOSTED_UI_PARITY_E2E=1 and EMPIRE_UI_PARITY_SERVER_ID for hosted PostgreSQL coverage."
    );
    test.setTimeout(360_000);

    test(`uses the shared ${label} modal and typed production commands`, async ({ page }) => {
      await page.setViewportSize(desktopViewport);
      const entry = await registerAndEnterHostedUiParityGame(page, {
        serverInstanceId,
        spawnDistrictIds,
        identityPrefix
      });
      let opened = await openExactProductionBuilding(page, {
        buildingTypeId,
        districtId: entry.spawnDistrictId,
        surfaceName
      });
      const shell = opened.shell;
      const buildingId = opened.buildingId;
      await captureParitySurface(page, {
        mode: "server-authoritative",
        phase: "after",
        viewport: desktopViewport,
        surfaceName
      });

      const startable = await findStartableProductionCard(shell);
      expect(startable, `${label} must expose at least one startable server recipe`).toBeTruthy();
      await startable.plus.click();
      const beforeStart = await readProductionSnapshot(page, surfaceName, buildingId);
      const started = await submitAndReadResponse(page, startable.start);
      expect(started.request?.command?.type).toBe("craft-item");
      expect(started.request?.command?.payload?.districtId).toBe(entry.spawnDistrictId);
      expect(started.request?.command?.payload?.buildingId).toBe(buildingId);
      expect(started.request?.command?.payload?.quantity).toBe(2);
      expect(started.body?.accepted).toBe(true);
      const recipeId = String(started.request.command.payload.recipeId || "");
      await expect.poll(async () => {
        const snapshot = await readProductionSnapshot(page, surfaceName, buildingId, recipeId);
        return snapshot.line?.queuedAmount || 0;
      }).toBeGreaterThanOrEqual(2);
      const afterStart = await readProductionSnapshot(page, surfaceName, buildingId, recipeId);
      expect(afterStart.stateVersion).not.toBe(beforeStart.stateVersion);
      expect(afterStart.line?.waitingAmount).toBeGreaterThanOrEqual(1);
      await expect(shell).toBeVisible();

      await page.reload({ waitUntil: "load" });
      await waitForLiveGame(page);
      opened = await openExactProductionBuilding(page, {
        buildingTypeId,
        districtId: entry.spawnDistrictId,
        surfaceName
      });
      const persisted = await readProductionSnapshot(page, surfaceName, buildingId, recipeId);
      expect(persisted.line?.queuedAmount).toBeGreaterThanOrEqual(2);
      expect(persisted.line?.canCancelWaiting).toBe(true);

      const cancel = await findEnabledButton(opened.shell.getByRole("button", {
        name: /^Zrušit čekající výrobu /u
      }));
      expect(cancel, "A queued second unit must expose the authoritative cancel action").toBeTruthy();
      const cancelled = await submitAndReadResponse(page, cancel);
      expect(cancelled.request?.command?.type).toMatch(/^cancel-/u);
      expect(cancelled.request?.command?.payload?.buildingId).toBe(buildingId);
      expect(cancelled.body?.accepted).toBe(true);
      await expect.poll(async () => {
        const snapshot = await readProductionSnapshot(page, surfaceName, buildingId, recipeId);
        return snapshot.line?.waitingAmount || 0;
      }).toBe(0);
      await expect(opened.shell).toBeVisible();

      const upgradeSelector = surfaceName === "factory"
        ? "[data-factory-upgrade]"
        : "[data-production-building-upgrade]";
      const upgrade = opened.shell.locator(upgradeSelector);
      await expect(upgrade).toBeVisible();
      await expect(upgrade).toBeEnabled();
      const levelBeforeUpgrade = (await readProductionSnapshot(
        page,
        surfaceName,
        buildingId
      )).level;
      await upgrade.click();
      const upgradeDialog = page.getByRole("dialog", { name: "Potvrzení upgradu" });
      await expect(upgradeDialog).toBeVisible();
      const upgradeResult = await submitAndReadResponse(
        page,
        upgradeDialog.getByRole("button", { name: "Potvrdit upgrade" })
      );
      expect(upgradeResult.request?.command?.type).toBe("upgrade-building");
      expect(upgradeResult.request?.command?.payload?.buildingId).toBe(buildingId);
      const levelAfterUpgrade = (await readProductionSnapshot(
        page,
        surfaceName,
        buildingId
      )).level;
      if (upgradeResult.body?.accepted) {
        expect(levelAfterUpgrade).toBe(levelBeforeUpgrade + 1);
      } else {
        expect(levelAfterUpgrade).toBe(levelBeforeUpgrade);
      }
      await expect(opened.shell).toBeVisible();

      await page.setViewportSize(mobileViewport);
      await assertMobileSurfaceFits(page, opened.shell);
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
      expect(
        entry.diagnostics.submitRequests.some((request) => request?.command?.type === "craft-item")
      ).toBe(true);
    });
  });
}
