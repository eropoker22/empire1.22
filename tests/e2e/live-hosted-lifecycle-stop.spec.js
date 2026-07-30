import { expect, test } from "@playwright/test";
import { loginAndResumeHostedUiParityGame } from "./helpers/hostedUiParityEntry.js";

const hostedEnabled = process.env.EMPIRE_HOSTED_UI_PARITY_E2E === "1";
const lifecycleEnabled = process.env.EMPIRE_ADMIN_HOSTED_LIVE_E2E === "1";
const serverInstanceId = process.env.EMPIRE_UI_PARITY_SERVER_ID || "";
const adminUsername = String(process.env.EMPIRE_ADMIN_BOOTSTRAP_USERNAME ?? "").trim();
const adminPassword = String(process.env.EMPIRE_ADMIN_BOOTSTRAP_PASSWORD ?? "");
const [identity] = parseIdentities(process.env.EMPIRE_HOSTED_BOOTSTRAP_IDENTITIES_JSON);

test.skip(
  !hostedEnabled
  || !lifecycleEnabled
  || !serverInstanceId
  || !adminUsername
  || !adminPassword
  || !identity,
  "Hosted lifecycle coverage requires the guarded local admin and one ready player."
);
test.setTimeout(300_000);

test("admin stop fails player gameplay closed without demo fallback", async ({ browser }) => {
  const playerContext = await browser.newContext({
    baseURL: process.env.PLAYWRIGHT_E2E_BASE_URL
  });
  const adminContext = await browser.newContext({
    baseURL: process.env.PLAYWRIGHT_E2E_BASE_URL
  });
  try {
    const playerPage = await playerContext.newPage();
    const adminPage = await adminContext.newPage();
    playerPage.setDefaultTimeout(20_000);
    adminPage.setDefaultTimeout(20_000);
    await loginAndResumeHostedUiParityGame(playerPage, identity);
    const readModel = await playerPage.evaluate(() => (
      window.EmpireGameplaySliceClient?.getCurrentReadModel?.()
      || window.empireStreetsGameplaySliceReadModel
      || null
    ));
    expect(readModel?.server?.serverInstanceId).toBe(serverInstanceId);

    await adminPage.goto("/admin.html");
    await adminPage.locator("[data-admin-username]").fill(adminUsername);
    await adminPage.locator("[data-admin-password]").fill(adminPassword);
    await adminPage.getByRole("button", { name: "Přihlásit" }).click();
    await expect(adminPage.getByRole("heading", { name: "Control Center" })).toBeVisible();
    await adminPage.locator(`[data-admin-instance="${serverInstanceId}"]`).click();
    await expect(
      adminPage.locator('.admin-lifecycle__head [data-status-value="running"]')
    ).toBeVisible();

    const stopResponse = adminPage.waitForResponse((response) =>
      new URL(response.url()).pathname.endsWith("/actions")
      && response.request().method() === "POST"
    );
    await adminPage.locator('[data-admin-lifecycle="stop"]').click();
    await adminPage.locator("[data-admin-action-reason]")
      .fill("Stop disposable hosted lifecycle verification");
    await adminPage.locator("[data-admin-lifecycle-confirm]").click();
    expect((await stopResponse).status()).toBe(202);

    await expect.poll(
      () => readHostedStatus(adminPage),
      { timeout: 60_000, intervals: [500, 1_000, 2_000] }
    ).toBe("stopped");
    await expect.poll(
      () => readPublicServerState(adminPage, serverInstanceId),
      { timeout: 30_000, intervals: [500, 1_000, 2_000] }
    ).toMatchObject({
      status: "stopped",
      joinPolicy: "closed",
      joinable: false
    });

    const load = await postGameplayRequest(playerPage, "load", {
      serverInstanceId,
      districtId: readModel.district.districtId
    });
    expect(load).toMatchObject({
      status: 200,
      payload: {
        accepted: false,
        readModel: null,
        errors: [{ code: "server.instance_not_ready" }]
      }
    });

    const submit = await postGameplayRequest(playerPage, "submit", {
      command: {
        id: `hosted-lifecycle-stop:${serverInstanceId}`,
        type: "collect-production",
        mode: readModel.mode.mode,
        playerId: readModel.player.playerId,
        serverInstanceId,
        issuedAt: new Date().toISOString(),
        payload: {
          districtId: readModel.district.districtId,
          buildingId: "building:hosted-lifecycle-stop"
        },
        clientRequestId: null
      },
      focusDistrictId: readModel.district.districtId,
      expectedStateVersion: null
    });
    expect(submit).toMatchObject({
      status: 200,
      payload: {
        accepted: false,
        readModel: null,
        errors: [{ code: "server.instance_not_ready" }]
      }
    });

    expect(await playerPage.evaluate(() => ({
      runtimeMode: document.documentElement.dataset.runtimeMode,
      diagnostics: window.empireStreetsRuntimeDiagnostics?.getSummary?.() ?? null,
      localDemoSession: sessionStorage.getItem("empire:local-demo-session:v1"),
      demoStorageWrites: window.__EMPIRE_DEMO_GAMEPLAY_STORAGE_WRITES__ || []
    }))).toMatchObject({
      runtimeMode: "server-authoritative",
      diagnostics: {
        runtimeMode: "server-authoritative",
        demoFallbackActive: false,
        localProjectionActive: false
      },
      localDemoSession: null,
      demoStorageWrites: []
    });
  } finally {
    await Promise.allSettled([
      playerContext.close(),
      adminContext.close()
    ]);
  }
});

const readHostedStatus = (page) => page.evaluate(async (id) => {
  const response = await fetch("/api/admin/control-plane", {
    credentials: "same-origin",
    cache: "no-store"
  });
  const payload = await response.json();
  return payload.data.servers.find((server) => server.serverInstanceId === id)?.status ?? null;
}, serverInstanceId);

const readPublicServerState = (page, id) => page.evaluate(async (expectedId) => {
  const response = await fetch("/api/servers", { cache: "no-store" });
  const payload = await response.json();
  return payload.servers.find((server) => server.serverInstanceId === expectedId) ?? null;
}, id);

const postGameplayRequest = (page, route, body) => page.evaluate(async ({ routeName, requestBody }) => {
  const response = await fetch(`/api/gameplay-slice/${routeName}`, {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(requestBody)
  });
  return {
    status: response.status,
    payload: await response.json()
  };
}, { routeName: route, requestBody: body });

function parseIdentities(value) {
  if (!value) return [];
  const parsed = JSON.parse(value);
  return Array.isArray(parsed) ? parsed : [];
}
