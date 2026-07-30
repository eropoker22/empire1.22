import { expect, test } from "@playwright/test";
import {
  expectHostedUiParityClean,
  registerAndEnterHostedUiParityGame,
  waitForLiveGame
} from "./helpers/hostedUiParityEntry.js";
import {
  openBuildingFromDistrict,
  openDistrictById
} from "./helpers/uiParityCapture.js";

const manualEnabled = process.env.EMPIRE_MANUAL_HOSTED_E2E === "1";
const adminUsername = String(process.env.EMPIRE_ADMIN_BOOTSTRAP_USERNAME || "").trim();
const adminPassword = String(process.env.EMPIRE_ADMIN_BOOTSTRAP_PASSWORD || "");
const displayName = String(process.env.EMPIRE_MANUAL_HOSTED_DISPLAY_NAME || "").trim();
const startingPlayerState = parseStartingPlayerState(
  process.env.EMPIRE_MANUAL_HOSTED_STARTING_STATE_JSON
);

test.use({ trace: "on", video: "off" });
test.skip(
  !manualEnabled
    || !adminUsername
    || !adminPassword
    || !displayName
    || !startingPlayerState,
  "Manual hosted flow requires the guarded local PostgreSQL/API/worker harness."
);
test.setTimeout(900_000);

test("owner creates a server and players prove exact hosted state through visible UI", async ({
  browser,
  page: adminPage
}, testInfo) => {
  const playerClients = [];
  const safeTrace = {
    displayName,
    serverInstanceId: null,
    createPayload: null,
    persistedStartingPlayerState: null,
    playerStartingStates: [],
    tickTrace: null,
    visibleCommand: null,
    finalStatus: null
  };

  try {
    await loginAdmin(adminPage);
    const created = await createServerThroughAdmin(adminPage);
    const serverInstanceId = created.response.server.serverInstanceId;
    safeTrace.serverInstanceId = serverInstanceId;
    safeTrace.createPayload = created.request.startingPlayerState;
    expect(created.request.capacity).toBe(2);
    expect(created.response.server.capacity).toBe(2);
    expect(created.request.startingPlayerState).toEqual(startingPlayerState);
    expect(created.response.server.startingPlayerState).toEqual(startingPlayerState);

    const readyServer = await waitForAdminServer(
      adminPage,
      serverInstanceId,
      (server) => server.provisioningState === "ready"
        && server.status === "lobby"
        && Boolean(server.currentSnapshotId)
    );
    safeTrace.persistedStartingPlayerState = readyServer.startingPlayerState;
    expect(readyServer.startingPlayerState).toEqual(startingPlayerState);
    await refreshAdmin(adminPage);
    await expect(adminPage.locator("[data-admin-starting-state]")).toBeVisible();
    await expect(adminPage.locator("[data-admin-starting-state]"))
      .toContainText("Starting state uložený na serveru");
    await expect(adminPage.locator("[data-admin-starting-state]"))
      .toContainText(`Alarm: ${startingPlayerState.materials.alarm}`);

    await requestAdminAction(
      adminPage,
      "open-registration-now",
      "Manual hosted acceptance registration"
    );
    await waitForAdminServer(
      adminPage,
      serverInstanceId,
      (server) => server.registrationState === "open" && server.joinPolicy === "open"
    );

    for (const [index, spawnDistrictId] of ["district:26", "district:42"].entries()) {
      const context = await browser.newContext({
        baseURL: process.env.PLAYWRIGHT_E2E_BASE_URL
      });
      const playerPage = await context.newPage();
      playerPage.setDefaultTimeout(20_000);
      const entry = await registerAndEnterHostedUiParityGame(playerPage, {
        serverInstanceId,
        spawnDistrictIds: [spawnDistrictId],
        identityPrefix: `ManualHosted${index + 1}`,
        waitForRunning: false
      });
      const playerStartingState = await expectExactStartingState(playerPage);
      safeTrace.playerStartingStates.push({
        spawnDistrictId: entry.spawnDistrictId,
        balances: playerStartingState.balances,
        economyPopulation: playerStartingState.economyPopulation,
        spySlots: playerStartingState.spySlots
      });
      playerClients.push({
        context,
        page: playerPage,
        diagnostics: entry.diagnostics,
        identity: entry.identity,
        spawnDistrictId: entry.spawnDistrictId
      });
    }

    await refreshAdmin(adminPage);
    await expect(adminPage.locator(".admin-start-readiness")).toContainText(
      `2 / ${created.response.server.minimumReadyPlayersToStart}`
    );
    await expect(adminPage.locator(".admin-start-readiness"))
      .toContainText("START SERVERU PŘIPRAVENO");
    await expect(adminPage.locator('[data-admin-lifecycle="start"]')).toBeEnabled();
    await requestAdminAction(adminPage, "start", "Manual hosted acceptance start");
    await waitForAdminServer(
      adminPage,
      serverInstanceId,
      (server) => server.status === "running"
    );
    for (const client of playerClients) {
      await waitForLiveGame(client.page);
      await expectVisibleStorageMatchesAuthoritativeState(client.page);
    }

    const beforeTick = await readTickState(playerClients[0].page);
    await expect.poll(
      async () => {
        const current = await readTickState(playerClients[0].page);
        return current.currentTick > beforeTick.currentTick
          && current.stateVersion > beforeTick.stateVersion
          && current.cash > beforeTick.cash;
      },
      {
        message: "The admin-created server must advance its own tick and credit clean cash.",
        timeout: 90_000,
        intervals: [1_000, 2_000, 5_000]
      }
    ).toBe(true);
    const afterTick = await readTickState(playerClients[0].page);
    safeTrace.tickTrace = { before: beforeTick, after: afterTick };

    safeTrace.visibleCommand = await runRestaurantActionThroughVisibleUi(
      playerClients[0].page,
      playerClients[0].spawnDistrictId
    );
    await playerClients[0].page.reload({ waitUntil: "load" });
    await waitForLiveGame(playerClients[0].page);
    const restored = await readTickState(playerClients[0].page);
    expect(restored.stateVersion).toBeGreaterThanOrEqual(
      safeTrace.visibleCommand.stateVersion
    );

    for (const client of playerClients) {
      await expectHostedUiParityClean(client.page, client.diagnostics);
    }

    await refreshAdmin(adminPage);
    await requestAdminAction(
      adminPage,
      "delete",
      "Archive completed manual hosted acceptance",
      displayName
    );
    const archived = await waitForAdminServer(
      adminPage,
      serverInstanceId,
      (server) => server.status === "archived"
    );
    safeTrace.finalStatus = archived.status;

    for (const client of playerClients) {
      await client.page.reload({ waitUntil: "domcontentloaded" });
      await expect(client.page).toHaveURL(/\/pages\/lobby\.html/u, { timeout: 30_000 });
      await expect(client.page.locator("[data-live-gang-user]"))
        .toHaveText(client.identity.username);
      await expect(client.page.getByTestId("continue-active-server")).toBeHidden();
    }
  } finally {
    await testInfo.attach("manual-hosted-safe-trace.json", {
      body: Buffer.from(JSON.stringify(safeTrace, null, 2)),
      contentType: "application/json"
    });
    await Promise.allSettled(playerClients.map((client) => client.context.close()));
  }
});

