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

async function getLockedPageScrollY(page) {
  return page.evaluate(() => {
    const fixedTop = Number.parseFloat((document.body.style.top || "0").replace("px", ""));
    if (Number.isFinite(fixedTop) && fixedTop < 0) {
      return Math.round(Math.abs(fixedTop));
    }
    return Math.round(window.scrollY || window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0);
  });
}

async function getScrollLockState(page) {
  return page.evaluate(() => ({
    bodyDatasetLocked: document.body.dataset.overlayScrollLocked === "true",
    bodyClassLocked: document.body.classList.contains("game-modal-scroll-locked"),
    bodyPosition: document.body.style.position || "",
    bodyTop: document.body.style.top || "",
    legacyTopOverlay: (() => {
      const top = window.EmpireLegacyOverlay?.getTopOverlay?.()?.element;
      return top
        ? {
            className: String(top.className || ""),
            hidden: Boolean(top.hidden),
            testId: top.getAttribute("data-testid") || ""
          }
        : null;
    })(),
    modalDebug: window.EmpireModalScrollLock?.debugState?.() || null,
    modalScrollLocked: Boolean(window.EmpireModalScrollLock?.isLocked?.(document)),
    gameplaySliceClientKeys: Object.keys(window.EmpireGameplaySliceClient || {}),
    gameplaySliceCloseType: typeof window.EmpireGameplaySliceClient?.closeDistrictSheet,
    rootClassLocked: document.documentElement.classList.contains("game-modal-scroll-locked"),
    windowScrollY: Math.round(window.scrollY || window.pageYOffset || 0)
  }));
}

async function expectScrollLockApplied(page) {
  let lastState = null;
  try {
    await expect.poll(async () => {
      lastState = await getScrollLockState(page);
      return lastState.bodyDatasetLocked
        && lastState.modalScrollLocked
        && lastState.bodyPosition === "fixed";
    }, { timeout: 2500 }).toBe(true);
  } catch (error) {
    throw new Error(`${error?.message || String(error)}\nLast scroll lock state: ${JSON.stringify(lastState, null, 2)}`);
  }
}

async function expectScrollLockReleased(page) {
  let lastState = null;
  try {
    await expect.poll(async () => {
      lastState = await getScrollLockState(page);
      return !lastState.bodyDatasetLocked
        && !lastState.modalScrollLocked
        && lastState.bodyPosition !== "fixed";
    }, { timeout: 2500 }).toBe(true);
  } catch (error) {
    throw new Error(`${error?.message || String(error)}\nLast scroll lock state: ${JSON.stringify(lastState, null, 2)}`);
  }
}

async function expectPageScrollPreserved(page, expectedY, tolerance = 2) {
  await expect.poll(async () => {
    const currentY = await page.evaluate(() => Math.round(window.scrollY || window.pageYOffset || 0));
    return Math.abs(currentY - expectedY) <= tolerance;
  }, { timeout: 2500 }).toBe(true);
}

async function expectLockedScrollPreserved(page, expectedY, tolerance = 2) {
  await expect.poll(async () => {
    const currentY = await getLockedPageScrollY(page);
    return Math.abs(currentY - expectedY) <= tolerance;
  }, { timeout: 2500 }).toBe(true);
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

    await page.evaluate(() => {
      const maxScrollY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      window.scrollTo(0, Math.min(760, maxScrollY));
    });
    await page.waitForTimeout(120);
    await tapDistrict(page);
    await expect(page.getByTestId("district-popup")).toBeVisible();
    await expect(page.getByTestId("district-popup-card")).toHaveAttribute("role", "dialog");
    await expect(page.getByTestId("district-popup-card")).toHaveAttribute("aria-modal", "true");
    await expectScrollLockApplied(page);
    const scrollBeforeDistrictClose = await getLockedPageScrollY(page);
    expect(Number.isFinite(scrollBeforeDistrictClose)).toBe(true);

    await tapBackdropTop(page, "district-popup-backdrop");
    await expect(page.getByTestId("district-popup")).toBeHidden();
    await page.waitForTimeout(520);
    await expect(page.getByTestId("district-popup")).toBeHidden();
    await expectScrollLockReleased(page);
    await expectPageScrollPreserved(page, scrollBeforeDistrictClose);
    await expect.poll(() => getSelectedDistrictId(page)).toBe(null);

    await tapDistrict(page);
    await expectScrollLockApplied(page);
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
    await expectScrollLockApplied(page);
    const scrollBeforeAttackClose = await getLockedPageScrollY(page);
    expect(Number.isFinite(scrollBeforeAttackClose)).toBe(true);

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
    await expectScrollLockApplied(page);
    await expectLockedScrollPreserved(page, scrollBeforeAttackClose);
    await expect.poll(() => getSelectedDistrictId(page)).toBe(TEST_DISTRICT_ID);

    await tapBackdropTop(page, "district-popup-backdrop");
    await expect(page.getByTestId("district-popup")).toBeHidden();
    await page.waitForTimeout(520);
    await expectScrollLockReleased(page);
    await expectPageScrollPreserved(page, scrollBeforeAttackClose);
    await expect.poll(() => getSelectedDistrictId(page)).toBe(null);

    await assertNoRuntimeErrors(errors);
  });
});
