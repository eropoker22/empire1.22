import { expect, test } from "@playwright/test";
import {
  attachE2eDiagnostics,
  assertNoRuntimeErrors,
  clickDistrictById,
  clearStorageOnBoot,
  createRuntimeErrorMonitor,
  expectDistrictCanvasPainted,
  closeDistrictPopup,
  expectNoDistrictActionModals,
  openGamePage,
  openDistrictPopup,
  openLoginPage,
  selectLobbyDistrict,
  waitForMapReady
} from "./helpers/empireSmokeHelpers.js";
const CANONICAL_FREE_SERVER_ID = "instance:free:eu-central:public-1";
const DISTRICT_ACTION_SELECTOR = [
  "button[data-attack-target-id]:not([disabled])",
  "button[data-occupy-target-id]:not([disabled])",
  "button[data-rob-target-id]:not([disabled])",
  "button[data-heist-target-id]:not([disabled])",
  "button[data-spy-target-id]:not([disabled])",
  "button[data-place-defense]:not([disabled])",
  "button[data-remove-defense]:not([disabled])",
  "button[data-place-trap]:not([disabled])",
  "button[data-collect-building-id]:not([disabled])",
  "button[data-building-action-building-id][data-building-action-id]:not([disabled])",
  "button[data-craft-building-id][data-craft-recipe-id]:not([disabled])"
].join(", ");
const DISTRICT_ID_CANDIDATES = [27, 28, 26, 29, 40, 41, 42, 80, 81, 82, 120, 121, 122, 1, 2, 160, 161];

async function postGameplaySliceRequest(page, route, requestBody) {
  return page.evaluate(async ({ route, requestBody }) => {
    const response = await fetch(`/api/gameplay-slice/${route}`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      credentials: "same-origin",
      body: JSON.stringify(requestBody)
    });
    const responseText = await response.text();
    let payload = null;
    try {
      payload = responseText ? JSON.parse(responseText) : null;
    } catch (_error) {
      payload = null;
    }

    return {
      ok: response.ok,
      status: response.status,
      payload
    };
  }, {
    route,
    requestBody
  });
}

test.afterEach(async ({ page }, testInfo) => {
  await attachE2eDiagnostics(page, testInfo);
});

async function loginAsGuest(page, name = "Smoke Guest", gang = "Smoke Crew") {
  await clearStorageOnBoot(page);
  await openLoginPage(page);
  await page.locator("#guest-username").fill(name);
  await page.getByPlaceholder("Ghost Crew").fill(gang);
  await Promise.all([
    page.waitForURL(/\/pages\/lobby\.html\?mode=free$/),
    page.getByTestId("guest-login-button").click()
  ]);
  await expect(page.getByTestId("lobby-page")).toBeVisible();
}

async function chooseFactionsAndEnterGame(page) {
  await expect(page.getByTestId("faction-page")).toBeVisible();
  await expect(page.locator("[data-gang-color]").first()).toBeVisible();
  await page.evaluate(() => document.querySelector("[data-faction-id='mafian']")?.click());
  await page.locator("[data-gang-color]").first().click({ force: true });
  await page.locator("[data-avatar]").first().click({ force: true });
  const avatarLightbox = page.getByTestId("avatar-lightbox");
  if (await avatarLightbox.isVisible().catch(() => false)) {
    await page.getByRole("button", { name: "Potvrdit výběr avatara" }).click();
  }
  await expect(page.locator("#go-game")).toHaveAttribute("aria-disabled", "false");
  await expect(page.getByTestId("continue-to-game")).not.toHaveClass(/faction-link--disabled/);

  const continueToGame = page.getByTestId("continue-to-game");
  await continueToGame.click({ force: true });

  const enteredRoute = await Promise.race([
    page.waitForURL(/\/pages\/(faction|game)\.html(?:\?|$)/u, { timeout: 30_000 }).then(() => page.url()),
    page.waitForTimeout(15_000).then(() => page.url())
  ]);
  if (enteredRoute.includes("/pages/faction.html")) {
    await page.goto("/pages/game.html", { waitUntil: "load" });
  }
}

