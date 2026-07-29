import { expect, test } from "@playwright/test";
import { openGamePage } from "./helpers/empireSmokeHelpers.js";

test.describe("touch-capable desktop buildings", () => {
  test.setTimeout(90_000);

  test("keeps the desktop grid, opens Budovy and renders the building image", async ({ browser }) => {
    const context = await browser.newContext({
      hasTouch: true,
      viewport: { width: 1366, height: 900 }
    });
    const page = await context.newPage();
    try {
      await openGamePage(page);
      const media = await page.evaluate(() => ({
        coarse: matchMedia("(pointer: coarse)").matches,
        anyCoarse: matchMedia("(any-pointer: coarse)").matches,
        mobileWidth: matchMedia("(max-width: 780px)").matches
      }));
      await page.locator("[data-buildings-popup-open]").click();
      const popup = page.locator("[data-buildings-popup]");
      await expect(popup).toBeVisible();
      const layout = await popup.evaluate((shell) => {
        const card = shell.querySelector(".buildings-popup-card");
        const layoutElement = shell.querySelector(".buildings-popup__layout");
        const cardStyle = card ? getComputedStyle(card) : null;
        const layoutStyle = layoutElement ? getComputedStyle(layoutElement) : null;
        return {
          cardPosition: cardStyle?.position || "",
          cardWidth: cardStyle?.width || "",
          layoutColumns: layoutStyle?.gridTemplateColumns || "",
          layoutRows: layoutStyle?.gridTemplateRows || ""
        };
      });

      expect(media).toEqual({
        coarse: true,
        anyCoarse: true,
        mobileWidth: false
      });
      expect(Number.parseFloat(layout.cardWidth)).toBeGreaterThan(600);
      expect(layout.layoutColumns.trim().split(/\s+/u).length).toBeGreaterThan(1);

      const typeButton = page.locator("[data-buildings-district-type]:not([disabled])").first();
      await typeButton.click();
      await page.locator("[data-buildings-select-base-name]").first().click();
      await page.locator("[data-buildings-open-building-name]:not([disabled])").first().click();

      const detail = page.locator("[data-district-building-detail-popup]:not([hidden])").first();
      await expect(detail).toBeVisible();
      const background = await detail.evaluate((shell) => {
        const card = shell.querySelector(".district-building-detail-card");
        return {
          hasCustomBackground: card?.dataset?.buildingHasCustomBackground || "",
          backgroundImage: card ? getComputedStyle(card).backgroundImage : ""
        };
      });
      expect(background.hasCustomBackground).toBe("true");
      expect(background.backgroundImage).toContain("url(");
    } finally {
      await context.close();
    }
  });
});
