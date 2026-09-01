import { expect, test } from "@playwright/test";
import {
  expectHostedUiParityClean,
  loginAndResumeHostedUiParityGame,
  waitForLiveGame
} from "./helpers/hostedUiParityEntry.js";
import { waitForTerminalGameplaySubmit } from "./helpers/gameplaySubmitResponse.js";

const hostedEnabled = process.env.EMPIRE_HOSTED_UI_PARITY_E2E === "1";
const serverInstanceId = process.env.EMPIRE_UI_PARITY_SERVER_ID || "";
const identities = parseIdentities(process.env.EMPIRE_HOSTED_BOOTSTRAP_IDENTITIES_JSON);

test.describe("manual hosted district actions through visible UI", () => {
  test.skip(
    !hostedEnabled || !serverInstanceId || identities.length !== 3,
    "Visible district action coverage requires the guarded three-player hosted harness."
  );
  // The longest Free-mode operation can span 142 canonical 10-second ticks
  // from the seeded state, so the previous 15-minute limit expired before
  // the authoritative report was due. Keep this below the 30-minute harness cap.
  test.setTimeout(28 * 60_000);

  test("clicks map, action controls and confirmations for all P0 district actions", async ({ browser }) => {
    const clients = [];
    try {
      for (const identity of identities) {
        const context = await browser.newContext({
          baseURL: process.env.PLAYWRIGHT_E2E_BASE_URL,
          viewport: { width: 1440, height: 900 }
        });
        const page = await context.newPage();
        page.setDefaultTimeout(20_000);
        const entry = await loginAndResumeHostedUiParityGame(page, identity);
        clients.push({ context, page, diagnostics: entry.diagnostics, identity });
      }

      const [creator, target, hunter] = clients;
      const spy = await runSpyThroughVisibleUi(creator.page, "district:25");
      const rob = await runRobThroughVisibleUi(creator.page, "district:24");
      const heist = await runHeistThroughVisibleUi(target.page, "district:4");
      const attack = await runAttackThroughVisibleUi(hunter.page, "district:2");

      await waitForRenderedStateVersionAtLeast(
        creator.page,
        rob.body.readModel.server.stateVersion
      );
      const occupy = await runOccupyThroughVisibleUi(creator.page, "district:6");

      expect(spy.request.command.payload.sourceDistrictId).toBe(spy.projection.sourceDistrictId);
      expect(rob.request.command.payload.sourceDistrictId).toBe(rob.projection.sourceDistrictId);
      expect(heist.request.command.payload.sourceDistrictId).toBe(heist.projection.sourceDistrictId);
      expect(attack.request.command.payload.sourceDistrictId).toBe(attack.projection.sourceDistrictId);
      expect(occupy.request.command.payload.sourceDistrictId).toBe(occupy.projection.sourceDistrictId);

      const [creatorCompletions, heistCompletion, attackCompletion] = await Promise.all([
        (async () => [
          await waitForDeferredReport(creator.page, spy),
          await waitForDeferredReport(creator.page, rob),
          await waitForDeferredReport(creator.page, occupy)
        ])(),
        waitForDeferredReport(target.page, heist),
        waitForDeferredReport(hunter.page, attack)
      ]);
      const occupyCompletion = creatorCompletions[2];
      expect(heistCompletion.report.tick).toBeGreaterThanOrEqual(heist.pendingEffect.expiresAtTick);
      expect(attackCompletion.report.tick).toBeGreaterThanOrEqual(attack.pendingEffect.expiresAtTick);
      if (occupyCompletion.report.districtCaptured) {
        expect(occupyCompletion.readModel.district.ownerPlayerId)
          .toBe(occupyCompletion.readModel.player.playerId);
      }

      for (const client of clients) {
        await expectHostedUiParityClean(client.page, client.diagnostics);
      }
      expect(creator.diagnostics.submitRequests.map((entry) => entry.command.type))
        .toEqual(expect.arrayContaining(["spy-district", "rob-district", "occupy-district"]));
      expect(target.diagnostics.submitRequests.map((entry) => entry.command.type))
        .toContain("heist-district");
      expect(hunter.diagnostics.submitRequests.map((entry) => entry.command.type))
        .toContain("attack-district");
    } finally {
      await Promise.allSettled(clients.map((client) => client.context.close()));
    }
  });
});

