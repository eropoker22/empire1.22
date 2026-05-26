import { expect, test } from "@playwright/test";
import {
  SESSION_STORAGE_KEY,
  assertNoRuntimeErrors,
  clearStorageOnBoot,
  createRuntimeErrorMonitor,
  openLoginPage
} from "./helpers/empireSmokeHelpers.js";

test.describe("login smoke", () => {
  test("renders login, register and guest entry without runtime errors", async ({ page }) => {
    const errors = createRuntimeErrorMonitor(page);
    await clearStorageOnBoot(page);

    await openLoginPage(page);
    await expect(page.getByTestId("login-form")).toBeVisible();
    await expect(page.getByTestId("register-tab")).toHaveCount(1);
    await expect(page.getByTestId("guest-login-button")).toBeVisible();

    await page.evaluate(() => document.querySelector("[data-testid='register-tab']")?.click());
    await expect(page.getByTestId("register-form")).toBeVisible();

    await assertNoRuntimeErrors(errors);
  });

  test("continues as guest and persists a session", async ({ page }) => {
    const errors = createRuntimeErrorMonitor(page);
    await clearStorageOnBoot(page);

    await openLoginPage(page);
    await page.locator("#guest-username").fill("E2E Host");
    await page.getByPlaceholder("Ghost Crew").fill("E2E Crew");
    await page.getByTestId("guest-login-button").click();

    await expect(page).toHaveURL(/\/pages\/lobby\.html\?mode=war$/);
    await expect(page.getByTestId("lobby-page")).toBeVisible();

    const session = await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key)), SESSION_STORAGE_KEY);
    expect(session.registration).toMatchObject({
      identity: "E2E Host",
      gangName: "E2E Crew",
      isGuest: true,
      loginKind: "guest",
      serverMode: "war"
    });

    await assertNoRuntimeErrors(errors);
  });
});
