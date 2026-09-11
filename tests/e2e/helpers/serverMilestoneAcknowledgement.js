import { expect } from "@playwright/test";

// Announcements can arrive while a long UI scenario is already in progress.
// Acknowledge their visible controls, including the next queued announcement;
// never hide an overlay or click through it with force.
export async function acknowledgeVisibleServerMilestones(page) {
  const modal = page.locator("[data-server-milestone-modal]");
  for (let announcement = 0; announcement < 4; announcement += 1) {
    if (!await modal.isVisible()) return;
    await modal.locator("[data-server-milestone-confirm]").click();
    // Closing schedules the next milestone on the next event-loop turn.
    await page.evaluate(() => new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    }));
  }
  await expect(modal, "Queued server announcements must be acknowledged").toBeHidden();
}