async function runSpyThroughVisibleUi(page, districtId) {
  const projection = await openActionTargetFromMap(page, districtId, "spy");
  const action = visibleDistrictAction(page, districtId, "spy");
  await expect(action).toBeEnabled();
  await action.click();
  const popup = page.locator("[data-spy-confirm-popup]");
  await expect(popup).toBeVisible();
  const result = await clickAndReadTypedSubmit(
    page,
    "spy-district",
    popup.locator("[data-spy-confirm-button]")
  );
  expect(result.request.command.payload).toMatchObject({
    districtId,
    sourceDistrictId: projection.sourceDistrictId
  });
  const pendingEffect = assertAcceptedPendingOperation(result, "spy-district", districtId);
  return { ...result, pendingEffect, projection };
}

async function runRobThroughVisibleUi(page, districtId) {
  const projection = await openActionTargetFromMap(page, districtId, "rob");
  const action = visibleDistrictAction(page, districtId, "rob");
  await expect(action).toBeEnabled();
  await action.click();
  const setup = page.locator("[data-robbery-setup-popup]");
  await expect(setup).toBeVisible();
  const members = setup.locator("[data-robbery-member-input]");
  await expect(members).toBeDisabled();
  await expect(members).toHaveValue("1");
  const prepare = setup.locator("[data-robbery-confirm]");
  await expect(prepare).toBeEnabled();
  await prepare.click();
  const confirmation = page.locator("[data-robbery-confirm-popup]");
  await expect(confirmation).toBeVisible();
  const result = await clickAndReadTypedSubmit(
    page,
    "rob-district",
    confirmation.locator("[data-robbery-confirm-button]")
  );
  expect(result.request.command.payload).toMatchObject({
    targetDistrictId: districtId,
    sourceDistrictId: projection.sourceDistrictId,
    expectedConflictRevision: projection.expectedConflictRevision,
    expectedLootPoolRevision: projection.expectedLootPoolRevision
  });
  const pendingEffect = assertAcceptedPendingOperation(result, "rob-district", districtId);
  return { ...result, pendingEffect, projection };
}

async function runHeistThroughVisibleUi(page, districtId) {
  const projection = await openActionTargetFromMap(page, districtId, "heist");
  const action = visibleDistrictAction(page, districtId, "heist");
  await expect(action).toBeEnabled();
  const result = await clickAndReadTypedSubmit(page, "heist-district", action);
  expect(result.request.command.payload).toMatchObject({
    targetDistrictId: districtId,
    sourceDistrictId: projection.sourceDistrictId,
    expectedConflictRevision: projection.expectedConflictRevision
  });
  const pendingEffect = assertAcceptedPendingOperation(result, "heist-district", districtId);
  return { ...result, pendingEffect, projection };
}

async function runAttackThroughVisibleUi(page, districtId) {
  const projection = await openActionTargetFromMap(page, districtId, "attack");
  const action = visibleDistrictAction(page, districtId, "attack");
  await expect(action).toBeEnabled();
  await action.click();
  const setup = page.locator("[data-attack-setup-popup]");
  await expect(setup).toBeVisible();
  const sourceDistrictOption = projection.sourceDistrictId.replace(/^district:/u, "");
  await setup.locator("[data-attack-source-select]").selectOption(sourceDistrictOption);
  const bazookas = setup.locator('[data-attack-weapon-input="bazooka"]');
  await expect(bazookas).toBeEnabled();
  await bazookas.fill("20");
  await bazookas.dispatchEvent("input");
  const prepare = setup.locator("[data-attack-confirm]");
  await expect(prepare).toBeEnabled();
  await prepare.click();
  const confirmation = page.locator("[data-attack-confirm-popup]");
  await expect(confirmation).toBeVisible();
  const result = await clickAndReadTypedSubmit(
    page,
    "attack-district",
    confirmation.locator("[data-attack-confirm-button]")
  );
  expect(result.request.command.payload).toMatchObject({
    districtId,
    sourceDistrictId: projection.sourceDistrictId,
    expectedConflictRevision: projection.expectedConflictRevision,
    weapons: { bazooka: 20 }
  });
  const pendingEffect = assertAcceptedPendingOperation(result, "attack-district", districtId);
  return { ...result, pendingEffect, projection };
}

async function runOccupyThroughVisibleUi(page, districtId) {
  const projection = await openActionTargetFromMap(page, districtId, "occupy");
  const action = visibleDistrictAction(page, districtId, "occupy");
  await expect(action).toBeEnabled();
  await action.click();
  const popup = page.locator("[data-occupy-confirm-popup]");
  await expect(popup).toBeVisible();
  const result = await clickAndReadTypedSubmit(
    page,
    "occupy-district",
    popup.locator("[data-occupy-confirm-button]")
  );
  expect(result.request.command.payload).toMatchObject({
    districtId,
    sourceDistrictId: projection.sourceDistrictId,
    expectedConflictRevision: projection.expectedConflictRevision
  });
  const pendingEffect = assertAcceptedPendingOperation(result, "occupy-district", districtId);
  return { ...result, pendingEffect, projection };
}

