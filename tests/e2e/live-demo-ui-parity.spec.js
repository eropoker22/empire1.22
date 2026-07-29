import { expect, test } from "@playwright/test";
import { registerAndEnterHostedUiParityGame } from "./helpers/hostedUiParityEntry.js";
import {
  captureParitySurface,
  closeSurface,
  openBuildingFromDistrict,
  openCityEvents,
  openDistrictById,
  openFirstCityEventDetail,
  openParityLocalDemo,
  openProductionShortcut,
  parityViewports
} from "./helpers/uiParityCapture.js";

const captureEnabled = process.env.EMPIRE_CAPTURE_UI_PARITY_BASELINE === "1";
const hostedEnabled = process.env.EMPIRE_HOSTED_UI_PARITY_E2E === "1";
const serverInstanceId = process.env.EMPIRE_UI_PARITY_SERVER_ID || "";

test.describe("live/demo UI parity baseline", () => {
  test.skip(!captureEnabled, "Set EMPIRE_CAPTURE_UI_PARITY_BASELINE=1 to create baseline artifacts.");
  test.setTimeout(360_000);

  test("captures explicit local-demo reference surfaces", async ({ page }) => {
    await openParityLocalDemo(page);
    for (const viewport of parityViewports) {
      await page.setViewportSize(viewport);
      await openDistrictById(page, "district:21");
      await captureParitySurface(page, { mode: "local-demo", viewport, surfaceName: "district" });
      await openBuildingFromDistrict(page, "restaurant");
      await expect(page.locator("[data-district-building-detail-popup]:not([hidden])")).toBeVisible();
      await captureParitySurface(page, { mode: "local-demo", viewport, surfaceName: "restaurant" });
      await closeSurface(page, "restaurant");
      await closeSurface(page, "district");

      for (const type of ["pharmacy", "drugLab", "factory", "armory"]) {
        await openProductionShortcut(page, type);
        await captureParitySurface(page, { mode: "local-demo", viewport, surfaceName: type });
        await closeSurface(page, type);
      }

      await openCityEvents(page);
      await captureParitySurface(page, { mode: "local-demo", viewport, surfaceName: "cityEvents" });
      await openFirstCityEventDetail(page);
      await captureParitySurface(page, { mode: "local-demo", viewport, surfaceName: "cityEventDetail" });
      await closeSurface(page, "cityEventDetail");
      await closeSurface(page, "cityEvents");
    }
  });

  test.describe("hosted server-authoritative reference", () => {
    test.skip(!hostedEnabled || !serverInstanceId, "Hosted parity capture requires the local PostgreSQL/API/worker server.");

    test("captures commercial district, Restaurant, Pharmacy and City Events", async ({ page }) => {
      await registerAndEnterHostedUiParityGame(page, {
        serverInstanceId,
        spawnDistrictId: "district:21",
        identityPrefix: "ParityCom"
      });
      for (const viewport of parityViewports) {
        await page.setViewportSize(viewport);
        await openDistrictById(page, "district:21");
        await captureParitySurface(page, { mode: "server-authoritative", viewport, surfaceName: "district" });
        await openBuildingFromDistrict(page, "restaurant");
        await expect(page.locator("[data-district-building-detail-popup]:not([hidden])")).toBeVisible({ timeout: 30_000 });
        await captureParitySurface(page, { mode: "server-authoritative", viewport, surfaceName: "restaurant" });
        await closeSurface(page, "restaurant");
        await closeSurface(page, "district");
        await openProductionShortcut(page, "pharmacy");
        await captureParitySurface(page, { mode: "server-authoritative", viewport, surfaceName: "pharmacy" });
        await closeSurface(page, "pharmacy");
        await openCityEvents(page);
        await captureParitySurface(page, { mode: "server-authoritative", viewport, surfaceName: "cityEvents" });
        const unlockedOffer = page.locator("#events-tasklist [data-event-open]").first();
        await page.locator(".events-agent").first().click();
        if (await unlockedOffer.isVisible().catch(() => false)) {
          await openFirstCityEventDetail(page);
          await captureParitySurface(page, {
            mode: "server-authoritative",
            viewport,
            surfaceName: "cityEventDetail"
          });
          await closeSurface(page, "cityEventDetail");
        }
        await closeSurface(page, "cityEvents");
      }
    });

    test("captures Drug Lab", async ({ page }) => {
      await registerAndEnterHostedUiParityGame(page, {
        serverInstanceId,
        spawnDistrictId: "district:66",
        identityPrefix: "ParityPark"
      });
      for (const viewport of parityViewports) {
        await page.setViewportSize(viewport);
        await openProductionShortcut(page, "drugLab");
        await captureParitySurface(page, { mode: "server-authoritative", viewport, surfaceName: "drugLab" });
        await closeSurface(page, "drugLab");
      }
    });

    test("captures Factory and Armory", async ({ page }) => {
      await registerAndEnterHostedUiParityGame(page, {
        serverInstanceId,
        spawnDistrictId: "district:68",
        identityPrefix: "ParityInd"
      });
      for (const viewport of parityViewports) {
        await page.setViewportSize(viewport);
        for (const type of ["factory", "armory"]) {
          await openProductionShortcut(page, type);
          await captureParitySurface(page, { mode: "server-authoritative", viewport, surfaceName: type });
          await closeSurface(page, type);
        }
      }
    });
  });
});
