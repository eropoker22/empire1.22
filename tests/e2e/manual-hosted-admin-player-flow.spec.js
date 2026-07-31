import { expect, test } from "@playwright/test";
import {
  expectHostedUiParityClean,
  registerAndEnterHostedUiParityGame,
  waitForLiveGame
} from "./helpers/hostedUiParityEntry.js";
import {
  exerciseHostedProductionLifecycleThroughVisibleUi
} from "./helpers/hostedProductionParity.js";
import {
  closeSurface,
  openBuildingFromDistrict,
  openDistrictById
} from "./helpers/uiParityCapture.js";
import {
  createAuthoritativeIncomeTickDelta
} from "./helpers/authoritativeIncomeEvidence.js";
import { waitForTerminalGameplaySubmit } from "./helpers/gameplaySubmitResponse.js";

const manualEnabled = process.env.EMPIRE_MANUAL_HOSTED_E2E === "1";
const adminUsername = String(process.env.EMPIRE_ADMIN_BOOTSTRAP_USERNAME || "").trim();
const adminPassword = String(process.env.EMPIRE_ADMIN_BOOTSTRAP_PASSWORD || "");
const displayName = String(process.env.EMPIRE_MANUAL_HOSTED_DISPLAY_NAME || "").trim();
const startingPlayerState = parseStartingPlayerState(
  process.env.EMPIRE_MANUAL_HOSTED_STARTING_STATE_JSON
);
const manualBaseTestTimeoutMs = 900_000;
const manualServerCapacity = 4;
const manualProductionCases = Object.freeze([
  Object.freeze({
    buildingTypeId: "pharmacy",
    clientIndex: 0,
    districtId: "district:26",
    label: "Pharmacy",
    recipeId: "chemicals",
    resourceKey: "chemicals",
    surfaceName: "pharmacy"
  }),
  Object.freeze({
    buildingTypeId: "factory",
    clientIndex: 1,
    districtId: "district:68",
    label: "Factory",
    recipeId: "metal-parts",
    resourceKey: "metal-parts",
    surfaceName: "factory"
  }),
  Object.freeze({
    buildingTypeId: "drug_lab",
    clientIndex: 2,
    districtId: "district:91",
    label: "Drug Lab",
    recipeId: "neon-dust",
    resourceKey: "neon-dust",
    surfaceName: "drugLab"
  }),
  Object.freeze({
    buildingTypeId: "armory",
    clientIndex: 3,
    districtId: "district:70",
    label: "Armory",
    recipeId: "baseball-bat",
    resourceKey: "baseball-bat",
    surfaceName: "armory"
  })
]);