async function loginAdmin(page) {
  await page.goto("/admin.html");
  await page.locator("[data-admin-username]").fill(adminUsername);
  await page.locator("[data-admin-password]").fill(adminPassword);
  await page.getByRole("button", { name: "Přihlásit" }).click();
  await expect(page.getByRole("heading", { name: "Control Center" })).toBeVisible();
}

async function createServerThroughAdmin(page) {
  await page.locator("[data-admin-create-open]").click();
  await page.getByLabel("Název").fill(displayName);
  await page.getByLabel("Kapacita").fill("2");
  await advanceWizard(page, 2);
  await expect(page.locator("[data-admin-map-total]")).toHaveText("161");
  await advanceWizard(page, 3);
  await page.locator('[name="startingCleanCash"]').fill(
    String(startingPlayerState.cleanCash)
  );
  await page.locator('[name="startingDirtyCash"]').fill(
    String(startingPlayerState.dirtyCash)
  );
  await page.locator('[name="startingPopulation"]').fill(
    String(startingPlayerState.population)
  );
  for (const [materialId, value] of Object.entries(startingPlayerState.materials)) {
    await page.locator(`[name="startingMaterial:${materialId}"]`).fill(String(value));
  }
  await advanceWizard(page, 4);
  await advanceWizard(page, 5);
  await expect(page.locator("[data-admin-create-review]")).toContainText(
    `${startingPlayerState.cleanCash} / ${startingPlayerState.dirtyCash}`
  );
  await expect(page.locator("[data-admin-create-review]")).toContainText(
    `Alarm: ${startingPlayerState.materials.alarm}`
  );

  const requestPromise = page.waitForRequest((request) => (
    new URL(request.url()).pathname === "/api/admin/servers"
    && request.method() === "POST"
  ));
  const responsePromise = page.waitForResponse((response) => (
    new URL(response.url()).pathname === "/api/admin/servers"
    && response.request().method() === "POST"
  ));
  await page.locator("[data-admin-create-form] [type=submit]").click();
  const [request, response] = await Promise.all([requestPromise, responsePromise]);
  expect(response.status()).toBe(202);
  const payload = await response.json();
  expect(payload.accepted).toBe(true);
  await expect(page).toHaveURL(/instance=/u);
  return {
    request: request.postDataJSON(),
    response: payload.data
  };
}