async function openActionTargetFromMap(page, districtId, actionId = null) {
  await dismissVisibleOperationResults(page);
  const openDistrictPopup = page.locator("[data-district-popup]:visible");
  if (await openDistrictPopup.isVisible().catch(() => false)) {
    await openDistrictPopup.locator("button[data-district-popup-close]").click();
    await expect(openDistrictPopup).toBeHidden();
  }
  const numericDistrictId = Number(districtId.replace(/^district:/u, ""));
  const point = await page.evaluate((requestedDistrictId) => {
    const district = window.empireStreetsDistrictState?.getDistrictById?.(requestedDistrictId);
    const canvas = document.querySelector("[data-district-canvas]");
    const canvasHost = document.querySelector("[data-map-canvas]");
    if (!district || !(canvas instanceof HTMLCanvasElement) || !(canvasHost instanceof HTMLElement)) {
      return null;
    }
    const rect = canvasHost.getBoundingClientRect();
    return {
      x: rect.left + (Number(district.centerX) / canvas.width) * rect.width,
      y: rect.top + (Number(district.centerY) / canvas.height) * rect.height
    };
  }, numericDistrictId);
  expect(point, `District ${districtId} must have a clickable canvas point`).toBeTruthy();
  await page.mouse.click(point.x, point.y);
  await expect(page.locator("[data-district-popup]")).toBeVisible();
  await expect(page.locator("[data-district-popup]")).toHaveAttribute(
    "data-district-id",
    String(numericDistrictId)
  );
  await expect.poll(() => page.evaluate(() => (
    window.EmpireGameplaySliceClient?.getCurrentReadModel?.()?.district?.districtId || null
  ))).toBe(districtId);
  if (!actionId) {
    return null;
  }

  const projection = await page.evaluate(({ requestedActionId, requestedDistrictId }) => {
    const collectionKey = `${requestedActionId}Targets`;
    const readModels = [
      window.empireStreetsGameplaySliceReadModel,
      window.EmpireGameplaySliceClient?.getCurrentReadModel?.()
    ].filter(Boolean);
    for (const readModel of readModels) {
      const entries = readModel?.district?.targetActions?.[collectionKey]
        || readModel?.district?.[collectionKey]
        || [];
      const target = entries.find((entry) => entry.districtId === requestedDistrictId) || null;
      if (!target) continue;
      const corridor = readModel?.frontier?.corridorTargets?.find(
        (entry) => entry.targetDistrictId === requestedDistrictId
      ) || null;
      return {
        ...target,
        sourceDistrictId: corridor?.sourceDistrictId || target.sourceDistrictId,
        routeDistrictId: corridor?.routeDistrictId || null,
        expectedRouteVersion: corridor?.routeVersion ?? null
      };
    }
    return null;
  }, { requestedActionId: actionId, requestedDistrictId: districtId });
  expect(projection, `${actionId} projection must include ${districtId}`).toBeTruthy();
  expect(projection.enabled, projection.disabledReason || actionId).toBe(true);
  return projection;
}

function visibleDistrictAction(page, districtId, actionId) {
  return page.locator(
    `[data-district-popup][data-district-id="${districtId.replace(/^district:/u, "")}"]`
      + ` [data-district-action-id="${actionId}"]`
  );
}

async function clickAndReadTypedSubmit(page, commandType, button) {
  await expect(button).toBeVisible();
  await expect(button).toBeEnabled();
  const responsePromise = waitForTerminalGameplaySubmit(page, (request) => (
    request?.command?.type === commandType
  ));
  await button.click();
  const submission = await responsePromise;
  const { body, request, response } = submission;
  expect(response.status(), `${commandType} response status`).toBe(200);
  expect(submission.stateVersionConflicts.length, `${commandType} single OCC rebase`).toBeLessThanOrEqual(1);
  return {
    request,
    body,
    stateVersionConflicts: submission.stateVersionConflicts
  };
}

