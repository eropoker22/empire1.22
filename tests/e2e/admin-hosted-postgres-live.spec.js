import { expect, test } from "@playwright/test";

process.loadEnvFile?.(".env.local");

const liveEnabled = process.env.EMPIRE_ADMIN_HOSTED_LIVE_E2E === "1";
const username = String(process.env.EMPIRE_ADMIN_BOOTSTRAP_USERNAME ?? "").trim();
const password = String(process.env.EMPIRE_ADMIN_BOOTSTRAP_PASSWORD ?? "");
const displayName = "Local Free Alpha 1";

test.use({ trace: "off", video: "off" });
test.skip(!liveEnabled, "Set EMPIRE_ADMIN_HOSTED_LIVE_E2E=1 and run against local PostgreSQL/API/worker.");

test("owner creates and provisions a server through the live admin dashboard", async ({ page }) => {
  if (!username || !password) throw new Error("Live admin credentials are not configured in .env.local.");
  await page.goto("/admin.html");
  await page.locator("[data-admin-username]").fill(username);
  await page.locator("[data-admin-password]").fill(password);
  await page.getByRole("button", { name: "Přihlásit" }).click();
  await expect(page.getByRole("heading", { name: "Read-only admin" })).toBeVisible();

  const existing = page.getByText(displayName, { exact: true });
  if (await existing.count()) {
    await existing.first().click();
  } else {
    await page.getByRole("button", { name: "Vytvořit server" }).click();
    await page.getByLabel("Název").fill(displayName);
    await page.getByLabel("Kapacita").fill("4");
    await page.getByRole("button", { name: "Další" }).click();
    await expect(page.locator("[data-admin-map-total]")).toHaveText("161");
    await expect(page.getByLabel("Downtown")).toHaveValue("8");
    await page.getByRole("button", { name: "Další" }).click();
    await page.getByLabel("Closed").check();
    await page.getByRole("button", { name: "Další" }).click();
    await expect(page.locator("[data-admin-create-review]")).toContainText(displayName);
    const createResponsePromise = page.waitForResponse((response) =>
      new URL(response.url()).pathname === "/api/admin/servers" && response.request().method() === "POST");
    await page.getByRole("button", { name: "Create Server" }).click();
    expect((await createResponsePromise).status()).toBe(202);
  }

  await expect(page).toHaveURL(/instance=/u);
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const controlPlaneText = await page.locator("#admin-control-plane").innerText();
    if (/ready/iu.test(controlPlaneText) && /lobby/iu.test(controlPlaneText)) break;
    await page.getByRole("button", { name: "Obnovit" }).click();
    await page.waitForTimeout(2_000);
  }
  await expect(page.locator("#admin-control-plane")).toContainText("ready");
  await expect(page.locator("#admin-control-plane")).toContainText("lobby");
  await expect(page.locator("#admin-servers")).toContainText("0 / 4");
});