test.use({ trace: "on", video: "off" });
test.skip(
  !manualEnabled
    || !adminUsername
    || !adminPassword
    || !displayName
    || !startingPlayerState,
  "Manual hosted flow requires the guarded local PostgreSQL/API/worker harness."
);
test.setTimeout(manualBaseTestTimeoutMs);

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
    productionCommands: [],
    productionSubmitPosts: [],
    visibleCommand: null,
    finalStatus: null
  };

  try {
    await loginAdmin(adminPage);
    const created = await createServerThroughAdmin(adminPage);
    const serverInstanceId = created.response.server.serverInstanceId;
    safeTrace.serverInstanceId = serverInstanceId;
    safeTrace.createPayload = created.request.startingPlayerState;
    expect(created.request.capacity).toBe(manualServerCapacity);
    expect(created.response.server.capacity).toBe(manualServerCapacity);
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
    await refreshAdmin(adminPage, serverInstanceId);
    await expect(adminPage.locator("[data-admin-starting-state]")).toBeVisible();
    await expect(adminPage.locator("[data-admin-starting-state]"))
      .toContainText("Starting state uložený na serveru");
    await expect(adminPage.locator("[data-admin-starting-state]"))
      .toContainText(`Alarm: ${startingPlayerState.materials.alarm}`);
    await attachScreenshot(
      testInfo,
      "manual-hosted-admin-starting-state.png",
      adminPage
    );

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

    for (const { clientIndex: index, districtId: spawnDistrictId } of manualProductionCases) {
      const context = await browser.newContext({
        baseURL: process.env.PLAYWRIGHT_E2E_BASE_URL
      });
      const client = { context, page: null };
      playerClients.push(client);
      const playerPage = await context.newPage();
      client.page = playerPage;
      playerPage.setDefaultTimeout(20_000);
      const entry = await registerAndEnterHostedUiParityGame(playerPage, {
        serverInstanceId,
        spawnDistrictIds: [spawnDistrictId],
        identityPrefix: `ManualHosted${index + 1}`,
        waitForRunning: false
      });
      expect(entry.serverInstanceId).toBe(serverInstanceId);
      const playerStartingState = await expectExactStartingState(playerPage);
      safeTrace.playerStartingStates.push({
        membershipId: entry.membershipId,
        playerId: entry.playerId,
        serverInstanceId: entry.serverInstanceId,
        spawnDistrictId: entry.spawnDistrictId,
        balances: playerStartingState.balances,
        economyPopulation: playerStartingState.economyPopulation,
        economyInfluence: playerStartingState.economyInfluence,
        spySlots: playerStartingState.spySlots,
        visibleTopbar: playerStartingState.visibleTopbar
      });
      await attachScreenshot(
        testInfo,
        `manual-hosted-player-${index + 1}-starting-state.png`,
        playerPage
      );
      Object.assign(client, {
        diagnostics: entry.diagnostics,
        identity: entry.identity,
        membershipId: entry.membershipId,
        playerId: entry.playerId,
        serverInstanceId: entry.serverInstanceId,
        spawnDistrictId: entry.spawnDistrictId
      });
    }
    expect(new Set(playerClients.map((client) => client.membershipId)).size)
      .toBe(manualServerCapacity);
    expect(new Set(playerClients.map((client) => client.playerId)).size)
      .toBe(manualServerCapacity);
    expect(playerClients.every(
      (client) => client.serverInstanceId === serverInstanceId
    )).toBe(true);

    await refreshAdmin(adminPage, serverInstanceId);
    await expect(adminPage.locator(".admin-start-readiness")).toContainText(
      `${manualServerCapacity} / ${created.response.server.minimumReadyPlayersToStart}`
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
      await waitForLiveGame(client.page, serverInstanceId);
      await expectVisibleStorageMatchesAuthoritativeState(client.page);
    }

    safeTrace.tickTrace = await collectThreeSampleTickEvidence({
      adminPage,
      districtId: playerClients[0].spawnDistrictId,
      playerPage: playerClients[0].page,
      serverInstanceId
    });
    await attachScreenshot(
      testInfo,
      "manual-hosted-player-live-after-tick.png",
      playerClients[0].page
    );

    for (const client of playerClients) {
      client.productionSubmitCapture = captureGameplaySubmitPosts(client.page);
    }
    let previousProductionSetup = Promise.resolve(null);
    const productionTasks = manualProductionCases.map((productionCase) => {
      let releaseProductionSetup;
      const productionSetup = new Promise((resolve) => {
        releaseProductionSetup = resolve;
      });
      const waitForPreviousSetup = previousProductionSetup;
      previousProductionSetup = productionSetup;
      return (async () => {
        const previousSetup = await waitForPreviousSetup;
        if (previousSetup?.error) throw previousSetup.error;
        const client = playerClients[productionCase.clientIndex];
        expect(client.spawnDistrictId).toBe(productionCase.districtId);
        if (previousSetup?.stateVersion) {
          await waitForGameplayStateVersion(client.page, previousSetup.stateVersion);
        }
        try {
          const result = await exerciseHostedProductionLifecycleThroughVisibleUi({
            baseTestTimeoutMs: manualBaseTestTimeoutMs,
            ...productionCase,
            captureInfoScreenshotName:
              `manual-hosted-${productionCase.surfaceName}-info.png`,
            captureStartedScreenshotName:
              `manual-hosted-${productionCase.surfaceName}-production-started.png`,
            evidenceAttachmentName:
              `manual-hosted-${productionCase.surfaceName}-production-lifecycle.json`,
            expectedInitialPlayerOutput:
              startingPlayerState.materials[productionCase.resourceKey],
            expectedServerInstanceId: serverInstanceId,
            onWorkerPollingStarted: (setup) => releaseProductionSetup({
              stateVersion: setup.stateVersion,
              timing: setup.timing
            }),
            page: client.page,
            testInfo
          });
          await closeSurface(client.page, productionCase.surfaceName);
          return {
            clientIndex: productionCase.clientIndex,
            ...result.evidence
          };
        } catch (error) {
          releaseProductionSetup({ error });
          throw error;
        }
      })();
    });
    safeTrace.productionCommands = await Promise.all(productionTasks);
    safeTrace.productionSubmitPosts = assertExactProductionSubmitLifecycle(
      playerClients,
      safeTrace.productionCommands
    );

    safeTrace.visibleCommand = await runRestaurantActionThroughVisibleUi(
      playerClients[0].page,
      playerClients[0].spawnDistrictId
    );
    await playerClients[0].page.reload({ waitUntil: "load" });
    await waitForLiveGame(playerClients[0].page, serverInstanceId);
    const restored = await readTickState(playerClients[0].page);
    expect(restored.stateVersion).toBeGreaterThanOrEqual(
      safeTrace.visibleCommand.stateVersion
    );

    for (const client of playerClients) {
      await expectHostedUiParityClean(client.page, client.diagnostics);
    }

    await refreshAdmin(adminPage, serverInstanceId);
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
    for (const client of playerClients) {
      client.productionSubmitCapture?.stop();
    }
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
  await page.getByLabel("Kapacita").fill(String(manualServerCapacity));
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
      economyInfluence: Number(readModel?.player?.economy?.influence || 0),
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
  await expect.poll(
    async () => {
      const visibleTopbar = await readVisibleTopbar(page);
      return {
        ...visibleTopbar,
        influenceMatchesReadModel: visibleTopbar.influence === Math.floor(
          snapshot.economyInfluence
        )
      };
    },
    {
      message: "Visible topbar values must match the authoritative starting state.",
      timeout: 15_000,
      intervals: [100, 250, 500]
    }
  ).toEqual({
    cleanCash: startingPlayerState.cleanCash,
    dirtyCash: startingPlayerState.dirtyCash,
    influence: Math.floor(snapshot.economyInfluence),
    influenceMatchesReadModel: true
  });

  return {
    ...snapshot,
    visibleTopbar: await readVisibleTopbar(page)
  };
}

