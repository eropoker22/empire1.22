import { expect, test } from "@playwright/test";
import { loadLocalEnvFile } from "../helpers/load-local-env.js";

loadLocalEnvFile();

const liveEnabled = process.env.EMPIRE_ADMIN_HOSTED_LIVE_E2E === "1";
const username = String(process.env.EMPIRE_ADMIN_BOOTSTRAP_USERNAME ?? "").trim();
const password = String(process.env.EMPIRE_ADMIN_BOOTSTRAP_PASSWORD ?? "");

test.use({ trace: "off", video: "off" });
test.skip(!liveEnabled, "Set EMPIRE_ADMIN_HOSTED_LIVE_E2E=1 and run against local PostgreSQL/API/worker.");

test("admin login uses the live PostgreSQL session repository", async ({ page, context }) => {
  if (!username || !password) throw new Error("Live admin credentials are not configured in .env.local.");
  const consoleMessages = [];
  const requestUrls = [];
  const responseBodies = [];
  const responseReads = [];
  page.on("console", (message) => consoleMessages.push(message.text()));
  page.on("request", (request) => requestUrls.push(request.url()));
  page.on("response", (response) => {
    if (!new URL(response.url()).pathname.startsWith("/api/admin/")) return;
    responseReads.push(response.text().then((body) => responseBodies.push(body)).catch(() => undefined));
  });

  await page.goto("/admin.html");
  await page.locator("[data-admin-username]").fill(username);
  await page.locator("[data-admin-password]").fill(password);
  const loginResponsePromise = page.waitForResponse((response) =>
    new URL(response.url()).pathname === "/api/admin/session" && response.request().method() === "POST");
  await page.getByRole("button", { name: "Přihlásit" }).click();
  const loginResponse = await loginResponsePromise;
  expect(loginResponse.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Read-only admin" })).toBeVisible();

  const cookie = (await context.cookies()).find((entry) => entry.name === "empire_admin_session");
  expect(cookie).toBeTruthy();
  expect(cookie.httpOnly).toBe(true);
  expect(cookie.sameSite).toBe("Strict");
  expect(cookie.path).toBe("/api/admin");
  expect(cookie.secure).toBe(false);
  expect(cookie.expires).toBeGreaterThan(Date.now() / 1000);
  const setCookie = (await loginResponse.headersArray()).find((header) => header.name.toLowerCase() === "set-cookie")?.value ?? "";
  expect(setCookie).toContain("HttpOnly");
  expect(setCookie).toContain("SameSite=Strict");
  expect(setCookie).toContain("Path=/api/admin");
  expect(setCookie).toContain("Max-Age=");
  expect(setCookie).toContain("Expires=");
  expect(setCookie).not.toContain("Secure");

  await page.reload();
  await expect(page.getByRole("heading", { name: "Read-only admin" })).toBeVisible();
  const storage = await page.evaluate(() => ({
    local: Object.entries(localStorage),
    session: Object.entries(sessionStorage)
  }));
  expect(JSON.stringify(storage).includes(password)).toBe(false);
  expect(page.url().includes(password)).toBe(false);

  const logoutResponsePromise = page.waitForResponse((response) =>
    new URL(response.url()).pathname === "/api/admin/session" && response.request().method() === "DELETE");
  await page.getByRole("button", { name: "Odhlásit" }).click();
  expect((await logoutResponsePromise).status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Admin konzole" })).toBeVisible();
  expect((await context.cookies()).some((entry) => entry.name === "empire_admin_session")).toBe(false);

  await page.locator("[data-admin-username]").fill(username);
  await page.locator("[data-admin-password]").fill(password);
  await page.getByRole("button", { name: "Přihlásit" }).click();
  await expect(page.getByRole("heading", { name: "Read-only admin" })).toBeVisible();

  await Promise.all(responseReads);
  const browserVisibleData = [...requestUrls, ...consoleMessages, ...responseBodies].join("\n");
  expect(browserVisibleData.includes(password)).toBe(false);
  expect(/password[_-]?(hash|salt)/iu.test(responseBodies.join("\n"))).toBe(false);
});
