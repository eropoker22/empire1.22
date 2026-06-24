import { expect, test } from "@playwright/test";
import {
  attachE2eDiagnostics,
  assertNoRuntimeErrors,
  closeDistrictPopup,
  createRuntimeErrorMonitor,
  expectNoDistrictActionModals,
  openDistrictPopup,
  openGamePage
} from "./helpers/empireSmokeHelpers.js";

test.afterEach(async ({ page }, testInfo) => {
  await attachE2eDiagnostics(page, testInfo);
});

test.describe("main game browser protection", () => {
  test.setTimeout(360_000);

  test("boots map and exercises district popup controls", async ({ page }) => {
    const errors = createRuntimeErrorMonitor(page);

    await openGamePage(page);
    await expect(page.getByTestId("district-canvas")).toBeVisible();
    await expect(page.getByTestId("district-popup")).toBeHidden();
    await expect(page.getByTestId("district-actions")).toHaveCount(1);

    await openDistrictPopup(page, { districtId: 27 });
    await expect(page.locator("[data-district-popup-title]")).not.toHaveText("");
    await expect(page.locator("[data-district-popup-buildings]")).toBeVisible();
    await expect(page.getByTestId("district-actions")).toBeVisible();
    await expectNoDistrictActionModals(page);
    await closeDistrictPopup(page, "button");
    await expectNoDistrictActionModals(page);

    await assertNoRuntimeErrors(errors);
  });

  test("opens atmosphere window from a fresh district popup", async ({ page }) => {
    const errors = createRuntimeErrorMonitor(page);

    await openGamePage(page);
    await openDistrictPopup(page, { districtId: 27 });

    const atmosphereTrigger = page.getByTestId("district-atmosphere-trigger");
    const atmosphereWindow = page.getByTestId("district-atmosphere-window");

    await expect(atmosphereTrigger).toBeVisible();
    await atmosphereTrigger.click();
    await expect(atmosphereWindow).toBeVisible();

    await assertNoRuntimeErrors(errors);
  });
});