async function finishSpawnSelectionIfNeeded(page) {
  const spawnPanel = page.locator("[data-feature='spawn-selection']");
  if (!(await spawnPanel.isVisible({ timeout: 1_000 }).catch(() => false))) {
    return null;
  }

  const submitResponsePromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return response.request().method() === "POST" && /\/api\/gameplay-slice\/submit$/u.test(url.pathname);
  });
  const availableButtons = spawnPanel.locator("button[data-select-spawn-district-id]");
  const count = await availableButtons.count();
  let selected = false;

  for (let index = 0; index < count; index += 1) {
    const candidate = availableButtons.nth(index);
    if (await candidate.isEnabled().catch(() => false)) {
      await candidate.click();
      selected = true;
      break;
    }
  }

  expect(selected).toBe(true);
  await expect(spawnPanel).toBeHidden({ timeout: 10_000 });
  const submitResponse = await submitResponsePromise;
  expect(submitResponse.ok()).toBe(true);
  const submitPayload = await submitResponse.json();
  expect(submitPayload).toHaveProperty("readModel");
  expect(submitPayload).toMatchObject({
    accepted: true,
    errors: expect.any(Array),
    readModel: expect.any(Object)
  });
  expect(submitPayload.readModel.server?.stateVersion, "Server state version should be present after spawn selection")
    .toEqual(expect.any(Number));
  return submitPayload;
}

async function openFreeGameAndLoadBootstrap(page, options = {}) {
  const bootstrapLoadPromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return response.request().method() === "POST"
      && /\/api\/gameplay-slice\/(?:load|join)$/u.test(url.pathname);
  });

  await openGameFromFlow(page, options);
  await waitForMapReady(page);
  await waitForMapReady(page);
  await expect(page.getByTestId("district-canvas")).toBeVisible();
  await expectDistrictCanvasPainted(page);

  const bootstrapLoadResponse = await bootstrapLoadPromise;
  const bootstrapPayload = await bootstrapLoadResponse.json();

  return {
    bootstrapLoadResponse,
    bootstrapPayload,
    bootstrapReadModel: bootstrapPayload?.readModel ?? null
  };
}

function createSelectSpawnDistrictCommand(input) {
  return {
    id: input.commandId,
    type: "select-spawn-district",
    mode: input.mode,
    playerId: input.playerId,
    serverInstanceId: input.serverInstanceId,
    issuedAt: input.issuedAt,
    payload: {
      districtId: input.districtId
    },
    clientRequestId: null
  };
}

function createAttackDistrictCommand(input) {
  return {
    id: input.commandId,
    type: "attack-district",
    mode: input.mode,
    playerId: input.playerId,
    serverInstanceId: input.serverInstanceId,
    issuedAt: input.issuedAt,
    payload: {
      districtId: input.targetDistrictId,
      sourceDistrictId: input.sourceDistrictId
    },
    clientRequestId: null
  };
}

function createRobDistrictCommand(input) {
  return {
    id: input.commandId,
    type: "rob-district",
    mode: input.mode,
    playerId: input.playerId,
    serverInstanceId: input.serverInstanceId,
    issuedAt: input.issuedAt,
    payload: {
      targetDistrictId: input.targetDistrictId,
      sourceDistrictId: input.sourceDistrictId,
      expectedTargetVersion: input.expectedTargetVersion ?? 0,
      expectedSourceVersion: input.expectedSourceVersion ?? 0
    },
    clientRequestId: null
  };
}

