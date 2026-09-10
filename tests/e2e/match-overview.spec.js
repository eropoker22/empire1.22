import { test, expect, webkit } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { buildSync } from "esbuild";
const fixtureBundle = `.tmp/match-overview-fixtures-${process.pid}.mjs`;
buildSync({ entryPoints: ["tests/e2e/fixtures/match-overview-fixtures.ts"], bundle: true, platform: "node", format: "esm", tsconfig: "tsconfig.base.json", outfile: fixtureBundle });
const fixtures = JSON.parse(execFileSync(process.execPath, [fixtureBundle], { encoding: "utf8", timeout: 30000 }));
const snapshot = kind => fixtures[kind];
async function mount(page, kind) {
  // Real shipped markup/CSS/binder, fed the normal read models from game-core.
  // No application network/identity is replaced: this is an isolated component test.
  const html = (await readFile("pages/game.html", "utf8")).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  await page.route("**/pages/game.html", route => route.fulfill({ contentType: "text/html", body: html }));
  await page.goto("/pages/game.html", { waitUntil: "domcontentloaded" });
  await page.evaluate(async (slice) => {
    const { bindEliminationPurgePanel } = await import("/page-assets/js/app/runtime/eliminationPurgePanelRuntime.js");
    window.__matchPanel = bindEliminationPurgePanel(document.body, { getGameplaySlice: () => window.__matchSlice });
    window.__matchSlice = slice; window.__matchPanel.open(document.querySelector("[data-elimination-ai-panel-open]"));
  }, snapshot(kind));
  await expect(page.locator("[data-elimination-ai-panel]")).toBeVisible();
}

test("separates purge, quiet hours and active final time using server projections", async ({ page }, info) => {
  await mount(page, "quiet");
  const hero = page.locator(".elimination-ai-panel__hero");
  await expect(hero).toContainText("Další očista za");
  await expect(hero).toContainText(/7h 59min|8h 00min/);
  await expect(page.locator('[data-match-clock="quiet"]')).toContainText(/1h (19|20)min/);
  for (const kind of ["ordinary", "final-active", "final-paused", "paused", "stale", "lobby", "disabled", "defeated", "ended"]) {
    await page.evaluate(slice => { window.__matchSlice = slice; window.__matchPanel.render(); }, snapshot(kind));
    await expect(hero).not.toContainText(/NaN|undefined/);
    if (kind === "ended") { await expect(hero).toContainText("Konečný výsledek"); await expect(page.locator("[data-match-clock]")).toHaveCount(0); }
    if (kind === "final-paused") {
      await expect(hero).toContainText("2h 15min 00s");
      const before = await hero.textContent(); await page.waitForTimeout(1100); expect(await hero.textContent()).toBe(before);
      await expect(page.locator('[data-match-clock="quiet"]')).toContainText("Pokračuje za");
    }
    await page.screenshot({ path: info.outputPath(`${kind}-desktop.png`) });
  }
  for (let i = 0; i < 5; i++) { await page.keyboard.press("Escape"); await page.evaluate(() => window.__matchPanel.open()); }
  await page.keyboard.press("Tab"); expect(await page.locator('[data-elimination-ai-panel]').evaluate(el => el.contains(document.activeElement))).toBe(true);
  await page.evaluate(() => window.__matchPanel.destroy());
});

test("two tabs and a changed device clock retain the same paused server phase after reopening", async ({ page }) => {
  const other = await page.context().newPage();
  try {
    await other.addInitScript(() => { Date.now = () => 9000000000000; });
    for (const tab of [page, other]) {
      await mount(tab, "final-paused");
      await tab.getByRole("button", { name: "Zavřít očistu" }).click();
      await tab.evaluate(() => window.__matchPanel.open());
      await expect(tab.locator(".elimination-ai-panel__hero")).toContainText("2h 15min 00s");
    }
    await page.waitForTimeout(1100);
    for (const tab of [page, other]) await expect(tab.locator(".elimination-ai-panel__hero")).toContainText("2h 15min 00s");
  } finally { await other.close(); }
});

test("fits phone, tablet, desktop and landscape without losing close or main time", async ({ page }, info) => {
  await mount(page, "final-paused");
  for (const [width, height] of [[360,780],[390,844],[430,932],[768,1024],[1366,768],[1920,1080],[844,390],[390,640]]) {
    await page.setViewportSize({ width, height });
    const card = page.locator(".elimination-ai-panel__card");
    await expect.poll(async () => { const box = await card.boundingBox(); return box && box.x >= -1 && box.y >= -1 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1; }).toBe(true);
    await expect(page.getByRole("button", { name: "Zavřít očistu" })).toBeInViewport();
    expect(await card.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: info.outputPath(`final-paused-${width}x${height}.png`) });
  }
});

test("WebKit preserves the visible card through mobile height changes", async ({ baseURL }, info) => {
  const browser = await webkit.launch();
  try {
    const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    page.on("requestfailed", request => console.error("WebKit resource:", request.url(), request.failure()?.errorText));
    page.on("pageerror", error => console.error("WebKit page:", error.message));
    page.on("console", message => { if (message.type() === "error") console.error("WebKit console:", message.text()); });
    await mount(page, "quiet");
    for (const [width,height] of [[390,844],[390,640],[844,390],[390,844]]) {
      await page.setViewportSize({ width,height });
      await expect(page.getByRole("button", { name: "Zavřít očistu" })).toBeInViewport();
      const box = await page.locator(".elimination-ai-panel__card").boundingBox();
      expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
      expect(box.y + box.height).toBeLessThanOrEqual(height + 1);
      await page.screenshot({ path: info.outputPath(`webkit-${width}x${height}.png`) });
    }
    await context.close();
  } finally { await browser.close(); }
});
