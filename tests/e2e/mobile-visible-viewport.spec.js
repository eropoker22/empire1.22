import { expect, test } from "@playwright/test";
import { openLocalGame } from "./helpers/mobileLocalGame.js";

test.use({ actionTimeout: 10_000, hasTouch: true, isMobile: true, viewport: { width: 393, height: 851 } });

const shellSelector = ".district-building-detail-shell.is-standard-building-detail:not([hidden])";
const cardSelector = `${shellSelector} > .district-building-detail-card`;

async function tapVisibleControl(page, control) {
  await expect(control).toBeVisible();
  await expect(control).toBeEnabled();
  await control.evaluate(button => {
    const rect = button.getBoundingClientRect();
    if (rect.top < 0 || rect.bottom > innerHeight) {
      button.scrollIntoView({ block: "center", behavior: "instant" });
    }
  });
  await expect.poll(() => control.evaluate(button => {
    const rect = button.getBoundingClientRect();
    return button.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
  })).toBe(true);
  const rect = await control.boundingBox();
  // Real touch input also covers WebKit's mobile close assistance. Unlike a
  // mouse locator action, it does not wait for animation frames that WebKit's
  // Windows runner can suspend after resizing a touch viewport.
  await page.touchscreen.tap(rect.x + rect.width / 2, rect.y + rect.height / 2);
}

async function expectCenteredCard(page, height, top = 0) {
  await expect(page.locator(cardSelector)).toBeVisible();
  await expect.poll(() => page.locator(cardSelector).evaluate((card, viewport) => {
    const rect = card.getBoundingClientRect();
    return Math.abs(rect.top + rect.height / 2 - viewport.top - viewport.height / 2);
  }, { height, top })).toBeLessThan(3);
  const rect = await page.locator(cardSelector).boundingBox();
  expect(rect.y).toBeGreaterThanOrEqual(top + 13);
  expect(rect.y + rect.height).toBeLessThanOrEqual(top + height - 13);
  await expect.poll(() => page.locator(`${cardSelector} [data-district-building-detail-close]`).first().evaluate(button => {
    const rect = button.getBoundingClientRect();
    return button.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
  })).toBe(true);
}

test("ordinary building cards stay centered while browser toolbars open and close", async ({ page }, testInfo) => {
  await openLocalGame(page);
  await page.evaluate(() => window.EmpireRuntime.openBuildingDetail(1, "Klinika"));
  for (const height of [851, 670, 740, 851]) {
    await page.setViewportSize({ width: 393, height });
    await expectCenteredCard(page, height);
  }
  // The hosted presentation adds a selector that previously reserved topbar space.
  await page.locator(shellSelector).evaluate(shell => { shell.dataset.executionMode = "server-authoritative"; });
  await page.setViewportSize({ width: 393, height: 670 });
  await expectCenteredCard(page, 670);
  await page.screenshot({ path: testInfo.outputPath("building-toolbar-open.png") });
  await tapVisibleControl(page, page.locator(`${cardSelector} [data-district-building-detail-close]`).first());
  await expect(page.locator(shellSelector)).toBeHidden();
  await tapVisibleControl(page, page.locator("#city-events-open"));
  await expect(page.locator("#events-modal")).toBeVisible();
  for (const height of [670, 851]) {
    await page.setViewportSize({ width: 393, height });
    await expect.poll(() => page.locator("#events-modal > .modal__backdrop").evaluate(el => {
      const rect = el.getBoundingClientRect();
      return rect.top <= 0 && rect.bottom >= innerHeight && getComputedStyle(el).backgroundColor !== "rgba(0, 0, 0, 0)";
    })).toBe(true);
  }
});

