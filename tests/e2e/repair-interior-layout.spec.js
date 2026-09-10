import { test, expect, webkit } from "@playwright/test";
import { readFile } from "node:fs/promises";

// Layout-only fixture: shipped HTML, CSS and information-dialog controller.
// Economic behavior is covered separately by the real hosted production cycles.
async function mount(page, name) {
  const html = (await readFile(`pages/${name}.html`, "utf8")).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  await page.route(`**/pages/${name}.html`, route => route.fulfill({ contentType: "text/html", body: html }));
  await page.goto(`/pages/${name}.html`, { waitUntil: "load" });
  await page.evaluate(() => document.body.classList.remove("game-body--booting"));
}

async function checkAbout(page, name, info, prefix) {
  await mount(page, name);
  await page.evaluate(async () => {
    const { bindLoginAboutModal } = await import("/page-assets/js/app/login-about-modal.js");
    bindLoginAboutModal(document);
    const opener = document.querySelector("[data-login-about-open]");
    opener.focus(); opener.click();
  });
  const overlay = page.locator("[data-login-about-overlay]");
  const card = overlay.locator(".login-about-encyclopedia");
  await expect(overlay).toBeVisible();
  for (const [width, height] of [[1366,768], [390,844], [360,640], [844,390]]) {
    await page.setViewportSize({ width, height });
    if (width < 780) await overlay.locator("[data-login-about-select]").selectOption("economy");
    else await overlay.locator('[data-login-about-tab="economy"]').click();
    await expect(overlay.locator('[data-login-about-panel="economy"]')).toBeVisible();
    await expect(overlay.locator("button[data-login-about-close]")).toBeInViewport();
    const box = await card.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(height + 1);
    const overflow = await card.evaluate(el => ({ width: el.clientWidth, scroll: el.scrollWidth,
      children: [...el.querySelectorAll("*")].filter(child => child.getBoundingClientRect().right > el.getBoundingClientRect().right + 1).map(child => ({ cls: child.className, width: child.getBoundingClientRect().width })) }));
    if (overflow.scroll > overflow.width + 1) { console.log(name, width, overflow); await page.screenshot({ path: info.outputPath("overflow.png") }); }
    expect(overflow.scroll).toBeLessThanOrEqual(overflow.width + 1);
    expect(await overlay.locator("[data-login-about-panel]:not([hidden]) .login-about-section-block li").first().evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
    await page.screenshot({ path: info.outputPath(`${prefix}-${name}-${width}x${height}.png`) });
  }
  await page.keyboard.press("Escape");
  await expect(overlay).toBeHidden();
  expect(await page.evaluate(() => document.body.classList.contains("login-modal-open"))).toBe(false);
}

test("shared About interior remains readable on login and in game", async ({ page }, info) => {
  for (const name of ["login", "game"]) await checkAbout(page, name, info, "chromium");
});

test("About interior supports WebKit viewport height changes", async ({ baseURL }, info) => {
  const browser = await webkit.launch();
  try {
    const page = await browser.newPage({ baseURL, reducedMotion: "reduce" });
    for (const name of ["login", "game"]) await checkAbout(page, name, info, "webkit");
  } finally { await browser.close(); }
});
