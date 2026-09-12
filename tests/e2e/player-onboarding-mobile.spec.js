import { expect, test } from "@playwright/test";
import { openLocalOnboardingGame } from "./helpers/localOnboardingGame.js";
async function advanceToStep(page, id) {
  const panel=page.locator("[data-onboarding-panel]");
  await panel.locator("[data-onboarding-primary-action]").click();
  await expect(panel).toHaveAttribute("data-onboarding-step",id);
}
  for (const viewport of [{ width:320, height:568 }, { width:360, height:740 }, { width:393, height:852 }]) {
    test(`narrow phone keeps gang panel above onboarding at ${viewport.width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize(viewport);
      await openLocalOnboardingGame(page);
      await advanceToStep(page, "your-district");
      await advanceToStep(page, "building-action");
      const guide = page.locator('[data-onboarding-panel]');
      const gang = page.locator('#profile-gang-card');
      await expect(gang).toBeVisible();
      await expect(guide).toHaveAttribute('data-placement-mode', 'mobile');
      await expect.poll(async () => {
        const [panel, target] = await Promise.all([guide.boundingBox(), gang.boundingBox()]);
        return target.y >= 0 && target.y + target.height <= panel.y + 2;
      }).toBe(true);
      const next = guide.locator('[data-onboarding-primary-action]');
      await expect(next).toBeInViewport();
      await page.screenshot({path:testInfo.outputPath(`onboarding-gang-${viewport.width}.png`)});
      await page.setViewportSize({ width:viewport.width, height:viewport.height - 80 });
      await expect(next).toBeInViewport();
      await advanceToStep(page, 'heat-police');
    });
  }
