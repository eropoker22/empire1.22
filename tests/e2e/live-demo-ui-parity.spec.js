import { expect, test } from "@playwright/test";
import {
  expectHostedUiParityClean,
  registerAndEnterHostedUiParityGame
} from "./helpers/hostedUiParityEntry.js";
import {
  captureParitySurface,
  closeSurface,
  expectNoDuplicateVisibleUi,
  getParitySurfaceSignature,
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
      await captureParitySurface(page, {
        mode: "local-demo",
        phase: "baseline",
        viewport,
        surfaceName: "district"
      });
      await openBuildingFromDistrict(page, "restaurant");
      await expect(page.locator("[data-district-building-detail-popup]:not([hidden])")).toBeVisible();
      await captureParitySurface(page, {
        mode: "local-demo",
        phase: "baseline",
        viewport,
        surfaceName: "restaurant"
      });
      await closeSurface(page, "restaurant");
      await closeSurface(page, "district");

      for (const type of ["pharmacy", "drugLab", "factory", "armory"]) {
        await openProductionShortcut(page, type);
        await captureParitySurface(page, {
          mode: "local-demo",
          phase: "baseline",
          viewport,
          surfaceName: type
        });
        await closeSurface(page, type);
      }

      await openCityEvents(page);
      await captureParitySurface(page, {
        mode: "local-demo",
        phase: "baseline",
        viewport,
        surfaceName: "cityEvents"
      });
      await openFirstCityEventDetail(page);
      await captureParitySurface(page, {
        mode: "local-demo",
        phase: "baseline",
        viewport,
        surfaceName: "cityEventDetail"
      });
      await closeSurface(page, "cityEventDetail");
      await closeSurface(page, "cityEvents");
    }
  });

  test.describe("hosted server-authoritative reference", () => {
    test.skip(!hostedEnabled || !serverInstanceId, "Hosted parity capture requires the local PostgreSQL/API/worker server.");

    test("captures commercial district, Restaurant, Pharmacy and City Events", async ({ page }) => {
      const entry = await registerAndEnterHostedUiParityGame(page, {
        serverInstanceId,
        spawnDistrictIds: [
          "district:21",
          "district:26",
          "district:42",
          "district:95",
          "district:113",
          "district:136",
          "district:138",
          "district:140"
        ],
        identityPrefix: "ParityCom"
      });
      for (const viewport of parityViewports) {
        await page.setViewportSize(viewport);
        await openDistrictById(page, entry.spawnDistrictId);
        await captureParitySurface(page, {
          mode: "server-authoritative",
          phase: "baseline",
          viewport,
          surfaceName: "district"
        });
        await openBuildingFromDistrict(page, "restaurant");
        await expect(page.locator("[data-district-building-detail-popup]:not([hidden])")).toBeVisible({ timeout: 30_000 });
        await captureParitySurface(page, {
          mode: "server-authoritative",
          phase: "baseline",
          viewport,
          surfaceName: "restaurant"
        });
        await closeSurface(page, "restaurant");
        await closeSurface(page, "district");
        await openProductionShortcut(page, "pharmacy");
        await captureParitySurface(page, {
          mode: "server-authoritative",
          phase: "baseline",
          viewport,
          surfaceName: "pharmacy"
        });
        await closeSurface(page, "pharmacy");
        await openCityEvents(page);
        await captureParitySurface(page, {
          mode: "server-authoritative",
          phase: "baseline",
          viewport,
          surfaceName: "cityEvents"
        });
        const unlockedOffer = page.locator("#events-tasklist [data-event-open]").first();
        await page.locator(".events-agent").first().click();
        if (await unlockedOffer.isVisible().catch(() => false)) {
          await openFirstCityEventDetail(page);
          await captureParitySurface(page, {
            mode: "server-authoritative",
            phase: "baseline",
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
        spawnDistrictIds: ["district:66", "district:137", "district:156", "district:158"],
        identityPrefix: "ParityPark"
      });
      for (const viewport of parityViewports) {
        await page.setViewportSize(viewport);
        await openProductionShortcut(page, "drugLab");
        await captureParitySurface(page, {
          mode: "server-authoritative",
          phase: "baseline",
          viewport,
          surfaceName: "drugLab"
        });
        await closeSurface(page, "drugLab");
      }
    });

    test("captures Factory and Armory", async ({ page }) => {
      await registerAndEnterHostedUiParityGame(page, {
        serverInstanceId,
        spawnDistrictIds: [
          "district:68",
          "district:73",
          "district:94",
          "district:134",
          "district:139",
          "district:161"
        ],
        identityPrefix: "ParityInd"
      });
      for (const viewport of parityViewports) {
        await page.setViewportSize(viewport);
        for (const type of ["factory", "armory"]) {
          await openProductionShortcut(page, type);
          await captureParitySurface(page, {
            mode: "server-authoritative",
            phase: "baseline",
            viewport,
            surfaceName: type
          });
          await closeSurface(page, type);
        }
      }
    });
  });
});

