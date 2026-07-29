import { expect, test } from "@playwright/test";
import {
  expectHostedUiParityClean,
  registerAndEnterHostedUiParityGame
} from "./helpers/hostedUiParityEntry.js";
import {
  expectNoDuplicateVisibleUi,
  openBuildingFromDistrict
} from "./helpers/uiParityCapture.js";

const hostedEnabled = process.env.EMPIRE_HOSTED_UI_PARITY_E2E === "1";
const serverInstanceId = process.env.EMPIRE_UI_PARITY_SERVER_ID || "";

test.describe("hosted district selection race", () => {
  test.skip(
    !hostedEnabled || !serverInstanceId,
    "Set EMPIRE_HOSTED_UI_PARITY_E2E=1 and EMPIRE_UI_PARITY_SERVER_ID for hosted PostgreSQL coverage."
  );
  test.setTimeout(360_000);

  test("a late A response cannot replace the newer B district or building", async ({ page }) => {
    const entry = await registerAndEnterHostedUiParityGame(page, {
      serverInstanceId,
      spawnDistrictIds: [
        "district:95",
        "district:113",
        "district:120",
        "district:136",
        "district:138",
        "district:140"
      ],
      identityPrefix: "LiveRace"
    });
    const firstDistrictId = entry.spawnDistrictId === "district:1"
      ? "district:2"
      : "district:1";
    const secondDistrictId = entry.spawnDistrictId;
    let delayedRequestSeen = false;
    await page.route("**/api/gameplay-slice/load", async (route) => {
      const request = route.request();
      let body = {};
      try {
        body = request.postDataJSON();
      } catch {
        body = {};
      }
      if (body?.districtId === firstDistrictId) {
        delayedRequestSeen = true;
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
      await route.continue();
    });

    const result = await page.evaluate(async ({ first, second }) => {
      const api = window.empireStreetsDistrictState;
      const firstOpened = api?.openDistrict?.(Number(first.replace(/^district:/u, ""))) || false;
      await new Promise((resolve) => setTimeout(resolve, 60));
      const secondOpened = api?.openDistrict?.(Number(second.replace(/^district:/u, ""))) || false;
      return { firstOpened, secondOpened };
    }, { first: firstDistrictId, second: secondDistrictId });
    expect(result).toEqual({ firstOpened: true, secondOpened: true });
    await expect.poll(() => delayedRequestSeen).toBe(true);
    await expect.poll(() => page.evaluate(() => (
      window.EmpireGameplaySliceClient?.getCurrentReadModel?.()?.district?.districtId || null
    ))).toBe(secondDistrictId);
    await page.waitForTimeout(1_000);
    expect(await page.evaluate(() => (
      window.EmpireGameplaySliceClient?.getCurrentReadModel?.()?.district?.districtId || null
    ))).toBe(secondDistrictId);
    await expect(page.locator("[data-district-popup]")).toHaveAttribute(
      "data-district-id",
      secondDistrictId.replace(/^district:/u, "")
    );
    const selectionSummary = await page.evaluate(() => (
      window.empireUiOwnershipDiagnostics?.getSummary?.().selection || null
    ));
    expect(selectionSummary?.requestedDistrictId).toBe(secondDistrictId);
    expect(selectionSummary?.status).toBe("ready");

    const firstBuilding = page.locator("[data-district-building-name]").first();
    const buildingType = await firstBuilding.getAttribute("data-district-building-type");
    const expectedBuildingId = await firstBuilding.getAttribute("data-district-building-id");
    expect(buildingType).toBeTruthy();
    expect(expectedBuildingId).toBeTruthy();
    await openBuildingFromDistrict(page, buildingType);
    const specializedPopup = page.locator([
      "[data-pharmacy-popup]:visible",
      "[data-druglab-popup]:visible",
      "[data-factory-popup]:visible",
      "[data-armory-popup]:visible"
    ].join(",")).first();
    const genericPopup = page.locator("[data-district-building-detail-popup]:not([hidden])").first();
    const visiblePopup = await specializedPopup.count() ? specializedPopup : genericPopup;
    await expect(visiblePopup).toBeVisible();
    await expect(visiblePopup).toHaveAttribute("data-server-building-id", expectedBuildingId);
    await expect(visiblePopup).toHaveAttribute("data-server-district-id", secondDistrictId);
    await expectNoDuplicateVisibleUi(page);
    await expectHostedUiParityClean(page, entry.diagnostics);
  });
});