const readVisibleTopbar = (page) => page.evaluate(() => {
  const numericText = (selector) => {
    const text = document.querySelector(selector)?.textContent || "";
    const normalized = text.replace(/\s+/gu, "").replace(",", ".");
    const match = normalized.match(/-?\d+(?:\.\d+)?/u);
    return match ? Number(match[0]) : null;
  };
  return {
    cleanCash: numericText("[data-topbar-clean-money]"),
    dirtyCash: numericText("[data-topbar-dirty-money]"),
    influence: numericText("[data-topbar-influence]")
  };
});

async function attachScreenshot(testInfo, name, page) {
  await testInfo.attach(name, {
    body: await page.screenshot({ animations: "disabled", fullPage: false }),
    contentType: "image/png"
  });
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
  const responsePromise = waitForTerminalGameplaySubmit(page, (request) => (
    request?.command?.type === "run-building-action"
      && request.command.payload?.actionId === actionId
  ));
  await actionButton.click();
  const confirmation = page.locator(
    ".building-special-action-confirm:not([hidden]) "
      + ".building-special-action-confirm__button--confirm"
  );
  await expect(confirmation).toBeVisible();
  await confirmation.click();
  const submission = await responsePromise;
  const { body: payload, request, response } = submission;
  expect(response.status()).toBe(200);
  expect(request.command).toMatchObject({
    type: "run-building-action",
    payload: {
      districtId,
      actionId
    }
  });
  expect(payload.accepted).toBe(true);
  expect(submission.stateVersionConflicts.length, `${actionId} single OCC rebase`)
    .toBeLessThanOrEqual(1);
  if (submission.stateVersionConflicts.length === 1) {
    const staleRequest = submission.stateVersionConflicts[0].request;
    expect(request.command.id).not.toBe(staleRequest.command.id);
    expect(request.command.type).toBe(staleRequest.command.type);
    expect(request.command.payload).toEqual(staleRequest.command.payload);
    expect(request.expectedStateVersion).toBeGreaterThan(
      staleRequest.expectedStateVersion
    );
  }
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

async function refreshAdmin(page, serverInstanceId) {
  const refreshButton = page.locator("[data-admin-refresh]");
  await expect(refreshButton).toBeEnabled({ timeout: 30_000 });
  const selectedControlPlanePath = `/api/admin/control-plane/instances/${encodeURIComponent(
    serverInstanceId
  )}`;
  const selectedDetailPath = `/api/admin/instances/${encodeURIComponent(
    serverInstanceId
  )}`;
  const selectedControlPlaneResponse = page.waitForResponse((response) => (
    new URL(response.url()).pathname === selectedControlPlanePath
    && response.request().method() === "GET"
    && response.ok()
  ), { timeout: 30_000 });
  const selectedDetailResponse = page.waitForResponse((response) => (
    new URL(response.url()).pathname === selectedDetailPath
    && response.request().method() === "GET"
    && response.ok()
  ), { timeout: 30_000 });
  await refreshButton.click();
  await Promise.all([selectedControlPlaneResponse, selectedDetailResponse]);
  await expect(page.locator("[data-admin-refresh-state]"))
    .not.toHaveAttribute("data-state", "loading", { timeout: 30_000 });
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
    const response = await fetch(
      `/api/admin/control-plane/instances/${encodeURIComponent(
        expectedServerInstanceId
      )}`,
      {
        credentials: "same-origin",
        cache: "no-store"
      }
    );
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.data) return null;
    return payload.data.servers.find((server) => (
      server.serverInstanceId === expectedServerInstanceId
    )) || null;
  },
  serverInstanceId
);

