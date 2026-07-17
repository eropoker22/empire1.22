import { expect, test } from "@playwright/test";

process.loadEnvFile?.(".env.local");

const liveEnabled = process.env.EMPIRE_ADMIN_HOSTED_LIVE_E2E === "1";
const username = String(process.env.EMPIRE_ADMIN_BOOTSTRAP_USERNAME ?? "").trim();
const password = String(process.env.EMPIRE_ADMIN_BOOTSTRAP_PASSWORD ?? "");
const serverInstanceId = "instance:free:eu-central:4f197d9f-a2ef-4c69-a4d1-dd442c968ebb";

test.use({ trace: "off", video: "off" });
test.skip(!liveEnabled, "Set EMPIRE_ADMIN_HOSTED_LIVE_E2E=1 and run against local PostgreSQL/API/worker.");

test("owner drives the live hosted lifecycle without losing durable state", async ({ page }) => {
  await page.goto("/admin.html");
  await page.locator("[data-admin-username]").fill(username);
  await page.locator("[data-admin-password]").fill(password);
  await page.getByRole("button", { name: "Přihlásit" }).click();
  await page.getByText("Local Free Alpha 1", { exact: true }).first().click();

  const initial = await hostedServer(page);
  expect(initial).toMatchObject({ status: "lobby", joinPolicy: "open", provisioningState: "ready" });
  const initialDetail = await instanceDetail(page);
  expect(initialDetail.summary.playerCount).toBe(4);

  await requestAction(page, "start", "Start live lifecycle verification", { status: "running" });
  const startedTick = (await instanceDetail(page)).summary.currentTick;
  await page.waitForTimeout(11_000);
  expect((await instanceDetail(page)).summary.currentTick).toBeGreaterThan(startedTick);

  await requestAction(page, "pause", "Pause live lifecycle verification", { status: "paused" });
  const pausedTick = (await instanceDetail(page)).summary.currentTick;
  await page.waitForTimeout(11_000);
  expect((await instanceDetail(page)).summary.currentTick).toBe(pausedTick);

  await requestAction(page, "resume", "Resume live lifecycle verification", { status: "running" });
  await page.waitForTimeout(11_000);
  expect((await instanceDetail(page)).summary.currentTick).toBeGreaterThan(pausedTick);

  await requestAction(page, "close-joins", "Close joins after live verification", { status: "running", joinPolicy: "closed" });
  const beforeRestart = await instanceDetail(page);
  await requestAction(page, "restart", "Safe restart live lifecycle verification", { status: "running", joinPolicy: "closed" });
  const afterRestart = await instanceDetail(page);
  expect(afterRestart.serverInstanceId).toBe(serverInstanceId);
  expect(afterRestart.summary.playerCount).toBe(4);
  expect(afterRestart.commands).toEqual(beforeRestart.commands);

  const publicList = await page.request.get("/api/servers");
  expect(publicList.status()).toBe(200);
  expect(JSON.stringify(await publicList.json())).not.toContain(serverInstanceId);

  await requestAction(page, "stop", "Stop local live lifecycle server", { status: "stopped", joinPolicy: "closed" });
  await expect(page.locator(".admin-lifecycle")).toContainText("stopped");
});

const requestAction = async (page, action, reason, expected) => {
  const responsePromise = page.waitForResponse((response) =>
    new URL(response.url()).pathname.endsWith("/actions") && response.request().method() === "POST");
  await page.evaluate(({ action, reason }) => {
    const reasonInput = document.querySelector("[data-admin-action-reason]");
    const button = document.querySelector(`[data-admin-lifecycle="${action}"]`);
    if (!(reasonInput instanceof HTMLInputElement) || !(button instanceof HTMLButtonElement)) {
      throw new Error(`Lifecycle control ${action} is missing.`);
    }
    reasonInput.value = reason;
    reasonInput.dispatchEvent(new Event("input", { bubbles: true }));
    button.click();
  }, { action, reason });
  expect((await responsePromise).status()).toBe(202);

  await expect.poll(async () => {
    const server = await hostedServer(page);
    return { status: server.status, joinPolicy: server.joinPolicy };
  }, { timeout: 20_000, intervals: [500, 1_000, 2_000] }).toMatchObject(expected);
  const refreshResponse = page.waitForResponse((response) =>
    new URL(response.url()).pathname === "/api/admin/control-plane" && response.request().method() === "GET");
  await page.getByRole("button", { name: "Obnovit" }).click();
  await refreshResponse;
};

const hostedServer = async (page) => page.evaluate(async (serverInstanceId) => {
  const response = await fetch("/api/admin/control-plane", { credentials: "same-origin", cache: "no-store" });
  const payload = await response.json();
  const server = payload.data.servers.find((entry) => entry.serverInstanceId === serverInstanceId);
  if (!server) throw new Error("Live hosted server is missing.");
  return server;
}, serverInstanceId);

const instanceDetail = async (page) => page.evaluate(async (serverInstanceId) => {
  const response = await fetch(`/api/admin/instances/${encodeURIComponent(serverInstanceId)}`, {
    credentials: "same-origin",
    cache: "no-store"
  });
  const payload = await response.json();
  if (!payload.data) throw new Error("Live instance detail is unavailable.");
  return payload.data;
}, serverInstanceId);
