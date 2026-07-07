import { expect, test } from "@playwright/test";
import {
  attachE2eDiagnostics,
  assertNoRuntimeErrors,
  createRuntimeErrorMonitor,
  expectDistrictCanvasPainted,
  openGamePage
} from "./helpers/empireSmokeHelpers.js";

const PHASE_EFFECT_BUILDING_PATTERN = /Restaurace|Kasino|Herna|Večerka|Škola|Klinika|Směnárna|Strip club|Pašovací tunel|Pouliční dealeři|Drug lab|Obchodní centrum/u;

test.describe("day/night building detail diagnostic smoke", () => {
  test.setTimeout(75_000);

  test.afterEach(async ({ page }, testInfo) => {
    await attachE2eDiagnostics(page, testInfo);
  });

  test("renders the phase effect row and closes mobile building detail without closing the parent panel", async ({ page }) => {
    const runtimeErrors = createRuntimeErrorMonitor(page);
    await page.setViewportSize({ width: 390, height: 844 });

    await test.step("open game.html and paint the map", async () => {
      await openGamePage(page);
      await expect(page.getByTestId("district-canvas")).toBeVisible({ timeout: 10_000 });
      await expectDistrictCanvasPainted(page);
    });

    await test.step("verify the core day/night status reaches the UI", async () => {
      await expect(page.locator("[data-city-clock]")).toHaveText(/^\d{2}:\d{2}$/u, { timeout: 5_000 });
      const mapPhase = await page.locator("[data-map-canvas]").getAttribute("data-map-phase");
      expect(["day", "night"]).toContain(mapPhase);
    });

    await test.step("open buildings panel and a building detail", async () => {
      await page.locator("[data-buildings-popup-open]").click({ timeout: 5_000 });
      const buildingsPopup = page.locator("[data-buildings-popup]");
      await expect(buildingsPopup).toBeVisible({ timeout: 5_000 });

      const typeButtons = page.locator("[data-buildings-district-type]:not([disabled])");
      const typeCount = await typeButtons.count();
      expect(typeCount, "At least one owned district type should be available in the buildings panel").toBeGreaterThan(0);

      let openedDetailWithPhaseEffect = false;
      for (let typeIndex = 0; typeIndex < typeCount; typeIndex += 1) {
        await typeButtons.nth(typeIndex).click();
        const baseButtons = page.locator("[data-buildings-select-base-name]");
        const baseCount = await baseButtons.count();
        let selectedPreferredBase = false;
        for (let baseIndex = 0; baseIndex < baseCount; baseIndex += 1) {
          const baseButton = baseButtons.nth(baseIndex);
          const baseName = await baseButton.getAttribute("data-buildings-select-base-name");
          const baseText = await baseButton.textContent();
          if (PHASE_EFFECT_BUILDING_PATTERN.test(`${baseName || ""} ${baseText || ""}`)) {
            await baseButton.click();
            selectedPreferredBase = true;
            break;
          }
        }
        if (!selectedPreferredBase) {
          continue;
        }

        const buildingButton = page.locator("[data-buildings-open-building-name]:not([disabled])").first();
        await expect(buildingButton).toBeVisible({ timeout: 5_000 });
        await buildingButton.click();
        const detailShell = page.locator("[data-district-building-detail-popup]:not([hidden])").first();
        await expect(detailShell).toBeVisible({ timeout: 5_000 });
        const phaseEffect = detailShell.locator("[data-effect-tone^='day-night']").first();
        await expect(phaseEffect).toContainText(/DEN|NOC/u, { timeout: 5_000 });
        openedDetailWithPhaseEffect = true;

        if (openedDetailWithPhaseEffect) {
          break;
        }
      }

      expect(openedDetailWithPhaseEffect, "A building detail should render a truthful phase effect row").toBe(true);
    });

    await test.step("close the mobile building detail and keep the parent buildings panel open", async () => {
      const buildingsPopup = page.locator("[data-buildings-popup]");
      const detailShell = page.locator("[data-district-building-detail-popup]:not([hidden])").first();
      await expect(detailShell).toBeVisible({ timeout: 5_000 });
      await detailShell.locator("button[data-district-building-detail-close]").first().click();
      await expect(page.locator("[data-district-building-detail-popup]:not([hidden])")).toHaveCount(0, { timeout: 5_000 });
      await expect(buildingsPopup).toBeVisible({ timeout: 5_000 });
      await expect(page.locator("[data-buildings-open-building-name]").first()).toBeVisible({ timeout: 5_000 });
    });

    await assertNoRuntimeErrors(runtimeErrors);
  });
});