async function collectThreeSampleTickEvidence({
  adminPage,
  districtId,
  playerPage,
  serverInstanceId
}) {
  const playerId = await playerPage.evaluate(() => (
    window.EmpireGameplaySliceClient?.getCurrentReadModel?.()?.player?.playerId || null
  ));
  expect(playerId, "The live gameplay projection must expose its authoritative player ID.")
    .toBeTruthy();

  const initialDetail = await readAdminInstanceDetail(adminPage, serverInstanceId);
  const canonicalTickRateMs = finiteNumberOrNull(
    initialDetail.runtimeHealth?.expectedTickRateMs
  );
  expect(
    canonicalTickRateMs,
    "The admin runtime projection must expose the canonical tick rate."
  ).toBeGreaterThan(0);
  await openDistrictById(playerPage, districtId);
  const visiblePopulationRate = playerPage.locator(
    "[data-district-popup-population]"
  );
  await expect(visiblePopulationRate).toHaveText("0 · žádný zdroj");
  await expect(visiblePopulationRate).toHaveAttribute(
    "data-population-source-summary",
    "Pasivní populace: 0 / tick · žádný zdroj v districtu"
  );

  const samples = [];
  for (let sampleIndex = 0; sampleIndex < 3; sampleIndex += 1) {
    const previousTick = samples.at(-1)?.currentTick ?? null;
    if (previousTick !== null) {
      await waitForRenderedPlayerTick(
        playerPage,
        previousTick + 1,
        canonicalTickRateMs
      );
    }
    let acceptedSample = null;
    await expect.poll(
      async () => {
        const candidate = await readAlignedTickSample({
          adminPage,
          districtId,
          playerId,
          playerPage,
          serverInstanceId
        });
        if (!isCompleteAlignedTickSample(candidate, previousTick)) {
          return false;
        }
        acceptedSample = candidate;
        return true;
      },
      {
        message: `Hosted tick evidence sample ${sampleIndex + 1} must align across player and admin projections.`,
        timeout: canonicalTickRateMs * 2,
        intervals: [100, 250, 500]
      }
    ).toBe(true);
    assertAlignedTickSample(
      acceptedSample,
      canonicalTickRateMs,
      districtId,
      serverInstanceId
    );
    samples.push(acceptedSample);
  }

  const materialIds = Object.keys(startingPlayerState.materials);
  const deltas = samples.slice(1).map((sample, index) => (
    createAuthoritativeIncomeTickDelta(
      samples[index],
      sample,
      materialIds
    )
  ));
  for (const delta of deltas) {
    expect(delta.tick).toBeGreaterThan(0);
    expect(delta.stateVersion).toBeGreaterThan(0);
    expect(delta.rateBasis).toMatchObject({
      projectionBasis: "next-authoritative-economy-tick",
      fromTick: delta.fromTick,
      toTick: delta.fromTick + 1,
      tickRateMs: canonicalTickRateMs,
      stableAcrossGap: true
    });
    expect(delta.expectedPerTick.cleanCash).toBeGreaterThan(0);
    expect(delta.expectedPerTick.dirtyCash).toBeGreaterThanOrEqual(0);
    expect(delta.expectedPerTick.population).toBe(0);
    expect(delta.populationSourceEvidence.sources).toEqual([]);
    expect(delta.populationSourceEvidence.summary)
      .toBe("Pasivní populace: 0 / tick · žádný zdroj v districtu");
    expect(delta.uiDisplayedPerHour.buildingCount).toBeGreaterThan(0);
    expect(delta.exactUiRateMatch).toEqual({
      cleanCash: true,
      dirtyCash: true,
      districtInfluence: true
    });
    expect(delta.exactNetMatch).toMatchObject({
      cleanCash: true,
      dirtyCash: true,
      population: true,
      districtHeat: true,
      districtInfluence: true
    });
    expect(Object.values(delta.exactNetMatch.materials).every(Boolean)).toBe(true);
    if (delta.rootTick !== null) {
      expect(delta.rootTick).toBe(delta.tick);
    }
    if (delta.lastSnapshotAtMs !== null) {
      expect(delta.lastSnapshotAtMs).toBeGreaterThanOrEqual(0);
    }
  }

  return {
    canonicalTickRateMs,
    samples,
    deltas
  };
}