function assertAcceptedPendingOperation(result, commandType, districtId) {
  const errorCodes = result.body?.errors?.map((error) => error.code).filter(Boolean).join(", ");
  expect(result.body?.accepted, `${commandType}${errorCodes ? ` (${errorCodes})` : ""}`).toBe(true);
  const commandId = result.request?.command?.id;
  expect(findCommandReport(result.body?.readModel, commandId, commandType, districtId),
    `${commandType} must not expose a report before its due tick`).toBeNull();
  const effectType = mapEffectType(commandType);
  const pendingEffect = result.body?.readModel?.mapEffects?.find((effect) => (
    effect.type === effectType
    && effect.districtId === districtId
    && effect.playerId === result.body?.readModel?.player?.playerId
  ));
  expect(pendingEffect, `${commandType} must expose its authoritative pending map effect`).toBeTruthy();
  expect(pendingEffect).toMatchObject({
    source: commandType === "attack-district" || commandType === "occupy-district"
      ? "server-public-operation"
      : "server-pending-operation",
    districtId
  });
  expect(pendingEffect.startedAtTick).toBeLessThanOrEqual(result.body.readModel.server.currentTick);
  expect(pendingEffect.expiresAtTick).toBeGreaterThan(result.body.readModel.server.currentTick);
  return pendingEffect;
}

async function waitForRenderedStateVersionAtLeast(page, expectedStateVersion) {
  await expect.poll(
    () => page.evaluate(() => (
      window.EmpireGameplaySliceClient?.getCurrentReadModel?.()?.server?.stateVersion ?? null
    )),
    {
      message: `Rendered state version must include committed version ${expectedStateVersion}.`,
      timeout: 30_000,
      intervals: [250, 500, 1_000]
    }
  ).toBeGreaterThanOrEqual(expectedStateVersion);
}

async function waitForDeferredReport(page, operation) {
  const commandType = operation.request.command.type;
  const commandId = operation.request.command.id;
  const districtId = operation.pendingEffect.districtId;
  const startTick = Number(operation.body.readModel.server.currentTick);
  const tickRateMs = Math.max(1, Number(operation.body.readModel.mode?.tickRateMs || 1_000));
  const timeout = Math.max(
    30_000,
    (operation.pendingEffect.expiresAtTick - startTick) * tickRateMs + 30_000
  );
  let completion = null;
  await expect.poll(async () => {
    const loaded = await loadAuthoritativeReadModel(page, districtId);
    const report = findCommandReport(loaded, commandId, commandType, districtId);
    if (!report || loaded.server.currentTick < operation.pendingEffect.expiresAtTick) return false;
    completion = { readModel: loaded, report };
    return true;
  }, {
    message: `${commandType} report must resolve at or after authoritative tick ${operation.pendingEffect.expiresAtTick}.`,
    timeout,
    intervals: [250, 500, 1_000]
  }).toBe(true);

  expect(completion.report.tick).toBeGreaterThanOrEqual(operation.pendingEffect.expiresAtTick);
  expect(completion.readModel.mapEffects.map((effect) => effect.effectId))
    .not.toContain(operation.pendingEffect.effectId);
  await page.reload({ waitUntil: "load" });
  await waitForLiveGame(page);
  const persisted = await page.evaluate(() => (
    window.EmpireGameplaySliceClient?.getCurrentReadModel?.() || null
  ));
  expect(findCommandReport(persisted, commandId, commandType, districtId),
    `${commandType} report for ${districtId} must survive reload`).toBeTruthy();
  return completion;
}

async function loadAuthoritativeReadModel(page, districtId) {
  const response = await page.request.post("/api/gameplay-slice/load", {
    data: { serverInstanceId, districtId }
  });
  const result = { status: response.status(), body: await response.json() };
  expect(result.status).toBe(200);
  expect(result.body?.accepted).toBe(true);
  return result.body.readModel;
}

function findCommandReport(readModel, commandId, commandType, districtId) {
  return readModel?.reports?.find((report) => (
    report.actionType === commandType
    && report.targetDistrictId === districtId
    && String(report.reportId || "").includes(commandId)
  )) || null;
}

function mapEffectType(commandType) {
  return ({
    "attack-district": "attack",
    "heist-district": "heist",
    "occupy-district": "occupy",
    "rob-district": "robbery",
    "spy-district": "spy"
  })[commandType];
}

async function dismissVisibleOperationResults(page) {
  const closeSelectors = [
    "#spy-result-modal-close",
    "#raid-result-modal-close",
    "#attack-result-modal-close",
    "#police-action-result-modal-close"
  ];
  for (const selector of closeSelectors) {
    const close = page.locator(`${selector}:visible`);
    if (await close.isVisible().catch(() => false)) {
      await close.click();
    }
  }
}

function parseIdentities(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