async function advanceWizard(page, targetStep) {
  await page.locator(
    '[data-admin-wizard-panel]:not([hidden]) [data-admin-wizard-next]'
  ).click();
  await expect(page.locator(
    `[data-admin-wizard-panel="${targetStep}"]:not([hidden])`
  )).toBeVisible();
}

async function expectExactStartingState(page) {
  const snapshot = await page.evaluate(() => {
    const readModel = window.EmpireGameplaySliceClient?.getCurrentReadModel?.()
      || window.empireStreetsGameplaySliceReadModel
      || null;
    const spyTargets = readModel?.district?.spyTargets
      || readModel?.district?.targetActions?.spyTargets
      || [];
    const spySlots = spyTargets.find((target) => Array.isArray(target.slots))?.slots || [];
    return {
      balances: readModel?.player?.resourceBalances || {},
      economyPopulation: Number(readModel?.player?.economy?.population || 0),
      spySlots: spySlots.map((slot) => ({
        slotId: slot.slotId,
        available: slot.available
      }))
    };
  });
  const expectedBalances = {
    cash: startingPlayerState.cleanCash,
    "dirty-cash": startingPlayerState.dirtyCash,
    population: startingPlayerState.population,
    ...startingPlayerState.materials
  };
  expect(snapshot.balances).toMatchObject(expectedBalances);
  expect(snapshot.economyPopulation).toBe(startingPlayerState.population);
  expect(snapshot.spySlots).toHaveLength(startingPlayerState.spySlots);
  expect(snapshot.spySlots.every((slot) => slot.available)).toBe(true);
  await expect(page.locator("[data-topbar-clean-money]"))
    .toHaveAttribute("data-money-target", String(startingPlayerState.cleanCash));
  await expect(page.locator("[data-topbar-dirty-money]"))
    .toHaveAttribute("data-money-target", String(startingPlayerState.dirtyCash));

  return snapshot;
}

async function expectVisibleStorageMatchesAuthoritativeState(page) {
  const balances = await page.evaluate(() => (
    window.EmpireGameplaySliceClient?.getCurrentReadModel?.()?.player?.resourceBalances || {}
  ));
  await page.locator("[data-storage-popup-open]").click();
  const storage = page.locator("[data-storage-popup]");
  await expect(storage).toBeVisible();
  for (const materialId of Object.keys(startingPlayerState.materials)) {
    await expect(
      storage.locator(`[data-storage-resource="${materialId}"] [data-storage-value]`)
    ).toHaveText(new RegExp(`^${balances[materialId]}\\s*/`));
  }
  await storage.locator("[data-storage-popup-close]").last().click();
  await expect(storage).toBeHidden();
}