async function readAlignedTickSample({
  adminPage,
  districtId,
  playerId,
  playerPage,
  serverInstanceId
}) {
  const adminBeforeObservedAt = new Date().toISOString();
  const adminBefore = await readAdminInstanceDetail(
    adminPage,
    serverInstanceId
  );
  const player = await readPlayerTickProjection(playerPage);
  const adminAfterObservedAt = new Date().toISOString();
  const adminAfter = await readAdminInstanceDetail(
    adminPage,
    serverInstanceId
  );
  const matchedAdminDetail = [
    ["before", adminBefore],
    ["after", adminAfter]
  ].find(([, candidate]) => adminDetailMatchesPlayer(candidate, player));
  const [matchedAdminObservation, detail] = matchedAdminDetail
    || ["none", adminAfter];
  const adminPlayer = detail.players.find((entry) => entry.playerId === playerId) || null;
  const adminDistrict = detail.districts.find((entry) => entry.districtId === districtId)
    || null;
  const adminRootTick = firstFiniteNumber(
    detail.rootTick,
    detail.summary?.rootTick,
    detail.snapshot?.rootTick,
    detail.runtimeHealth?.rootTick
  );
  return {
    observedAt: new Date().toISOString(),
    currentTick: finiteNumberOrNull(detail.snapshot?.tick),
    stateVersion: finiteNumberOrNull(detail.snapshot?.stateVersion),
    rootTick: firstFiniteNumber(player.rootTick, adminRootTick),
    player,
    admin: {
      bracket: {
        beforeObservedAt: adminBeforeObservedAt,
        afterObservedAt: adminAfterObservedAt,
        matchedObservation: matchedAdminObservation
      },
      serverInstanceId: detail.serverInstanceId || null,
      expectedTickRateMs: finiteNumberOrNull(
        detail.runtimeHealth?.expectedTickRateMs
      ),
      currentTick: finiteNumberOrNull(detail.summary?.currentTick),
      rootTick: adminRootTick,
      stateVersion: finiteNumberOrNull(detail.summary?.stateVersion),
      player: adminPlayer ? {
        cleanCash: finiteNumberOrNull(adminPlayer.cash),
        dirtyCash: finiteNumberOrNull(adminPlayer.dirtyCash),
        population: finiteNumberOrNull(adminPlayer.population)
      } : null,
      district: adminDistrict ? {
        districtId: adminDistrict.districtId,
        heat: finiteNumberOrNull(adminDistrict.heat),
        influence: finiteNumberOrNull(adminDistrict.influence)
      } : null,
      lastSnapshot: {
        snapshotId: detail.snapshot?.snapshotId || null,
        createdAt: detail.snapshot?.createdAt || null,
        lastSnapshotAt: detail.summary?.lastSnapshotAt || null,
        tick: finiteNumberOrNull(detail.snapshot?.tick),
        stateVersion: finiteNumberOrNull(detail.snapshot?.stateVersion)
      }
    }
  };
}

const adminDetailMatchesPlayer = (detail, player) => (
  finiteNumberOrNull(detail.snapshot?.tick) === player.currentTick
  && finiteNumberOrNull(detail.snapshot?.stateVersion)
    === player.stateVersion
);

const readAdminInstanceDetail = (page, serverInstanceId) => page.evaluate(
  async (expectedServerInstanceId) => {
    const response = await fetch(
      `/api/admin/instances/${encodeURIComponent(expectedServerInstanceId)}`,
      {
        credentials: "same-origin",
        cache: "no-store"
      }
    );
    const payload = await response.json();
    if (!response.ok || !payload.data) {
      throw new Error("Live admin instance detail is unavailable.");
    }
    return payload.data;
  },
  serverInstanceId
);

