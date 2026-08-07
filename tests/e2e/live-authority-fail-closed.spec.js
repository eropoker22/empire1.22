import { expect, test } from "@playwright/test";
import {
  attachE2eDiagnostics,
  clearStorageOnBoot
} from "./helpers/empireSmokeHelpers.js";

test.afterEach(async ({ page }, testInfo) => {
  await attachE2eDiagnostics(page, testInfo);
});

test("public game ignores a local-demo override and fails closed without live membership", async ({ page }) => {
  await clearStorageOnBoot(page);
  await page.route("**/api/lobby/overview", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      accepted: false,
      errors: [{ code: "PLAYER_ENTRY_UNAVAILABLE", message: "Živý profil není dostupný." }]
    })
  }));

  await page.goto("/pages/game.html?runtimeMode=local-demo", { waitUntil: "domcontentloaded" });

  await expect(page.locator("html")).toHaveAttribute("data-gameplay-execution-mode", "server-authoritative");
  await expect(page.locator("body")).toHaveAttribute("data-authority-state", "unavailable");
  await expect(page.locator("[data-game-authority-status]")).toHaveText("SERVER NENÍ DOSTUPNÝ");
  await expect(page.locator("[data-game-authority-message]")).toContainText("Žádná lokální náhrada nebyla spuštěna.");
  await expect(page.locator("body")).not.toContainText(/lokální demo|local demo sandbox|otevřít demo/iu);
  expect(await page.evaluate(() => window.empireClientAuthorityState?.executionMode)).toBe("server-authoritative");
});
