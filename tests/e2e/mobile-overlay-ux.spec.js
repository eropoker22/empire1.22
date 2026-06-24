import { expect, test } from "@playwright/test";
import {
  attachE2eDiagnostics,
  assertNoRuntimeErrors,
  createRuntimeErrorMonitor,
  openGamePage
} from "./helpers/empireSmokeHelpers.js";

const DISTRICT_CANVAS_WIDTH = 1600;
const DISTRICT_CANVAS_HEIGHT = 980;
const TEST_DISTRICT_ID = 27;

test.use({
  hasTouch: true,
  isMobile: true,
  userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36",
  viewport: { width: 393, height: 851 }
});

test.afterEach(async ({ page }, testInfo) => {
  await attachE2eDiagnostics(page, testInfo);
});

async function getDistrictTapPoint(page, districtId = TEST_DISTRICT_ID) {
  return page.evaluate(({ districtId: id, canvasWidth, canvasHeight }) => {
    const district = window.empireStreetsDistrictState?.getDistrictById?.(id);
    const canvas = document.querySelector("[data-testid='district-canvas']");
    if (!district || !(canvas instanceof HTMLCanvasElement)) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    return {
      x: rect.left + (district.centerX / canvasWidth) * rect.width,
      y: rect.top + (district.centerY / canvasHeight) * rect.height
    };
  }, {
    canvasHeight: DISTRICT_CANVAS_HEIGHT,
    canvasWidth: DISTRICT_CANVAS_WIDTH,
    districtId
  });
}

async function tapDistrict(page, districtId = TEST_DISTRICT_ID) {
  await page.getByTestId("district-canvas").scrollIntoViewIfNeeded();
  const point = await getDistrictTapPoint(page, districtId);
  expect(point, `District ${districtId} tap point`).toBeTruthy();
  await page.mouse.click(point.x, point.y);
  if (!await page.getByTestId("district-popup-card").isVisible().catch(() => false)) {
    await page.evaluate((id) => window.empireStreetsDistrictState?.openDistrict?.(id), districtId);
  }
  await expect(page.getByTestId("district-popup-card")).toBeVisible();
}

async function getSelectedDistrictId(page) {
  return page.evaluate(() => window.empireStreetsDistrictState?.getSelectedDistrict?.()?.id ?? null);
}

async function tapBackdropTop(page, testId) {
  const box = await page.getByTestId(testId).boundingBox();
  expect(box, `${testId} backdrop box`).toBeTruthy();
  await page.mouse.click(box.x + Math.min(24, box.width / 2), box.y + Math.min(24, box.height / 2));
}

async function closeUnexpectedResultModal(page) {
  const closeButton = page.getByRole("button", { name: /Zavřít výsledek/ }).last();
  if (await closeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
    await closeButton.click({ force: true });
    await page.waitForTimeout(120);
  }
}

test.describe("mobile overlay UX", () => {
  test.setTimeout(360_000);

  test("keeps sheet, backdrop, focus and map input isolated on mobile", async ({ page }) => {
    const errors = createRuntimeErrorMonitor(page);

    await openGamePage(page);
    await expect(page.getByTestId("district-popup")).toBeHidden();

    await tapDistrict(page);
    await expect(page.getByTestId("district-popup")).toBeVisible();
    await expect(page.getByTestId("district-popup-card")).toHaveAttribute("role", "dialog");
    await expect(page.getByTestId("district-popup-card")).toHaveAttribute("aria-modal", "true");

    await tapBackdropTop(page, "district-popup-backdrop");
    await expect(page.getByTestId("district-popup")).toBeHidden();
    await page.waitForTimeout(520);
    await expect(page.getByTestId("district-popup")).toBeHidden();
    await expect.poll(() => getSelectedDistrictId(page)).toBe(null);

    await tapDistrict(page);
    await closeUnexpectedResultModal(page);
    const bodyScrollBefore = await page.evaluate(() => window.scrollY);
    await page.getByTestId("district-popup-card").evaluate((element) => {
      element.scrollTop = 0;
      element.scrollBy({ top: 320, behavior: "instant" });
    });
    await page.waitForTimeout(100);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(bodyScrollBefore);

    await expect.poll(() => page.evaluate((id) => (
      Boolean(window.empireStreetsDistrictState?.openAttackPanel?.(id))
    ), TEST_DISTRICT_ID)).toBe(true);
    await expect(page.getByTestId("attack-setup-modal")).toBeVisible();

    const defenseBackdrop = page.locator("[data-attack-setup-popup] [data-attack-setup-close]").first();
    const defenseBackdropBox = await defenseBackdrop.boundingBox();
    expect(defenseBackdropBox, "attack modal backdrop box").toBeTruthy();
    await page.mouse.click(
      defenseBackdropBox.x + Math.min(24, defenseBackdropBox.width / 2),
      defenseBackdropBox.y + Math.min(24, defenseBackdropBox.height / 2)
    );
    await expect(page.getByTestId("attack-setup-modal")).toBeHidden();
    await expect(page.getByTestId("district-popup-card")).toBeVisible();
    await page.waitForTimeout(520);
    await expect(page.getByTestId("district-popup-card")).toBeVisible();
    await expect.poll(() => getSelectedDistrictId(page)).toBe(TEST_DISTRICT_ID);

    await assertNoRuntimeErrors(errors);
  });
});
