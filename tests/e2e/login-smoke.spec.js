import { expect, test } from "@playwright/test";
import {
  SESSION_STORAGE_KEY,
  attachE2eDiagnostics,
  assertNoRuntimeErrors,
  clearStorageOnBoot,
  createRuntimeErrorMonitor,
  openLoginPage
} from "./helpers/empireSmokeHelpers.js";

const waitForAboutController = async (page) => {
  await expect(page.locator("[data-login-about-overlay]")).toHaveAttribute("data-login-about-rendered", "true");
};

test.afterEach(async ({ page }, testInfo) => {
  await attachE2eDiagnostics(page, testInfo);
});

test.describe("login smoke", () => {
  test("renders login, register and guest entry without runtime errors", async ({ page }) => {
    const errors = createRuntimeErrorMonitor(page);
    await clearStorageOnBoot(page);

    await openLoginPage(page);
    await waitForAboutController(page);
    await expect(page.getByTestId("login-form")).toBeVisible();
    await expect(page.getByTestId("register-tab")).toHaveCount(1);
    await expect(page.getByTestId("guest-login-button")).toBeVisible();

    await page.locator("[data-tab-link='register']").click();
    await expect(page.getByTestId("register-form")).toBeVisible();

    await page.locator("[data-login-about-open]").click();
    await expect(page.locator("[data-login-about-overlay]")).toBeVisible();
    await expect(page.getByRole("dialog", { name: "O hře" })).toContainText("Město sleduje každý tvůj krok.");
    for (const tabName of ["Přehled", "Útok", "Past", "Bounty", "Očista"]) {
      await expect(page.getByRole("tab", { name: tabName, exact: true })).toBeVisible();
    }
    await page.getByRole("tab", { name: "Útok", exact: true }).click();
    await expect(page.getByRole("tabpanel", { name: "Útok" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-login-about-overlay]")).toBeHidden();
    await expect(page.locator("[data-login-about-open]")).toBeFocused();

    await page.locator("[data-login-info-open='news']").click();
    await expect(page.locator("[data-login-info-overlay='news']")).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Novinky" })).toBeVisible();
    await page.locator("[data-login-info-overlay='news'] .login-about-close").click();
    await expect(page.locator("[data-login-info-overlay='news']")).toBeHidden();
    await expect(page).not.toHaveURL(/about-game\.html/u);

    await assertNoRuntimeErrors(errors);
  });

  test("binds the same encyclopedia in explicit local-demo mode", async ({ page }) => {
    await clearStorageOnBoot(page);
    await page.goto("/pages/login.html?runtimeMode=local-demo", { waitUntil: "domcontentloaded" });
    await waitForAboutController(page);
    await page.locator("[data-login-about-open]").click();
    await expect(page.getByRole("tab", { name: "Past", exact: true })).toHaveCount(1);
    await page.getByRole("tab", { name: "Bounty", exact: true }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: "Drby a City Events", exact: true })).toHaveAttribute("aria-selected", "true");
    await page.locator("[data-login-about-overlay] .login-about-backdrop").click({ position: { x: 2, y: 2 } });
    await expect(page.locator("[data-login-about-overlay]")).toBeHidden();
  });

  test("keeps the encyclopedia inside mobile and desktop viewports", async ({ page }) => {
    await clearStorageOnBoot(page);
    for (const viewport of [{ width: 320, height: 800 }, { width: 360, height: 800 }, { width: 390, height: 844 }, { width: 412, height: 915 }, { width: 1280, height: 720 }, { width: 1366, height: 768 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 }]) {
      await page.setViewportSize(viewport);
      await page.goto("/pages/login.html", { waitUntil: "domcontentloaded" });
      await waitForAboutController(page);
      await page.locator("[data-login-about-open]").click();
      const overflow = await page.evaluate(() => ({ document: document.documentElement.scrollWidth - document.documentElement.clientWidth, dialog: document.querySelector("[data-login-about-overlay] [role='dialog']").getBoundingClientRect() }));
      expect(overflow.document).toBeLessThanOrEqual(1);
      expect(overflow.dialog.left).toBeGreaterThanOrEqual(0);
      expect(overflow.dialog.right).toBeLessThanOrEqual(viewport.width);
      await page.keyboard.press("Escape");
    }
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
