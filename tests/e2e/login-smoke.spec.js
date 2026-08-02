import { expect, test } from "@playwright/test";
import {
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
  test("renders live login and registration without runtime errors", async ({ page }) => {
    const errors = createRuntimeErrorMonitor(page);
    await clearStorageOnBoot(page);
    await page.route("**/api/account/registration-policy", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        accepted: true,
        data: {
          registrationEnabled: true,
          mode: "open",
          passwordMinimumLength: 12,
          minimumAgeYears: 16,
          termsAcceptanceRequired: true,
          termsVersion: "closed-alpha-internal-v1"
        }
      })
    }));
    await page.route("**/api/account/session", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        accepted: false,
        errors: [{ code: "ACCOUNT_SESSION_REQUIRED", message: "Přihlášení je vyžadováno." }]
      })
    }));

    await openLoginPage(page, { serverAuthoritative: true });
    await waitForAboutController(page);
    await expect(page.getByTestId("login-form")).toBeVisible();
    await expect(page.getByTestId("guest-login-button")).toHaveCount(0);

    await page.locator("[data-login-registration-open]").click();
    await expect(page.getByTestId("register-form")).toBeVisible();
    await expect(page.locator("#register-terms")).toBeEnabled();
    await expect(page.getByTestId("login-form")).toBeVisible();
    await expect(page.getByRole("dialog", { name: "ZALOŽIT GANG" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-login-registration-overlay]")).toBeHidden();
    await expect(page.locator("[data-login-registration-open]")).toBeFocused();

    await page.locator("[data-login-about-open]").click();
    await expect(page.locator("[data-login-about-overlay]")).toBeVisible();
    await expect(page.getByRole("dialog", { name: "O hře" })).toContainText("MĚSTO SLEDUJE KAŽDÝ TVŮJ KROK.");
    for (const tabName of ["Přehled", "Útok", "Past", "Bounty", "Očista"]) {
      await expect(page.getByRole("tab", { name: tabName, exact: true })).toBeVisible();
    }
    await page.getByRole("tab", { name: "Útok", exact: true }).click();
    await expect(page.getByRole("tabpanel", { name: "Útok" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-login-about-overlay]")).toBeHidden();
    await expect(page.locator("[data-login-about-open]")).toBeFocused();

    await page.locator("[data-login-info-open='news']").click();
    await expect(page.locator("[data-login-info-overlay]")).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Novinky" })).toBeVisible();
    await page.locator("[data-login-info-overlay] .login-info-close").click();
    await expect(page.locator("[data-login-info-overlay]")).toBeHidden();
    await expect(page).not.toHaveURL(/about-game\.html/u);

    await assertNoRuntimeErrors(errors);
  });

  test("ignores the local-demo query and keeps the live login", async ({ page }) => {
    await clearStorageOnBoot(page);
    await page.goto("/pages/login.html?runtimeMode=local-demo", { waitUntil: "domcontentloaded" });
    await waitForAboutController(page);
    await expect(page.getByTestId("login-form")).toBeVisible();
    await expect(page.getByTestId("guest-login-button")).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => window.empireClientAuthorityState?.executionMode))
      .toBe("server-authoritative");
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

  test("does not expose local demo controls on mobile loopback", async ({ page }) => {
    await clearStorageOnBoot(page);
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto("/pages/login.html?runtimeMode=local-demo", { waitUntil: "domcontentloaded" });
    const errors = createRuntimeErrorMonitor(page);
    await expect(page.getByTestId("login-form")).toBeVisible();
    await expect(page.getByTestId("guest-login-button")).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(/lokální demo|local demo sandbox|otevřít demo/iu);
    await expect.poll(() => page.evaluate(() => window.empireClientAuthorityState?.executionMode))
      .toBe("server-authoritative");

    await assertNoRuntimeErrors(errors);
  });
});
