import { expect, test } from "@playwright/test";
import { loadLocalEnvFile } from "../helpers/load-local-env.js";

loadLocalEnvFile();

const liveEnabled = process.env.EMPIRE_ADMIN_HOSTED_LIVE_E2E === "1";
const username = String(process.env.EMPIRE_ADMIN_BOOTSTRAP_USERNAME ?? "").trim();
const password = String(process.env.EMPIRE_ADMIN_BOOTSTRAP_PASSWORD ?? "");

test.use({ trace: "off", video: "off" });
test.skip(!liveEnabled, "Set EMPIRE_ADMIN_HOSTED_LIVE_E2E=1 and run against local PostgreSQL/API/worker.");

test("owner opens joins through the live dashboard", async ({ page }) => {
  await page.goto("/admin.html");
  await page.locator("[data-admin-username]").fill(username);
  await page.locator("[data-admin-password]").fill(password);
  await page.getByRole("button", { name: "Přihlásit" }).click();
  await page.getByText("Local Free Alpha 1", { exact: true }).first().click();
  await expect(page.locator(".admin-lifecycle")).toContainText("lobby ready");
  const responsePromise = page.waitForResponse((response) =>
    new URL(response.url()).pathname.endsWith("/actions") && response.request().method() === "POST");
  await page.evaluate(() => {
    const reason = document.querySelector("[data-admin-action-reason]");
    const button = document.querySelector('[data-admin-lifecycle="open-joins"]');
    if (!(reason instanceof HTMLInputElement) || !(button instanceof HTMLButtonElement)) throw new Error("Open joins controls are missing.");
    reason.value = "Live atomic join verification";
    reason.dispatchEvent(new Event("input", { bubbles: true }));
    button.click();
  });
  expect((await responsePromise).status()).toBe(202);
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await page.getByRole("button", { name: "Obnovit" }).click();
    const detail = page.locator(".admin-kv-grid").filter({ hasText: "Join policy" }).first();
    if (/open/iu.test(await detail.innerText())) break;
    await page.waitForTimeout(1_000);
  }
  await expect(page.locator(".admin-kv-grid").filter({ hasText: "Join policy" }).first()).toContainText("open");
});