function createHeistDistrictCommand(input) {
  return {
    id: input.commandId,
    type: "heist-district",
    mode: input.mode,
    playerId: input.playerId,
    serverInstanceId: input.serverInstanceId,
    issuedAt: input.issuedAt,
    payload: {
      targetDistrictId: input.targetDistrictId,
      sourceDistrictId: input.sourceDistrictId,
      style: input.style ?? "balanced",
      gangMembersSent: input.gangMembersSent ?? 1,
      expectedTargetVersion: input.expectedTargetVersion ?? 0,
      expectedSourceVersion: input.expectedSourceVersion ?? 0
    },
    clientRequestId: null
  };
}

function createSpyDistrictCommand(input) {
  return {
    id: input.commandId,
    type: "spy-district",
    mode: input.mode,
    playerId: input.playerId,
    serverInstanceId: input.serverInstanceId,
    issuedAt: input.issuedAt,
    payload: {
      districtId: input.targetDistrictId,
      sourceDistrictId: input.sourceDistrictId
    },
    clientRequestId: null
  };
}

function pickOwnedDistrictId(readModel) {
  const playerId = readModel?.player?.playerId;
  const sourceIds = new Set();

  if (readModel?.player?.homeDistrictId) {
    sourceIds.add(String(readModel.player.homeDistrictId));
  }

  for (const summary of readModel?.districts ?? []) {
    if (summary?.isOwnedByPlayer || (playerId && summary?.ownerPlayerId === playerId)) {
      sourceIds.add(String(summary.districtId));
    }
  }

  if (readModel?.district?.districtId) {
    sourceIds.add(String(readModel.district.districtId));
  }

  return Array.from(sourceIds);
}

async function submitFallbackAction(page, baseReadModel) {
  const serverInstanceId = baseReadModel?.server?.serverInstanceId
    ?? baseReadModel?.player?.instanceId
    ?? CANONICAL_FREE_SERVER_ID;
  const playerId = baseReadModel?.player?.playerId ?? null;
  const mode = baseReadModel?.mode?.mode ?? "free";
  const playerSourceIds = pickOwnedDistrictId(baseReadModel);
  const fallbackTargetCandidate = (baseReadModel?.districts ?? [])
    .find((district) => district?.ownerPlayerId !== playerId)?.districtId
    ?? playerSourceIds[0];

  for (const sourceDistrictId of playerSourceIds) {
    const districtLoad = sourceDistrictId === baseReadModel?.district?.districtId
      ? baseReadModel
      : (await postGameplaySliceRequest(page, "load", {
        serverInstanceId,
        districtId: sourceDistrictId,
        playerId
      })).payload?.readModel;

    if (!districtLoad?.district) {
      continue;
    }

    const district = districtLoad.district;
    const commandBase = {
      mode,
      playerId,
      serverInstanceId,
      issuedAt: new Date().toISOString(),
      sourceDistrictId: district.districtId
    };

    if (district.attackTargets?.some((target) => target?.enabled)) {
      const target = district.attackTargets.find((entry) => entry?.enabled);
      const command = createAttackDistrictCommand({
        ...commandBase,
        commandId: `smoke-action:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`,
        targetDistrictId: target.districtId
      });
      return postGameplaySliceRequest(page, "submit", {
        command,
        focusDistrictId: district.districtId,
        expectedStateVersion: districtLoad.server?.stateVersion ?? null
      });
    }

    if (district.robTargets?.some((target) => target?.enabled)) {
      const target = district.robTargets.find((entry) => entry?.enabled);
      const command = createRobDistrictCommand({
        ...commandBase,
        commandId: `smoke-action:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`,
        targetDistrictId: target.districtId,
        expectedTargetVersion: target.expectedTargetVersion,
        expectedSourceVersion: target.expectedSourceVersion
      });
      return postGameplaySliceRequest(page, "submit", {
        command,
        focusDistrictId: district.districtId,
        expectedStateVersion: districtLoad.server?.stateVersion ?? null
      });
    }

    if (district.heistTargets?.some((target) => target?.enabled)) {
      const target = district.heistTargets.find((entry) => entry?.enabled);
      const style = target.styles?.[0] ?? { style: "balanced", defaultGangMembersSent: 1 };
      const command = createHeistDistrictCommand({
        ...commandBase,
        commandId: `smoke-action:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`,
        targetDistrictId: target.districtId,
        style: style.style,
        gangMembersSent: style.defaultGangMembersSent,
        expectedTargetVersion: target.expectedTargetVersion,
        expectedSourceVersion: target.expectedSourceVersion
      });
      return postGameplaySliceRequest(page, "submit", {
        command,
        focusDistrictId: district.districtId,
        expectedStateVersion: districtLoad.server?.stateVersion ?? null
      });
    }

    if (district.spyTargets?.some((target) => target?.enabled)) {
      const target = district.spyTargets.find((entry) => entry?.enabled);
      const command = createSpyDistrictCommand({
        ...commandBase,
        commandId: `smoke-action:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`,
        targetDistrictId: target.districtId
      });
      return postGameplaySliceRequest(page, "submit", {
        command,
        focusDistrictId: district.districtId,
        expectedStateVersion: districtLoad.server?.stateVersion ?? null
      });
    }
  }

  if (!fallbackTargetCandidate || !playerSourceIds.length) {
    throw new Error("Could not derive any server action candidate from gameplay read-model.");
  }

  const command = createAttackDistrictCommand({
    commandId: `smoke-action:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`,
    mode,
    playerId,
    serverInstanceId,
    issuedAt: new Date().toISOString(),
    sourceDistrictId: playerSourceIds[0],
    targetDistrictId: fallbackTargetCandidate
  });

  return postGameplaySliceRequest(page, "submit", {
    command,
    focusDistrictId: playerSourceIds[0],
    expectedStateVersion: baseReadModel?.server?.stateVersion ?? null
  });
}