const readPlayerTickProjection = (page) => page.evaluate(() => {
  const readModel = window.EmpireGameplaySliceClient?.getCurrentReadModel?.()
    || window.empireStreetsGameplaySliceReadModel
    || null;
  const numberOrNull = (value) => {
    if (value === null || value === undefined || value === "") {
      return null;
    }
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  };
  const numericText = (selector) => {
    const text = document.querySelector(selector)?.textContent || "";
    const normalized = text.replace(/\s+/gu, "").replace(",", ".");
    const match = normalized.match(/-?\d+(?:\.\d+)?/u);
    return match ? Number(match[0]) : null;
  };
  const resourceBalances = Object.fromEntries(
    Object.entries(readModel?.player?.resourceBalances || {}).map(
      ([resourceKey, amount]) => [resourceKey, numberOrNull(amount)]
    )
  );
  const buildingPresentationRates = (readModel?.district?.buildings || []).map(
    (building) => ({
      buildingId: building.buildingId || null,
      buildingTypeId: building.buildingTypeId || null,
      status: building.status || null,
      passive: building.presentation?.passive || null
    })
  );
  const visiblePopulationElement = document.querySelector(
    "[data-district-popup-population]"
  );
  return {
    serverInstanceId: readModel?.server?.serverInstanceId || null,
    currentTick: numberOrNull(readModel?.server?.currentTick),
    stateVersion: numberOrNull(readModel?.server?.stateVersion),
    rootTick: numberOrNull(
      readModel?.server?.rootTick
        ?? readModel?.root?.tick
        ?? readModel?.rootTick
        ?? readModel?.tick
    ),
    playerId: readModel?.player?.playerId || null,
    resourceBalances,
    cleanCash: numberOrNull(resourceBalances.cash),
    dirtyCash: numberOrNull(
      resourceBalances["dirty-cash"]
    ),
    population: numberOrNull(
      resourceBalances.population
    ),
    economyPopulation: numberOrNull(readModel?.player?.economy?.population),
    influence: numberOrNull(readModel?.player?.economy?.influence),
    district: readModel?.district ? {
      districtId: readModel.district.districtId || null,
      heat: numberOrNull(readModel.district.heat),
      influence: numberOrNull(readModel.district.influence)
    } : null,
    economyRates: readModel?.economyRates || null,
    buildingPresentationRates,
    visibleTopbar: {
      cleanCash: numericText("[data-topbar-clean-money]"),
      dirtyCash: numericText("[data-topbar-dirty-money]"),
      influence: numericText("[data-topbar-influence]")
    },
    visiblePopulationRate: {
      label: String(visiblePopulationElement?.textContent || "").trim(),
      sourceSummary:
        visiblePopulationElement?.getAttribute(
          "data-population-source-summary"
        ) || ""
    },
    visibleDistrictRates: {
      cleanCash: numericText("[data-district-popup-clean]"),
      dirtyCash: numericText("[data-district-popup-dirty]"),
      influence: numericText("[data-district-popup-influence]")
    }
  };
});

function isCompleteAlignedTickSample(sample, previousTick) {
  const ticks = [
    sample.currentTick,
    sample.player.currentTick,
    sample.admin.currentTick,
    sample.admin.lastSnapshot.tick
  ];
  const stateVersions = [
    sample.stateVersion,
    sample.player.stateVersion,
    sample.admin.stateVersion,
    sample.admin.lastSnapshot.stateVersion
  ];
  return ticks.every(Number.isFinite)
    && ticks.every((tick) => tick === ticks[0])
    && stateVersions.every(Number.isFinite)
    && stateVersions.every((stateVersion) => stateVersion === stateVersions[0])
    && (previousTick === null || ticks[0] > previousTick)
    && Boolean(sample.admin.player)
    && Boolean(sample.admin.district)
    && [
      sample.player.cleanCash,
      sample.player.dirtyCash,
      sample.player.population,
      sample.player.economyPopulation,
      sample.player.influence,
      sample.player.district?.heat,
      sample.player.district?.influence,
      sample.admin.player?.cleanCash,
      sample.admin.player?.dirtyCash,
      sample.admin.player?.population,
      sample.admin.district?.heat,
      sample.admin.district?.influence
    ].every(Number.isFinite)
    && sample.player.serverInstanceId === sample.admin.serverInstanceId
    && sample.player.district?.districtId === sample.admin.district?.districtId
    && sample.player.visibleTopbar.cleanCash === Math.round(
      sample.player.cleanCash
    )
    && sample.player.visibleTopbar.dirtyCash === Math.round(
      sample.player.dirtyCash
    )
    && sample.player.visibleTopbar.influence === Math.floor(
      sample.player.influence
    )
    && sample.player.visiblePopulationRate.label === "0 · žádný zdroj"
    && sample.player.visiblePopulationRate.sourceSummary
      === "Pasivní populace: 0 / tick · žádný zdroj v districtu"
    && sample.player.visibleDistrictRates.cleanCash
      === sample.player.economyRates.selectedDistrict.cleanCashPerHour
    && sample.player.visibleDistrictRates.dirtyCash
      === sample.player.economyRates.selectedDistrict.dirtyCashPerHour
    && sample.player.visibleDistrictRates.influence
      === sample.player.economyRates.selectedDistrict.influencePerHour
    && isCompleteEconomyRateProjection(
      sample.player.economyRates,
      sample.currentTick,
      sample.player.district?.districtId
    );
}