test("cards follow the visual viewport independently of the layout viewport, also in landscape", async ({ page }, testInfo) => {
  // Browser runners do not expose real iOS/Android toolbar controls. Keep the
  // layout tall and drive the separate VisualViewport signals seen on phones.
  await page.addInitScript(() => {
    const viewport = new EventTarget();
    Object.defineProperties(viewport, {
      height: { configurable: true, get: () => window.__visibleHeight ?? innerHeight },
      width: { get: () => innerWidth },
      offsetTop: { get: () => window.__visibleTop ?? 0 },
      offsetLeft: { get: () => 0 },
      scale: { get: () => 1 }
    });
    Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
  });
  await openLocalGame(page);
  await page.evaluate(() => {
    window.__visibleHeight = 670;
    visualViewport.dispatchEvent(new Event("resize"));
    window.EmpireRuntime.openBuildingDetail(1, "Klinika");
  });
  await expectCenteredCard(page, 670);
  expect(await page.evaluate(() => innerHeight)).toBe(851);
  for (const viewport of [{ height: 851, top: 0 }, { height: 630, top: 35 }, { height: 670, top: 0 }]) {
    await page.evaluate(({ height, top }) => {
      window.__visibleHeight = height;
      window.__visibleTop = top;
      visualViewport.dispatchEvent(new Event("resize"));
      visualViewport.dispatchEvent(new Event("scroll"));
    }, viewport);
    await expectCenteredCard(page, viewport.height, viewport.top);
  }
  await page.setViewportSize({ width: 844, height: 393 });
  await page.evaluate(() => {
    window.__visibleHeight = 320;
    visualViewport.dispatchEvent(new Event("resize"));
  });
  await expectCenteredCard(page, 320);
  await page.screenshot({ path: testInfo.outputPath("building-landscape-toolbar-open.png") });
  await tapVisibleControl(page, page.locator(`${cardSelector} [data-district-building-detail-close]`).first());
  await expect(page.locator(shellSelector)).toBeHidden();
});

test("server milestone cards center every announcement and darken the whole phone viewport", async ({ page }, testInfo) => {
  await openLocalGame(page);
  await page.evaluate(() => {
    // Keep the native event target used by the runtime. These getters let the
    // test emulate browser chrome independently of Playwright's layout size.
    Object.defineProperties(visualViewport, {
      height: { configurable: true, get: () => window.__milestoneViewport?.height ?? innerHeight },
      offsetTop: { configurable: true, get: () => window.__milestoneViewport?.top ?? 0 }
    });
  });
  const modal = page.locator("[data-server-milestone-modal]");
  const card = modal.locator(".server-milestone-card");
  for (const milestoneId of ["welcome", "first-purge", "lockdown", "winners"]) {
    await page.evaluate(() => { window.__milestoneViewport = null; });
    await page.setViewportSize({ width: 393, height: 851 });
    await page.evaluate(id => {
      // Render the real server announcement via its public presentation event;
      // only the synchronous announcement handler uses this fixture's mode.
      const previousMode = window.__EMPIRE_GAMEPLAY_EXECUTION_MODE__;
      window.__EMPIRE_GAMEPLAY_EXECUTION_MODE__ = "server-authoritative";
      try {
        document.dispatchEvent(new CustomEvent("empire:server-milestone-open", { detail: {
          milestoneId: id,
          payload: {
            firstPurgeDeadlineMs: Date.now() + 300_000,
            finalLockdownDeadlineMs: Date.now() + 3_600_000,
            ranking: id === "winners" ? [
              { rank: 1, playerName: "První gang", score: 2400 },
              { rank: 2, playerName: "Druhý gang", score: 2100 },
              { rank: 3, playerName: "Třetí gang", score: 1800 }
            ] : []
          }
        } }));
      } finally {
        window.__EMPIRE_GAMEPLAY_EXECUTION_MODE__ = previousMode;
      }
    }, milestoneId);
    await expect(modal).toHaveAttribute("data-server-milestone", milestoneId);
    await expect(card).toBeVisible();
    for (const viewport of [
      { width: 393, layoutHeight: 851, height: 851, top: 0 },
      { width: 393, layoutHeight: 670, height: 670, top: 0 },
      { width: 393, layoutHeight: 851, height: 851, top: 0 },
      { width: 393, layoutHeight: 851, height: 630, top: 35 },
      { width: 844, layoutHeight: 393, height: 320, top: 0 }
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.layoutHeight });
      await page.evaluate(viewport => {
        window.__milestoneViewport = viewport;
        visualViewport.dispatchEvent(new Event("resize"));
        visualViewport.dispatchEvent(new Event("scroll"));
      }, viewport);
      await expect.poll(() => card.evaluate((element, viewport) => {
        const rect = element.getBoundingClientRect();
        return Math.abs(rect.y + rect.height / 2 - viewport.top - viewport.height / 2);
      }, viewport), { message: `${milestoneId} must be vertically centered` }).toBeLessThan(3);
      const rect = await card.boundingBox();
      expect(rect.y).toBeGreaterThanOrEqual(viewport.top + 13);
      expect(rect.y + rect.height).toBeLessThanOrEqual(viewport.top + viewport.height - 13);
      expect(Math.abs(rect.x + rect.width / 2 - viewport.width / 2)).toBeLessThan(3);
      await expect.poll(() => modal.locator(".server-milestone-modal__backdrop").evaluate(element => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.top <= 0 && rect.bottom >= innerHeight
          && style.backgroundColor === "rgba(1, 5, 12, 0.84)" && style.opacity === "1"
          && document.elementFromPoint(2, 2) === element;
      })).toBe(true);
      if (viewport.layoutHeight === 670) {
        await page.screenshot({ path: testInfo.outputPath(`${milestoneId}-phone.png`) });
      }
    }
    // Long announcements remain scrollable down to the confirmation button.
    await card.evaluate(element => { element.scrollTop = element.scrollHeight; });
    await tapVisibleControl(page, modal.locator("[data-server-milestone-confirm]"));
    await expect(modal).toBeHidden();
  }
});