async function openGameFromFlow(page, options = {}) {
  await loginAsGuest(
    page,
    options.name ?? "Smoke Guest",
    options.gang ?? "Smoke Crew"
  );

  const freeCard = page.getByTestId(`server-card-${CANONICAL_FREE_SERVER_ID}`);
  await expect(page.locator("[data-recommended-server='true']")).toHaveAttribute("data-server-mode", "free");
  await expect(freeCard).toBeVisible();
  await expect(freeCard).not.toHaveClass(/is-locked|is-full|is-offline/);

  await freeCard.click();
  await selectLobbyDistrict(page);
  await expect(page.getByTestId("enter-selected-server")).toBeEnabled();
  await page.getByTestId("enter-selected-server").click();

  const enteredRoute = await Promise.race([
    page.waitForURL(/\/pages\/(faction|game)\.html$/u, { timeout: 20_000 })
      .then(() => page.url()),
    page.waitForTimeout(20_000).then(() => page.url())
  ]);

  if (enteredRoute.includes("/pages/faction.html") || await page.getByTestId("faction-page").isVisible().catch(() => false)) {
    await chooseFactionsAndEnterGame(page);
    return;
  }

  await expect(page).toHaveURL(/\/pages\/game\.html$/u, { timeout: 5_000 });
}

async function findDistrictWithServerAction(page) {
  for (const districtId of DISTRICT_ID_CANDIDATES) {
    try {
      await openDistrictPopup(page, { districtId });
      const actionLocator = page.locator(DISTRICT_ACTION_SELECTOR);
      const actionCount = await actionLocator.count();
      if (actionCount > 0) {
        return {
          districtId,
          action: actionLocator.first()
        };
      }
      if (!page.isClosed() && await page.getByTestId("district-popup-card").isVisible().catch(() => false)) {
        await closeDistrictPopup(page, "button");
      }
    } catch (_error) {
      if (!page.isClosed()) {
        await expect(page.getByTestId("district-popup-card")).toBeHidden().catch(() => void 0);
      }
    }
  }

  throw new Error("No district with enabled server action was found in smoke candidates.");
}

