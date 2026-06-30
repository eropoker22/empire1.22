import { expect, test } from "@playwright/test";
import {
  SESSION_STORAGE_KEY,
  attachE2eDiagnostics,
  assertNoRuntimeErrors,
  clearStorageOnBoot,
  createRuntimeErrorMonitor,
  openLoginPage
} from "./helpers/empireSmokeHelpers.js";

test.afterEach(async ({ page }, testInfo) => {
  await attachE2eDiagnostics(page, testInfo);
});

test.describe("login smoke", () => {
  test("renders login, register and guest entry without runtime errors", async ({ page }) => {
    const errors = createRuntimeErrorMonitor(page);
    await clearStorageOnBoot(page);

    await openLoginPage(page);
    await expect(page.getByTestId("login-form")).toBeVisible();
    await expect(page.getByTestId("register-tab")).toHaveCount(1);
    await expect(page.getByTestId("guest-login-button")).toBeVisible();

    await page.locator("[data-tab-link='register']").click();
    await expect(page.getByTestId("register-form")).toBeVisible();

    await page.locator("[data-login-about-open]").click();
    await expect(page.locator("[data-login-about-overlay]")).toBeVisible();
    await expect(page.getByRole("dialog", { name: "O hře" })).toContainText("Město sleduje každý tvůj krok.");
    await page.locator("[data-login-about-overlay] .login-about-close").click();
    await expect(page.locator("[data-login-about-overlay]")).toBeHidden();

    await page.locator("[data-login-info-open='news']").click();
    await expect(page.locator("[data-login-info-overlay='news']")).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Novinky" })).toBeVisible();
    await page.locator("[data-login-info-overlay='news'] .login-about-close").click();
    await expect(page.locator("[data-login-info-overlay='news']")).toBeHidden();
    await expect(page).not.toHaveURL(/about-game\.html/u);

    await assertNoRuntimeErrors(errors);
  });

  test("continues as guest and persists a session", async ({ page }) => {
    const errors = createRuntimeErrorMonitor(page);
    await clearStorageOnBoot(page);

    await openLoginPage(page);
    await page.locator("#guest-username").fill("E2E Host");
    await page.getByPlaceholder("Ghost Crew").fill("E2E Crew");
    await Promise.all([
      page.waitForURL(/\/pages\/lobby\.html\?mode=free$/, { waitUntil: "domcontentloaded" }),
      page.getByTestId("guest-login-button").click({ noWaitAfter: true })
    ]);

    await expect(page).toHaveURL(/\/pages\/lobby\.html\?mode=free$/);
    await expect(page.getByTestId("lobby-page")).toBeVisible();

    const session = await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key)), SESSION_STORAGE_KEY);
    expect(session.registration).toMatchObject({
      identity: "E2E Host",
      gangName: "E2E Crew",
      isGuest: true,
      loginKind: "guest",
      serverMode: "free"
    });

    await assertNoRuntimeErrors(errors);
  });
});