test.describe("live/demo shared presentation parity", () => {
  test.skip(
    !hostedEnabled || !serverInstanceId,
    "Set EMPIRE_HOSTED_UI_PARITY_E2E=1 and EMPIRE_UI_PARITY_SERVER_ID for hosted parity."
  );
  test.setTimeout(360_000);

  test("district, Restaurant and Pharmacy keep the shared visible structure", async ({ browser }) => {
    const localContext = await browser.newContext({ viewport: parityViewports[0] });
    const serverContext = await browser.newContext({ viewport: parityViewports[0] });
    const localPage = await localContext.newPage();
    const serverPage = await serverContext.newPage();
    try {
      await openParityLocalDemo(localPage);
      await openDistrictById(localPage, "district:21");
      const localDistrict = await getParitySurfaceSignature(localPage, "district");
      await captureParitySurface(localPage, {
        mode: "local-demo",
        phase: "after",
        viewport: parityViewports[0],
        surfaceName: "district"
      });
      await openBuildingFromDistrict(localPage, "restaurant");
      const localRestaurant = await getParitySurfaceSignature(localPage, "restaurant");
      await closeSurface(localPage, "restaurant");
      await closeSurface(localPage, "district");
      await openProductionShortcut(localPage, "pharmacy");
      const localPharmacy = await getParitySurfaceSignature(localPage, "pharmacy");
      await closeSurface(localPage, "pharmacy");

      const entry = await registerAndEnterHostedUiParityGame(serverPage, {
        serverInstanceId,
        spawnDistrictIds: [
          "district:21",
          "district:26",
          "district:42",
          "district:95",
          "district:113",
          "district:136",
          "district:138",
          "district:140"
        ],
        identityPrefix: "ParityShared"
      });
      await openDistrictById(serverPage, entry.spawnDistrictId);
      const serverDistrict = await getParitySurfaceSignature(serverPage, "district");
      await captureParitySurface(serverPage, {
        mode: "server-authoritative",
        phase: "after",
        viewport: parityViewports[0],
        surfaceName: "district"
      });
      await openBuildingFromDistrict(serverPage, "restaurant");
      const serverRestaurant = await getParitySurfaceSignature(serverPage, "restaurant");
      await closeSurface(serverPage, "restaurant");
      await openDistrictById(serverPage, entry.spawnDistrictId);
      await openBuildingFromDistrict(serverPage, "pharmacy");
      await expect(serverPage.locator("[data-pharmacy-popup]")).toBeVisible();
      const serverPharmacy = await getParitySurfaceSignature(serverPage, "pharmacy");

      for (const [surface, localSignature, serverSignature, prefix] of [
        ["district", localDistrict, serverDistrict, "district-popup"],
        ["restaurant", localRestaurant, serverRestaurant, "district-building-detail"],
        ["pharmacy", localPharmacy, serverPharmacy, "pharmacy"]
      ]) {
        const expectedClasses = localSignature.canonicalClassNames.filter((className) => (
          className.includes(prefix)
        ));
        expect(expectedClasses.length, `${surface} must expose canonical shared classes`).toBeGreaterThan(0);
        expect(serverSignature.canonicalClassNames).toEqual(expect.arrayContaining(expectedClasses));
        expect(serverSignature.owner).toBe(localSignature.owner);
      }
      await expectNoDuplicateVisibleUi(serverPage);
      await closeSurface(serverPage, "pharmacy");
      await expectHostedUiParityClean(serverPage, entry.diagnostics);
    } finally {
      await localContext.close();
      await serverContext.close();
    }
  });
});