test.describe("main game browser protection", () => {
  test.setTimeout(360_000);

  test("boots map and exercises district popup controls", async ({ page }) => {
    const errors = createRuntimeErrorMonitor(page);

    await openGamePage(page);
    await expect(page.getByTestId("district-canvas")).toBeVisible();
    await expect(page.getByTestId("district-popup")).toBeHidden();
    await expect(page.getByTestId("district-actions")).toHaveCount(1);

    await openDistrictPopup(page, { districtId: 27 });
    await expect(page.locator("[data-district-popup-title]")).not.toHaveText("");
    await expect(page.locator("[data-district-popup-buildings]")).toBeVisible();
    await expect(page.getByTestId("district-actions")).toBeVisible();
    await expectNoDistrictActionModals(page);
    await closeDistrictPopup(page, "button");
    await expectNoDistrictActionModals(page);

    await assertNoRuntimeErrors(errors);
  });

  test("opens atmosphere window from a fresh district popup", async ({ page }) => {
    const errors = createRuntimeErrorMonitor(page);

    await openGamePage(page);
    await openDistrictPopup(page, { districtId: 27 });

    const atmosphereTrigger = page.getByTestId("district-atmosphere-trigger");
    const atmosphereWindow = page.getByTestId("district-atmosphere-window");

    await expect(atmosphereTrigger).toBeVisible();
    await atmosphereTrigger.click();
    await expect(atmosphereWindow).toBeVisible();

    await assertNoRuntimeErrors(errors);
  });

  test("completes spawn selection through the UI on a fresh Free flow", async ({ page }) => {
    const errors = createRuntimeErrorMonitor(page);
    const runId = Date.now().toString(36);

    const { bootstrapReadModel } = await openFreeGameAndLoadBootstrap(page, {
      name: `Spawn Smoke ${runId}`,
      gang: `Spawn Crew ${runId}`
    });
    expect(bootstrapReadModel?.spawnSelection?.status).toBe("awaiting_spawn_selection");

    const spawnPanel = page.locator("[data-feature='spawn-selection']");
    if (process.env.SMOKE_DEBUG === "1") {
      const spawnDebug = await page.evaluate(() => {
        const panels = Array.from(document.querySelectorAll("[data-feature='spawn-selection']"));
        return {
          panelCount: panels.length,
          panels: panels.map((panel) => {
            const shell = panel.closest(".side-panel-shell");
            const panelStyle = panel instanceof HTMLElement ? window.getComputedStyle(panel) : null;
            const shellStyle = shell instanceof HTMLElement ? window.getComputedStyle(shell) : null;
            const panelRect = panel instanceof HTMLElement ? panel.getBoundingClientRect() : null;
            const shellRect = shell instanceof HTMLElement ? shell.getBoundingClientRect() : null;
            return {
              panelHiddenAttribute: panel.hasAttribute("hidden"),
              panelClassName: panel instanceof HTMLElement ? panel.className : null,
              panelDisplay: panelStyle?.display ?? null,
              panelVisibility: panelStyle?.visibility ?? null,
              panelOpacity: panelStyle?.opacity ?? null,
              panelRect,
              shellHiddenAttribute: shell?.hasAttribute("hidden") ?? false,
              shellClassName: shell instanceof HTMLElement ? shell.className : null,
              shellDataPanel: shell instanceof HTMLElement ? shell.getAttribute("data-panel") : null,
              shellDisplay: shellStyle?.display ?? null,
              shellVisibility: shellStyle?.visibility ?? null,
              shellOpacity: shellStyle?.opacity ?? null,
              shellRect
            };
          })
        };
      });
      console.log("spawnUi.debug", JSON.stringify(spawnDebug));
    }
    await expect(spawnPanel).toBeVisible();

    const spawnPayload = await finishSpawnSelectionIfNeeded(page);
    expect(spawnPayload).not.toBeNull();
    expect(spawnPayload?.accepted).toBe(true);
    expect(spawnPayload?.readModel?.player?.homeDistrictId).toBeTruthy();
    expect(spawnPayload?.readModel?.spawnSelection?.status).not.toBe("awaiting_spawn_selection");

    await assertNoRuntimeErrors(errors);
  });

  test("executes a minimal closed-alpha Free flow and submits one gameplay action", async ({ page }) => {
    const errors = createRuntimeErrorMonitor(page);
    const runId = Date.now().toString(36);

    let { bootstrapReadModel } = await openFreeGameAndLoadBootstrap(page, {
      name: `Action Smoke ${runId}`,
      gang: `Action Crew ${runId}`
    });

    if (bootstrapReadModel?.spawnSelection?.status === "awaiting_spawn_selection") {
      const spawnPayload = await finishSpawnSelectionIfNeeded(page);
      if (spawnPayload) {
        bootstrapReadModel = spawnPayload.readModel ?? bootstrapReadModel;
      } else {
        const spawnDistrict = bootstrapReadModel.spawnSelection?.districts?.find((district) => district?.status === "available");
        if (!spawnDistrict) {
          throw new Error("No available spawn district available in authoritative bootstrap state.");
        }

        const spawnSubmit = await postGameplaySliceRequest(page, "submit", {
          command: createSelectSpawnDistrictCommand({
            commandId: `smoke-spawn:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`,
            mode: bootstrapReadModel?.mode?.mode ?? "free",
            playerId: bootstrapReadModel?.player?.playerId ?? null,
            serverInstanceId: bootstrapReadModel?.server?.serverInstanceId ?? CANONICAL_FREE_SERVER_ID,
            issuedAt: new Date().toISOString(),
            districtId: spawnDistrict.districtId
          }),
          focusDistrictId: spawnDistrict.districtId,
          expectedStateVersion: bootstrapReadModel?.server?.stateVersion ?? null
        });
        expect(spawnSubmit.ok).toBe(true);
        expect(spawnSubmit.status).toBeLessThan(400);
        if (process.env.SMOKE_DEBUG === "1") {
          console.log("spawnSubmit.accepted", JSON.stringify(spawnSubmit?.payload?.accepted));
          console.log("spawnSubmit.errors", JSON.stringify(spawnSubmit?.payload?.errors ?? []));
        }
        expect(spawnSubmit.payload).toMatchObject({
          accepted: true,
          readModel: expect.any(Object),
          errors: expect.any(Array)
        });
        bootstrapReadModel = spawnSubmit.payload.readModel ?? bootstrapReadModel;
        expect(bootstrapReadModel?.server?.stateVersion).toEqual(expect.any(Number));
      }
    }

    const fallbackSubmit = await submitFallbackAction(page, bootstrapReadModel);
    expect(fallbackSubmit.ok).toBe(true);
    expect(fallbackSubmit.status).toBeLessThan(400);
    if (process.env.SMOKE_DEBUG === "1") {
      console.log("fallbackSubmit.accepted", JSON.stringify(fallbackSubmit.payload?.accepted));
      console.log("fallbackSubmit.errors", JSON.stringify(fallbackSubmit.payload?.errors ?? []));
    }
    expect(fallbackSubmit.payload).toMatchObject({
      accepted: expect.any(Boolean),
      errors: expect.any(Array),
      readModel: expect.any(Object)
    });
    if (fallbackSubmit.payload?.readModel?.server?.stateVersion != null) {
      expect(fallbackSubmit.payload.readModel.server.stateVersion).toBeGreaterThanOrEqual(
        bootstrapReadModel?.server?.stateVersion ?? 0
      );
    }
    if (!fallbackSubmit.payload.accepted) {
      const firstReason = fallbackSubmit.payload.errors?.[0]?.code;
      expect(firstReason).not.toBe("AWAITING_SPAWN_SELECTION");
    }

    await clickDistrictById(page, DISTRICT_ID_CANDIDATES[0]);
    await expect(page.getByTestId("district-popup-card")).toBeVisible();
    await assertNoRuntimeErrors(errors);
  });
});