function isCompleteEconomyRateProjection(rates, currentTick, districtId) {
  const trackedResourceKeys = [
    "cash",
    "dirty-cash",
    "population",
    ...Object.keys(startingPlayerState.materials)
  ];
  return Boolean(rates)
    && rates.basis === "next-authoritative-economy-tick"
    && Number.isFinite(rates.tickRateMs)
    && rates.tickRateMs > 0
    && rates.fromTick === currentTick
    && rates.toTick === currentTick + 1
    && rates.selectedDistrict?.districtId === districtId
    && trackedResourceKeys.every((resourceKey) => (
      Number.isFinite(rates.playerBalancePerTick?.[resourceKey])
      && Number.isFinite(rates.playerBalancePerHour?.[resourceKey])
    ))
    && [
      rates.selectedDistrict?.heatPerTick,
      rates.selectedDistrict?.influencePerTick,
      rates.selectedDistrict?.heatPerHour,
      rates.selectedDistrict?.influencePerHour,
      rates.selectedDistrict?.cleanCashPerTick,
      rates.selectedDistrict?.dirtyCashPerTick,
      rates.selectedDistrict?.cleanCashPerHour,
      rates.selectedDistrict?.dirtyCashPerHour
    ].every(Number.isFinite)
    && Array.isArray(rates.selectedDistrict?.passivePopulationSources)
    && typeof rates.selectedDistrict?.passivePopulationSourceSummary === "string";
}

function assertAlignedTickSample(
  sample,
  canonicalTickRateMs,
  districtId,
  serverInstanceId
) {
  expect(sample.player.serverInstanceId).toBe(serverInstanceId);
  expect(sample.admin.serverInstanceId).toBe(serverInstanceId);
  expect(sample.admin.expectedTickRateMs).toBe(canonicalTickRateMs);
  expect(sample.player.economyRates.tickRateMs).toBe(canonicalTickRateMs);
  expect(sample.player.economyRates.fromTick).toBe(sample.currentTick);
  expect(sample.player.economyRates.toTick).toBe(sample.currentTick + 1);
  expect(sample.player.currentTick).toBe(sample.currentTick);
  expect(sample.admin.currentTick).toBe(sample.currentTick);
  expect(sample.admin.lastSnapshot.tick).toBe(sample.currentTick);
  expect(sample.player.stateVersion).toBe(sample.stateVersion);
  expect(sample.admin.stateVersion).toBe(sample.stateVersion);
  expect(sample.admin.lastSnapshot.stateVersion).toBe(sample.stateVersion);
  expect(sample.admin.player.cleanCash).toBe(sample.player.cleanCash);
  expect(sample.admin.player.dirtyCash).toBe(sample.player.dirtyCash);
  expect(sample.admin.player.population).toBe(sample.player.population);
  expect(sample.player.economyPopulation).toBe(sample.player.population);
  expect(sample.player.district.districtId).toBe(districtId);
  expect(sample.admin.district.districtId).toBe(districtId);
  expect(sample.admin.district.heat).toBe(sample.player.district.heat);
  expect(sample.admin.district.influence).toBe(sample.player.district.influence);
  expect(sample.player.visibleTopbar.cleanCash)
    .toBe(Math.round(sample.player.cleanCash));
  expect(sample.player.visibleTopbar.dirtyCash)
    .toBe(Math.round(sample.player.dirtyCash));
  expect(sample.player.visibleTopbar.influence)
    .toBe(Math.floor(sample.player.influence));
  expect(sample.player.visiblePopulationRate).toEqual({
    label: "0 · žádný zdroj",
    sourceSummary:
      "Pasivní populace: 0 / tick · žádný zdroj v districtu"
  });
  expect(sample.player.visibleDistrictRates).toEqual({
    cleanCash:
      sample.player.economyRates.selectedDistrict.cleanCashPerHour,
    dirtyCash:
      sample.player.economyRates.selectedDistrict.dirtyCashPerHour,
    influence:
      sample.player.economyRates.selectedDistrict.influencePerHour
  });
  for (const rootTick of [
    sample.rootTick,
    sample.player.rootTick,
    sample.admin.rootTick
  ].filter(Number.isFinite)) {
    expect(rootTick).toBe(sample.currentTick);
  }
  if (
    sample.admin.lastSnapshot.createdAt
    && sample.admin.lastSnapshot.lastSnapshotAt
  ) {
    expect(sample.admin.lastSnapshot.createdAt)
      .toBe(sample.admin.lastSnapshot.lastSnapshotAt);
  }
}

