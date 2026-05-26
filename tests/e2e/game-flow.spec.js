import { expect, test } from "@playwright/test";
import {
  assertNoRuntimeErrors,
  clickDistrictById,
  closeDistrictPopup,
  createRuntimeErrorMonitor,
  expectNoDistrictActionModals,
  openDistrictPopup,
  openGamePage
} from "./helpers/empireSmokeHelpers.js";

test.describe("main game browser protection", () => {
  test("boots the game map and district popup infrastructure", async ({ page }) => {
    const errors = createRuntimeErrorMonitor(page);

    await openGamePage(page);
    await expect(page.getByTestId("district-canvas")).toBeVisible();
    await expect(page.getByTestId("district-popup")).toBeHidden();
    await expect(page.getByTestId("district-actions")).toHaveCount(1);

    await assertNoRuntimeErrors(errors);
  });

  test("opens and closes district popup with button, Escape and backdrop", async ({ page }) => {
    const errors = createRuntimeErrorMonitor(page);

    await openGamePage(page);
    await openDistrictPopup(page, { districtId: 27 });
    await expect(page.locator("[data-district-popup-title]")).not.toHaveText("");
    await expect(page.locator("[data-district-popup-buildings]")).toBeVisible();
    await expect(page.getByTestId("district-actions")).toBeVisible();
    await closeDistrictPopup(page, "button");

    await openDistrictPopup(page, { districtId: 27 });
    await closeDistrictPopup(page, "escape");

    await openDistrictPopup(page, { districtId: 27 });
    await closeDistrictPopup(page, "backdrop");

    await assertNoRuntimeErrors(errors);
  });

  test("opens and closes district action modals without leaking modal state", async ({ page }) => {
    const errors = createRuntimeErrorMonitor(page);

    await openGamePage(page);
    await openDistrictPopup(page, { districtId: 27 });
    await expectNoDistrictActionModals(page);
    await closeDistrictPopup(page, "button");
    await expectNoDistrictActionModals(page);

    await assertNoRuntimeErrors(errors);
  });

  test("opens atmosphere window by pointer and keyboard and closes it", async ({ page }) => {
    const errors = createRuntimeErrorMonitor(page);

    await openGamePage(page);
    await clickDistrictById(page, 27);

    const atmosphereTrigger = page.getByTestId("district-atmosphere-trigger");
    const atmosphereWindow = page.getByTestId("district-atmosphere-window");

    await atmosphereTrigger.click();
    await expect(atmosphereWindow).toBeVisible();
    await page.getByTestId("district-atmosphere-close").click();
    await expect(atmosphereWindow).toBeHidden();

    await atmosphereTrigger.focus();
    await page.keyboard.press("Enter");
    await expect(atmosphereWindow).toBeVisible();
    await page.getByTestId("district-atmosphere-close").click();

    await atmosphereTrigger.focus();
    await page.keyboard.press("Space");
    await expect(atmosphereWindow).toBeVisible();
    await page.evaluate(() => document.querySelector("[data-district-atmosphere-close]")?.click());
    await expect(atmosphereWindow).toBeHidden();

    await assertNoRuntimeErrors(errors);
  });
});
