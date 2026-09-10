import { expect, test } from "@playwright/test";

import { openLocalGame } from "./helpers/mobileLocalGame.js";

test.use({ actionTimeout: 10000, hasTouch: true, isMobile: true, viewport: { width: 393, height: 851 } });

test("reported phone overlays remain visible through browser viewport changes", async ({ page }, testInfo) => {
  await openLocalGame(page);
  await page.locator("[data-buildings-popup-open]").click();
  await page.locator("#buildings-modal .buildings-popup__type-btn:not([disabled])").first().click();
  const inactiveBuilding = page.locator("#buildings-modal .buildings-popup__building:not(.is-active)").first();
  await expect(inactiveBuilding).toBeVisible();
  const selectedBeforeScroll = await page.locator("#buildings-modal .buildings-popup__building.is-active").allTextContents();
  const borderBefore = await inactiveBuilding.evaluate(el => getComputedStyle(el).borderColor);
  await inactiveBuilding.hover();
  await expect.poll(() => inactiveBuilding.evaluate(el => getComputedStyle(el).borderColor)).toBe(borderBefore);
  const listBounds = await page.locator("#buildings-type-list").boundingBox();
  const touch = await page.context().newCDPSession(page);
  const x = listBounds.x + listBounds.width / 2;
  const bottom = Math.min(listBounds.y + listBounds.height - 20, 780);
  await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: bottom }] });
  for (let offset = 30; offset <= 180; offset += 30) {
    await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: bottom - offset }] });
  }
  await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await touch.detach();
  expect(await page.locator("#buildings-modal .buildings-popup__building.is-active").allTextContents()).toEqual(selectedBeforeScroll);
  await page.locator("#buildings-modal-close").click();
  await page.locator("#city-events-open").click();
  await expect(page.locator("#events-modal")).toBeVisible();
  for (const height of [670, 851, 670]) {
    await page.setViewportSize({ width: 393, height });
    await expect.poll(() => page.locator("#events-modal > .modal__backdrop").evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return rect.bottom >= innerHeight && rect.top <= 0 && getComputedStyle(el).backgroundColor !== "rgba(0, 0, 0, 0)";
    })).toBe(true);
  }
  await page.screenshot({ path: testInfo.outputPath("city-events-phone.png") });
  await page.locator("#events-modal .modal__close").click();
  await expect(page.locator("#events-modal")).toBeHidden();
  await page.evaluate(() => window.EmpireRuntime.openBuildingDetail(1, "Klinika"));
  const card = page.locator(".district-building-detail-shell.is-standard-building-detail:not([hidden]) > .district-building-detail-card");
  await expect(card).toBeVisible();
  for (const height of [851, 670, 851]) {
    await page.setViewportSize({ width: 393, height });
    await expect.poll(async () => {
      const rect = await card.boundingBox();
      return Math.abs(rect.y + rect.height / 2 - height / 2);
    }).toBeLessThan(3);
  }
  await page.screenshot({ path: testInfo.outputPath("building-phone.png") });
  await card.locator("[data-district-building-detail-close]").first().click();
  await page.locator("[data-boost-open-trigger]:visible").first().click();
  await expect(page.locator("#boost-modal")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("boost-phone.png") });
  await page.locator("#boost-modal-close").click();
  await page.locator("[data-elimination-ai-panel-open]:visible").first().click();
  await expect(page.locator(".elimination-ai-panel.is-open")).toBeVisible();
  await expect(page.locator(".elimination-ai-panel__section--history")).toContainText("Vyřazeni očistou");
  await page.screenshot({ path: testInfo.outputPath("purge-phone.png") });
  await page.locator("button[data-elimination-ai-panel-close]").click();
  const statusLayout = await page.evaluate(async () => {
    const { renderCityStatusBar } = await import("/page-assets/js/app/runtime/cityStatusBarRuntime.js");
    renderCityStatusBar({ dayPhaseLabel: "do 6:00", dayPhaseMobileLabel: "Fin", statusLabel: "drž pozici" }, {
      clock: document.querySelector("[data-city-clock]"), dayPhase: document.querySelector("[data-city-day-phase]"),
      gamePhase: document.querySelector("[data-city-game-phase]"), status: document.querySelector("[data-city-status]"),
      production: document.querySelector("[data-city-production]")
    });
    const el = document.querySelector("[data-city-day-phase]");
    const label = el.parentElement.querySelector(".city-status-pill__label");
    const a = el.getBoundingClientRect(), b = label.getBoundingClientRect();
    const status = document.querySelector("[data-city-status]");
    const statusLabel = status.parentElement.querySelector(".city-status-pill__label").getBoundingClientRect();
    const value = status.getBoundingClientRect(), pill = status.parentElement.getBoundingClientRect();
    return {
      dayText: el.textContent, hold: status.classList.contains("is-hold-position"),
      sameRow: Math.abs(a.y + a.height / 2 - b.y - b.height / 2),
      labelGap: value.left - statusLabel.right, rightOverflow: value.right - pill.right
    };
  });
  expect(statusLayout.dayText).toBe("do 6:00");
  expect(statusLayout.hold).toBe(true);
  expect(statusLayout.sameRow).toBeLessThan(3);
  expect(statusLayout.labelGap).toBeGreaterThanOrEqual(0);
  expect(statusLayout.rightOverflow).toBeLessThanOrEqual(0);
  await page.evaluate(async () => {
    const { showUpgradeSuccess } = await import("/page-assets/js/app/ui/notifications.js");
    showUpgradeSuccess("Továrna", { root: document.querySelector("#game-root"), durationMs: 60_000 });
  });
  await expect(page.locator(".runtime-notification--upgrade")).toBeVisible();
  expect(await page.locator(".runtime-notification--upgrade").evaluate(el => el.closest('[aria-hidden="true"]') === null)).toBe(true);
  expect((await page.locator(".runtime-notification--upgrade").boundingBox()).y).toBeLessThan(100);
  await page.screenshot({ path: testInfo.outputPath("upgrade-phone.png") });
});

test("registration advertises eight-character passwords", async ({ page }) => {
  await page.route("https://**", route => route.abort());
  await page.goto("/pages/login.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#register-password")).toHaveAttribute("minlength", "8");
  await expect(page.locator("#register-password-confirmation")).toHaveAttribute("minlength", "8");
});