async function waitForRenderedPlayerTick(
  playerPage,
  expectedTick,
  canonicalTickRateMs
) {
  await expect.poll(
    () => playerPage.evaluate(() => Number(
      window.EmpireGameplaySliceClient?.getCurrentReadModel?.()?.server?.currentTick
        ?? -1
    )),
    {
      message: `Visible hosted client must render authoritative tick ${expectedTick}.`,
      timeout: canonicalTickRateMs * 4,
      intervals: [100, 250, 500, 1_000]
    }
  ).toBeGreaterThanOrEqual(expectedTick);
}

const firstFiniteNumber = (...values) => (
  values.map(finiteNumberOrNull).find(Number.isFinite) ?? null
);

const finiteNumberOrNull = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

async function waitForGameplayStateVersion(page, minimumStateVersion) {
  await expect.poll(
    () => page.evaluate(() => Number(
      window.EmpireGameplaySliceClient?.getCurrentReadModel?.()?.server?.stateVersion
        ?? -1
    )),
    {
      message: `Visible client must catch up to server state ${minimumStateVersion}.`,
      timeout: 30_000,
      intervals: [100, 250, 500, 1_000]
    }
  ).toBeGreaterThanOrEqual(minimumStateVersion);
}

function captureGameplaySubmitPosts(page) {
  const posts = [];
  const listener = (request) => {
    if (
      new URL(request.url()).pathname !== "/api/gameplay-slice/submit"
      || request.method() !== "POST"
    ) {
      return;
    }
    let body = null;
    try {
      body = request.postDataJSON();
    } catch {
      body = null;
    }
    posts.push({
      commandId: body?.command?.id || null,
      commandType: body?.command?.type || null,
      buildingId: body?.command?.payload?.buildingId || null,
      districtId: body?.command?.payload?.districtId || null,
      quantity: finiteNumberOrNull(body?.command?.payload?.quantity),
      recipeId: body?.command?.payload?.recipeId || null,
      resourceKey: body?.command?.payload?.resourceKey || null
    });
  };
  page.on("request", listener);
  return {
    posts,
    stop: () => page.off("request", listener)
  };
}

function assertExactProductionSubmitLifecycle(clients, lifecycles) {
  const posts = [];
  for (const lifecycle of lifecycles) {
    const expectedPosts = [
      lifecycle.commands.initialStart,
      lifecycle.commands.cancelWaiting,
      lifecycle.commands.newStart,
      lifecycle.commands.collect
    ].map((summary) => ({
      commandId: summary.command.commandId,
      commandType: summary.command.type,
      buildingId: summary.command.payload.buildingId || null,
      districtId: summary.command.payload.districtId || null,
      quantity: finiteNumberOrNull(summary.command.payload.quantity),
      recipeId: summary.command.payload.recipeId || null,
      resourceKey: summary.command.payload.resourceKey || null
    }));
    expect(
      clients[lifecycle.clientIndex].productionSubmitCapture.posts,
      `${lifecycle.identity.buildingTypeId} must emit only its four visible lifecycle submits`
    ).toEqual(expectedPosts);
    posts.push(...expectedPosts.map((post) => ({
      clientIndex: lifecycle.clientIndex,
      ...post
    })));
  }
  expect(posts).toHaveLength(manualProductionCases.length * 4);
  return posts;
}

const readTickState = async (page) => {
  const state = await page.evaluate(() => {
    const readModel = window.EmpireGameplaySliceClient?.getCurrentReadModel?.()
      || window.empireStreetsGameplaySliceReadModel
      || null;
    return {
      currentTick: Number(readModel?.server?.currentTick || 0),
      stateVersion: Number(readModel?.server?.stateVersion || 0),
      cash: Number(readModel?.player?.resourceBalances?.cash || 0),
      dirtyCash: Number(readModel?.player?.resourceBalances?.["dirty-cash"] || 0),
      population: Number(readModel?.player?.resourceBalances?.population || 0),
      influence: Number(readModel?.player?.economy?.influence || 0)
    };
  });
  return {
    ...state,
    visibleTopbar: await readVisibleTopbar(page)
  };
};

function parseStartingPlayerState(value) {
  if (!value) return null;
  const parsed = JSON.parse(value);
  const materialValues = Object.values(parsed?.materials || {});
  if (
    !Number.isFinite(parsed?.cleanCash)
    || !Number.isFinite(parsed?.dirtyCash)
    || !Number.isFinite(parsed?.population)
    || parsed?.spySlots !== 2
    || !parsed?.materials
    || Object.keys(parsed.materials).length !== 21
    || !materialValues.every(Number.isFinite)
    || new Set(materialValues).size !== materialValues.length
    || !materialValues.includes(0)
  ) {
    throw new Error(
      "Manual hosted starting state must contain 21 distinct canonical material values including zero."
    );
  }
  return parsed;
}