test("boosts remain scrollable to the last action when browser toolbars change height", async ({ page }) => {
  await page.addInitScript(() => {
    const viewport = new EventTarget();
    Object.defineProperties(viewport, {
      height: { get: () => window.__boostVisibleViewport?.height ?? innerHeight },
      width: { get: () => innerWidth },
      offsetTop: { get: () => window.__boostVisibleViewport?.top ?? 0 },
      offsetLeft: { get: () => 0 },
      scale: { get: () => 1 }
    });
    Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
  });
  await openLocalGame(page);
  await tapVisibleControl(page, page.locator("[data-boost-open-trigger]").first());
  const card = page.locator("#boost-modal > .boost-modal__content");
  const body = card.locator(".boost-modal__body");
  const lastAction = body.locator("[data-boost-activate]").last();
  await expect(lastAction).toBeVisible();
  for (const viewport of [
    { height: 670, top: 0 }, { height: 851, top: 0 },
    { height: 630, top: 25 }, { height: 851, top: 0 }
  ]) {
    await page.evaluate(value => {
      window.__boostVisibleViewport = value;
      visualViewport.dispatchEvent(new Event("resize"));
      visualViewport.dispatchEvent(new Event("scroll"));
    }, viewport);
    await expect.poll(() => card.evaluate((element, viewport) => {
      const rect = element.getBoundingClientRect();
      return rect.top >= viewport.top + 7 && rect.bottom <= viewport.top + viewport.height - 7;
    }, viewport)).toBe(true);
    await body.evaluate(element => { element.scrollTop = element.scrollHeight; });
    await expect.poll(() => lastAction.evaluate(button => {
      const body = button.closest(".boost-modal__body");
      const rect = button.getBoundingClientRect();
      const scrollRect = body.getBoundingClientRect();
      return rect.top >= scrollRect.top && rect.bottom <= scrollRect.bottom
        && button.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
    })).toBe(true);
  }
  await tapVisibleControl(page, page.locator("#boost-modal-close"));
  await expect(card).toBeHidden();
});