async function runRestaurantActionThroughVisibleUi(page, districtId) {
  await openDistrictById(page, districtId);
  await openBuildingFromDistrict(page, "restaurant");
  const actionButton = page.locator(
    "[data-district-building-detail-popup]:not([hidden]) "
      + "[data-district-building-detail-action-index]:not([disabled])"
  ).first();
  await expect(actionButton).toBeVisible();
  const actionId = await actionButton.getAttribute(
    "data-district-building-detail-action-id"
  );
  const responsePromise = page.waitForResponse((response) => (
    new URL(response.url()).pathname === "/api/gameplay-slice/submit"
    && response.request().method() === "POST"
  ));
  await actionButton.click();
  const confirmation = page.locator(
    ".building-special-action-confirm:not([hidden]) "
      + ".building-special-action-confirm__button--confirm"
  );
  await expect(confirmation).toBeVisible();
  await confirmation.click();
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  const request = response.request().postDataJSON();
  const payload = await response.json();
  expect(request.command).toMatchObject({
    type: "run-building-action",
    payload: {
      districtId,
      actionId
    }
  });
  expect(payload.accepted).toBe(true);
  expect(payload.readModel.reports).toEqual(expect.arrayContaining([
    expect.objectContaining({
      reportType: "building-action",
      actionType: "run-building-action",
      buildingActionId: actionId,
      result: "success"
    })
  ]));
  return {
    actionId,
    buildingId: request.command.payload.buildingId,
    districtId,
    stateVersion: payload.readModel.server.stateVersion
  };
}

async function requestAdminAction(page, action, reason, confirmationText = "") {
  const registrationAction = action.includes("registration");
  const buttonSelector = registrationAction
    ? `[data-admin-registration-action="${action}"]`
    : `[data-admin-lifecycle="${action}"]`;
  await expect(page.locator(buttonSelector)).toBeEnabled();
  const responsePromise = page.waitForResponse((response) => (
    new URL(response.url()).pathname.endsWith("/actions")
    && response.request().method() === "POST"
  ));
  await page.locator(buttonSelector).click();
  await page.locator(
    registrationAction
      ? "[data-admin-registration-reason]"
      : "[data-admin-action-reason]"
  ).fill(reason);
  if (confirmationText) {
    await page.locator("[data-admin-delete-confirmation]").fill(confirmationText);
  }
  await page.locator(
    registrationAction
      ? "[data-admin-registration-confirm]"
      : "[data-admin-lifecycle-confirm]"
  ).click();
  const response = await responsePromise;
  expect(response.status()).toBe(202);
}

async function refreshAdmin(page) {
  const responsePromise = page.waitForResponse((response) => (
    new URL(response.url()).pathname === "/api/admin/control-plane"
    && response.request().method() === "GET"
  ));
  await page.locator("[data-admin-refresh]").click();
  await responsePromise;
}

async function waitForAdminServer(page, serverInstanceId, predicate) {
  let current = null;
  await expect.poll(
    async () => {
      current = await readAdminServer(page, serverInstanceId);
      return Boolean(current && predicate(current));
    },
    {
      message: `Hosted server ${serverInstanceId} must reach the expected state.`,
      timeout: 120_000,
      intervals: [500, 1_000, 2_000]
    }
  ).toBe(true);
  return current;
}

const readAdminServer = (page, serverInstanceId) => page.evaluate(
  async (expectedServerInstanceId) => {
    const response = await fetch("/api/admin/control-plane", {
      credentials: "same-origin",
      cache: "no-store"
    });
    const payload = await response.json();
    return payload.data.servers.find((server) => (
      server.serverInstanceId === expectedServerInstanceId
    )) || null;
  },
  serverInstanceId
);

const readTickState = (page) => page.evaluate(() => {
  const readModel = window.EmpireGameplaySliceClient?.getCurrentReadModel?.()
    || window.empireStreetsGameplaySliceReadModel
    || null;
  return {
    currentTick: Number(readModel?.server?.currentTick || 0),
    stateVersion: Number(readModel?.server?.stateVersion || 0),
    cash: Number(readModel?.player?.resourceBalances?.cash || 0),
    dirtyCash: Number(readModel?.player?.resourceBalances?.["dirty-cash"] || 0),
    population: Number(readModel?.player?.resourceBalances?.population || 0)
  };
});

function parseStartingPlayerState(value) {
  if (!value) return null;
  const parsed = JSON.parse(value);
  if (
    !Number.isFinite(parsed?.cleanCash)
    || !Number.isFinite(parsed?.dirtyCash)
    || !Number.isFinite(parsed?.population)
    || parsed?.spySlots !== 2
    || !parsed?.materials
    || Object.keys(parsed.materials).length !== 21
  ) {
    throw new Error("Manual hosted starting state must contain every canonical field.");
  }
  return parsed;
}
