import { expect, test } from "@playwright/test";

process.loadEnvFile?.(".env.local");

const liveEnabled = process.env.EMPIRE_ADMIN_HOSTED_LIVE_E2E === "1";
const username = String(process.env.EMPIRE_ADMIN_BOOTSTRAP_USERNAME ?? "").trim();
const password = String(process.env.EMPIRE_ADMIN_BOOTSTRAP_PASSWORD ?? "");

test.use({ trace: "off", video: "off" });
test.skip(!liveEnabled, "Set EMPIRE_ADMIN_HOSTED_LIVE_E2E=1 and run against local PostgreSQL/API/worker.");

test("owner safely stops the live hosted server through the dashboard", async ({ page }) => {
  await page.goto("/admin.html");
  await page.locator("[data-admin-username]").fill(username);
  await page.locator("[data-admin-password]").fill(password);
  await page.getByRole("button", { name: "Přihlásit" }).click();
  await page.getByText("Local Free Alpha 1", { exact: true }).first().click();
  await expect(page.locator(".admin-lifecycle")).toContainText("running");

  const actionResponse = page.waitForResponse((response) =>
    new URL(response.url()).pathname.endsWith("/actions") && response.request().method() === "POST");
  await page.evaluate(() => {
    const reason = document.querySelector("[data-admin-action-reason]");
    const button = document.querySelector('[data-admin-lifecycle="stop"]');
    if (!(reason instanceof HTMLInputElement) || !(button instanceof HTMLButtonElement)) throw new Error("Stop controls are missing.");
    reason.value = "Stop local hosted environment after live lifecycle verification";
    reason.dispatchEvent(new Event("input", { bubbles: true }));
    button.click();
  });
  expect((await actionResponse).status()).toBe(202);

  await expect.poll(async () => page.evaluate(async () => {
    const response = await fetch("/api/admin/control-plane", { credentials: "same-origin", cache: "no-store" });
    const payload = await response.json();
    return payload.data.servers.find((entry) => entry.displayName === "Local Free Alpha 1")?.status;
  }), { timeout: 20_000, intervals: [500, 1_000, 2_000] }).toBe("stopped");
});
