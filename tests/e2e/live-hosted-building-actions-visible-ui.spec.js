import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import {
  expectHostedUiParityClean,
  loginAndResumeHostedUiParityGame,
  waitForLiveGame
} from "./helpers/hostedUiParityEntry.js";
import { openBuildingFromDistrict } from "./helpers/uiParityCapture.js";
import {
  dismissBlockingGameOverlays,
  dismissOnboardingGuide
} from "./helpers/empireSmokeHelpers.js";
import { waitForTerminalGameplaySubmit } from "./helpers/gameplaySubmitResponse.js";
import { createServerBuildingActionDefaultPayload } from "../../page-assets/js/app/runtime/buildingSpecialActionServerDefaults.js";

const hostedEnabled = process.env.EMPIRE_HOSTED_UI_PARITY_E2E === "1";
const serverInstanceId = process.env.EMPIRE_UI_PARITY_SERVER_ID || "";
const phase = process.env.EMPIRE_HOSTED_BUILDING_ACTION_PHASE || "";
const username = process.env.EMPIRE_HOSTED_BOOTSTRAP_USERNAME || "";
const password = process.env.EMPIRE_HOSTED_BOOTSTRAP_PASSWORD || "";
const networkIdentifier = process.env.EMPIRE_HOSTED_BOOTSTRAP_NETWORK_IDENTIFIER || "";
const matrix = JSON.parse(readFileSync(
  new URL("../../tools/seed/hosted-building-action-matrix.json", import.meta.url),
  "utf8"
));
const phaseEntries = matrix.filter((entry) => entry.phase === phase);
const representativeScreenshotTypes = new Set(
  phase === "night"
    ? ["casino"]
    : ["central_bank", "restaurant", "street_dealers"]
);

test.use({ trace: "off", video: "off" });

test.describe("fixture-backed hosted canonical building-action visible UI coverage", () => {
  test.skip(
    !hostedEnabled
      || !serverInstanceId
      || !["day", "night"].includes(phase)
      || !username
      || !password,
    "Visible local-hosted building actions require the guarded harness identity and phase."
  );
  test.setTimeout(900_000);

  test(`clicks every seeded ${phase || "selected"} action through visible confirmed UI`, async ({
    page
  }, testInfo) => {
    testInfo.annotations.push({
      type: "fixture",
      description: `PostgreSQL worker scenario building-actions-${phase}`
    });
    const entry = await loginAndResumeHostedUiParityGame(page, {
      username,
      password,
      networkIdentifier
    });
    expect(matrix).toHaveLength(39);
    expect(new Set(matrix.map((matrixEntry) => matrixEntry.actionId)).size).toBe(39);
    expect(phaseEntries).toHaveLength(phase === "day" ? 35 : 4);

    const coverage = {
      phase,
      matrixCount: phaseEntries.length,
      executed: [],
      gaps: [],
      presentations: []
    };
    const commandCountsByTick = new Map();
    let lastAccepted = null;

    for (const districtGroup of groupMatrixEntries(phaseEntries)) {
      for (const buildingGroup of districtGroup.buildings) {
        await openDistrictThroughMapClick(page, districtGroup.districtId);
        await openBuildingFromDistrict(page, buildingGroup.buildingTypeId);
        const shell = page.locator("[data-district-building-detail-popup]:not([hidden])").last();
        await expect(shell).toBeVisible({ timeout: 30_000 });
        const buildingId = await expectSharedBuildingContract({
          buildingGroup,
          coverage,
          page,
          shell
        });

        if (representativeScreenshotTypes.has(buildingGroup.buildingTypeId)) {
          await testInfo.attach(
            `visible-action-${phase}-${buildingGroup.buildingTypeId}.png`,
            {
              body: await shell.screenshot(),
              contentType: "image/png"
            }
          );
        }

        for (const matrixEntry of buildingGroup.entries) {
          const projected = await readProjectedAction(page, {
            actionId: matrixEntry.actionId,
            buildingId,
            districtId: districtGroup.districtId
          });
          expect(projected.phase, matrixEntry.actionId).toBe(phase);
          expect(projected.action.enabled, projected.action.disabledReason || matrixEntry.actionId)
            .toBe(true);

          const actionButton = shell.locator(
            `[data-district-building-detail-action-id="${matrixEntry.actionId}"]`
          );
          await expect(actionButton, `${matrixEntry.actionId} must be a visible action control`)
            .toBeVisible();
          const preparedInputs = await prepareVisibleActionInputs({
            actionId: matrixEntry.actionId,
            actionButton,
            requiredInputs: projected.action.requiresInput || [],
            shell
          });

          if (preparedInputs.missingRequiredInputIds.length > 0) {
            coverage.gaps.push({
              actionId: matrixEntry.actionId,
              buildingId,
              buildingTypeId: buildingGroup.buildingTypeId,
              districtId: districtGroup.districtId,
              missingRequiredInputIds: preparedInputs.missingRequiredInputIds,
              projectedRequiredInputIds: (projected.action.requiresInput || [])
                .map((input) => input.id),
              visibleDisabledReason: await actionButton.getAttribute("title"),
              visibleEnabled: await actionButton.isEnabled()
            });
            continue;
          }

          await expect(actionButton, `${matrixEntry.actionId} must be enabled after visible input`)
            .toBeEnabled();
          const commandWindow = await waitForCommandWindow(page, commandCountsByTick);
          const accepted = await clickVisibleBuildingAction(page, {
            actionButton,
            actionId: matrixEntry.actionId,
            buildingId,
            districtId: districtGroup.districtId,
            defaultedInputIds: preparedInputs.defaultedInputIds,
            inputValues: preparedInputs.values,
            previousStateVersion: projected.stateVersion
          });
          commandCountsByTick.set(
            accepted.tick,
            (commandCountsByTick.get(accepted.tick) || 0) + 1
          );
          expect(accepted.tick).toBeGreaterThanOrEqual(commandWindow.tick);
          coverage.executed.push({
            actionId: matrixEntry.actionId,
            attemptCommandIds: accepted.attemptCommandIds,
            buildingId,
            buildingTypeId: buildingGroup.buildingTypeId,
            confirmation: accepted.confirmation,
            defaultedInputIds: preparedInputs.defaultedInputIds,
            districtId: districtGroup.districtId,
            inputValues: preparedInputs.values,
            reportId: accepted.reportId,
            stateVersion: accepted.stateVersion,
            tick: accepted.tick
          });
          lastAccepted = {
            actionId: matrixEntry.actionId,
            districtId: districtGroup.districtId,
            reportId: accepted.reportId,
            stateVersion: accepted.stateVersion
          };
        }
        await closeVisibleBuildingDetail(page);
      }
      await closeVisibleDistrict(page);
    }

    const gapActionIds = coverage.gaps.map((gap) => gap.actionId);
    expect(coverage.executed.length + coverage.gaps.length).toBe(phaseEntries.length);
    expect(new Set([
      ...coverage.executed.map((result) => result.actionId),
      ...gapActionIds
    ]).size).toBe(phaseEntries.length);
    const observedCommandIds = entry.diagnostics.submitRequests
      .filter((request) => request?.command?.type === "run-building-action")
      .map((request) => String(request.command.id || ""))
      .sort();
    const expectedCommandIds = coverage.executed
      .flatMap((result) => result.attemptCommandIds)
      .sort();
    expect(observedCommandIds).toEqual(expectedCommandIds);
    expect(lastAccepted).toBeTruthy();

    if (coverage.gaps.length > 0) {
      testInfo.annotations.push({
        type: "visible-input-gap",
        description: coverage.gaps.map((gap) => gap.actionId).join(", ")
      });
    }
    await testInfo.attach(`visible-building-action-coverage-${phase}.json`, {
      body: Buffer.from(`${JSON.stringify(coverage, null, 2)}\n`, "utf8"),
      contentType: "application/json"
    });
    expect(
      coverage.gaps,
      "Every canonical action must expose all projected inputs through visible controls"
    ).toEqual([]);
    const immediateSubmitActions = coverage.executed
      .filter((result) => result.confirmation === "immediate-submit")
      .map((result) => result.actionId);
    if (immediateSubmitActions.length > 0) {
      testInfo.annotations.push({
        type: "missing-visible-confirmation",
        description: immediateSubmitActions.join(", ")
      });
    }
    expect(
      immediateSubmitActions,
      "Every canonical special action must pass through the shared visible confirmation"
    ).toEqual([]);

    await page.reload({ waitUntil: "load" });
    await waitForLiveGame(page);
    await openDistrictThroughMapClick(page, lastAccepted.districtId);
    const restored = await readCurrentReadModel(page);
    expect(restored.server.stateVersion).toBeGreaterThanOrEqual(lastAccepted.stateVersion);
    expect(restored.reports).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reportId: lastAccepted.reportId,
        reportType: "building-action",
        buildingActionId: lastAccepted.actionId,
        result: "success"
      })
    ]));
    await closeVisibleDistrict(page);
    await expectHostedUiParityClean(page, entry.diagnostics);
  });
});

function groupMatrixEntries(entries) {
  const districts = new Map();
  for (const entry of entries) {
    if (!districts.has(entry.districtId)) {
      districts.set(entry.districtId, {
        districtId: entry.districtId,
        buildings: new Map()
      });
    }
    const district = districts.get(entry.districtId);
    if (!district.buildings.has(entry.buildingTypeId)) {
      district.buildings.set(entry.buildingTypeId, {
        buildingTypeId: entry.buildingTypeId,
        entries: []
      });
    }
    district.buildings.get(entry.buildingTypeId).entries.push(entry);
  }
  return Array.from(districts.values()).map((district) => ({
    districtId: district.districtId,
    buildings: Array.from(district.buildings.values())
  }));
}

async function openDistrictThroughMapClick(page, districtId) {
  await dismissOnboardingGuide(page);
  await dismissBlockingGameOverlays(page);
  await closeVisibleBuildingDetail(page);
  await closeVisibleDistrict(page);
  const numericDistrictId = Number(String(districtId).replace(/^district:/u, ""));
  const clickTarget = await page.evaluate((id) => {
    const district = window.empireStreetsDistrictState?.getDistrictById?.(id);
    const canvas = document.querySelector("[data-district-canvas]");
    const canvasHost = document.querySelector("[data-map-canvas]");
    const viewport = document.querySelector("[data-map-viewport]");
    if (!district || !(canvas instanceof HTMLCanvasElement) || !(canvasHost instanceof HTMLElement)) {
      return null;
    }
    window.__EMPIRE_VISIBLE_BUILDING_ACTION_MAP_CLICKS__ = [];
    viewport?.addEventListener("click", (event) => {
      window.__EMPIRE_VISIBLE_BUILDING_ACTION_MAP_CLICKS__.push({
        isTrusted: event.isTrusted,
        x: event.clientX,
        y: event.clientY
      });
    }, { once: true });
    const rect = canvasHost.getBoundingClientRect();
    return {
      x: rect.left + (district.centerX / canvas.width) * rect.width,
      y: rect.top + (district.centerY / canvas.height) * rect.height
    };
  }, numericDistrictId);
  expect(clickTarget, `${districtId} must have a visible map coordinate`).toBeTruthy();

  const responsePromise = page.waitForResponse((response) => {
    if (
      new URL(response.url()).pathname !== "/api/gameplay-slice/load"
      || response.request().method() !== "POST"
    ) {
      return false;
    }
    try {
      return response.request().postDataJSON()?.districtId === districtId;
    } catch {
      return false;
    }
  }, { timeout: 30_000 });
  await page.mouse.click(clickTarget.x, clickTarget.y);
  const response = await responsePromise;
  expect(response.status(), `${districtId} visible map load`).toBe(200);
  const payload = await response.json();
  expect(payload.accepted, `${districtId} visible map selection`).toBe(true);
  expect(payload.readModel?.district?.districtId).toBe(districtId);
  await expect(page.locator("[data-district-popup-card]")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("[data-district-popup]")).toHaveAttribute(
    "data-district-id",
    String(numericDistrictId)
  );
  const trustedClicks = await page.evaluate(() => (
    window.__EMPIRE_VISIBLE_BUILDING_ACTION_MAP_CLICKS__ || []
  ));
  expect(trustedClicks).toEqual([
    expect.objectContaining({ isTrusted: true })
  ]);
}

async function expectSharedBuildingContract({
  buildingGroup,
  coverage,
  page,
  shell
}) {
  await expect(shell).toHaveAttribute("data-ui-owner", "legacy-shared");
  await expect(shell).toHaveAttribute("data-execution-mode", "server-authoritative");
  const buildingId = await shell.getAttribute("data-server-building-id");
  expect(buildingId, `${buildingGroup.buildingTypeId} must expose a physical building ID`)
    .toBeTruthy();
  await expect(shell).toHaveAttribute(
    "data-server-building-type-id",
    buildingGroup.buildingTypeId
  );
  const signature = await shell.evaluate((element) => {
    const isVisible = (candidate) => {
      if (!(candidate instanceof HTMLElement) || candidate.hidden) return false;
      const style = getComputedStyle(candidate);
      const rect = candidate.getBoundingClientRect();
      return style.display !== "none"
        && style.visibility !== "hidden"
        && rect.width > 0
        && rect.height > 0;
    };
    const headings = Array.from(element.querySelectorAll("h5"))
      .filter(isVisible)
      .map((heading) => String(heading.textContent || "").replace(/\s+/gu, " ").trim());
    const grid = Array.from(
      element.querySelectorAll("[data-district-building-detail-actions]")
    ).find(isVisible);
    const gridActions = grid
      ? Array.from(grid.querySelectorAll("[data-district-building-detail-action-id]"))
        .filter(isVisible)
      : [];
    const actions = Array.from(
      element.querySelectorAll("[data-district-building-detail-action-id]")
    ).filter(isVisible);
    const style = grid instanceof HTMLElement ? getComputedStyle(grid) : null;
    const rects = gridActions.map((action) => {
      const rect = action.getBoundingClientRect();
      return {
        height: Math.round(rect.height),
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        width: Math.round(rect.width)
      };
    });
    return {
      actionIds: actions.map(
        (action) => action.dataset.districtBuildingDetailActionId || ""
      ),
      grid: {
        display: style?.display || "",
        flexDirection: style?.flexDirection || "",
        gridTemplateColumns: style?.gridTemplateColumns || "",
        rects
      },
      headings,
      layout: element.dataset.buildingDetailLayout || "",
      title: String(
        element.querySelector("[data-district-building-detail-title]")?.textContent || ""
      ).replace(/\s+/gu, " ").trim(),
      uiOwner: element.dataset.uiOwner || ""
    };
  });
  expect(signature.actionIds).toEqual(expect.arrayContaining(
    buildingGroup.entries.map((entry) => entry.actionId)
  ));
  coverage.presentations.push({
    buildingId,
    buildingTypeId: buildingGroup.buildingTypeId,
    districtId: await shell.getAttribute("data-server-district-id"),
    ...signature
  });
  const readModel = await readCurrentReadModel(page);
  const projectedBuilding = readModel.district.buildings.find(
    (building) => building.buildingId === buildingId
  );
  expect(projectedBuilding?.buildingTypeId).toBe(buildingGroup.buildingTypeId);
  return buildingId;
}

async function readProjectedAction(page, {
  actionId,
  buildingId,
  districtId
}) {
  const readModel = await readCurrentReadModel(page);
  expect(readModel.district.districtId).toBe(districtId);
  const building = readModel.district.buildings.find(
    (candidate) => candidate.buildingId === buildingId
  );
  expect(building, `${buildingId} must remain in the authoritative district view`).toBeTruthy();
  const action = building.actions?.find((candidate) => candidate.actionId === actionId);
  expect(action, `${actionId} must remain in the authoritative building view`).toBeTruthy();
  return {
    action,
    phase: readModel.dayNight?.phaseId,
    stateVersion: readModel.server.stateVersion
  };
}

async function readCurrentReadModel(page) {
  return page.evaluate(() => (
    window.EmpireGameplaySliceClient?.getCurrentReadModel?.()
      || window.empireStreetsGameplaySliceReadModel
      || null
  ));
}

async function prepareVisibleActionInputs({
  actionId,
  actionButton,
  requiredInputs,
  shell
}) {
  const defaultValues = createServerBuildingActionDefaultPayload(actionId);
  const defaultedInputIds = [];
  const values = {};
  const missingRequiredInputIds = [];
  const dealerWrapper = actionButton.locator("xpath=ancestor::*[@data-dealer-sale-action='true']");
  for (const input of requiredInputs) {
    const inputId = String(input?.id || "");
    let control = shell.locator(`[data-building-action-input="${inputId}"]`).first();
    if (inputId === "dealerSlotId" && await dealerWrapper.count()) {
      control = dealerWrapper.locator("[data-dealer-sale-slot]").first();
    } else if (inputId === "amount" && await dealerWrapper.count()) {
      control = dealerWrapper.locator("[data-dealer-sale-amount]").first();
    }
    const visible = await control.isVisible().catch(() => false);
    if (!visible) {
      if (Object.prototype.hasOwnProperty.call(defaultValues, inputId)) {
        values[inputId] = defaultValues[inputId];
        defaultedInputIds.push(inputId);
        continue;
      }
      if (input?.required !== false) missingRequiredInputIds.push(inputId);
      continue;
    }
    if (input.type === "select") {
      const option = await control.locator("option").evaluateAll((options) => (
        options.find((candidate) => !candidate.disabled && String(candidate.value || ""))
          ?.value || ""
      ));
      expect(option, `${inputId} must offer an enabled visible option`).toBeTruthy();
      await control.selectOption(option);
      values[inputId] = option;
    } else if (input.type === "number") {
      const value = Math.max(1, Number(input.min || await control.getAttribute("min") || 1));
      await control.fill(String(value));
      values[inputId] = value;
    } else {
      const value = input.required === false ? "commercial" : "materials";
      await control.fill(value);
      values[inputId] = value;
    }
  }
  if (await dealerWrapper.count()) {
    const itemId = await dealerWrapper.locator("[data-dealer-sale-item]").inputValue();
    if (itemId) values.itemId = itemId;
  }
  return { defaultedInputIds, missingRequiredInputIds, values };
}

async function waitForCommandWindow(page, commandCountsByTick) {
  let readModel = await readCurrentReadModel(page);
  const currentTick = Number(readModel.server.currentTick);
  if ((commandCountsByTick.get(currentTick) || 0) < 3) {
    return { tick: currentTick };
  }
  await expect.poll(
    async () => Number((await readCurrentReadModel(page)).server.currentTick),
    {
      message: `Visible command window must advance after tick ${currentTick}.`,
      timeout: 30_000
    }
  ).toBeGreaterThan(currentTick);
  readModel = await readCurrentReadModel(page);
  return { tick: Number(readModel.server.currentTick) };
}

async function clickVisibleBuildingAction(page, {
  actionButton,
  actionId,
  buildingId,
  defaultedInputIds,
  districtId,
  inputValues,
  previousStateVersion
}) {
  const responsePromise = waitForTerminalGameplaySubmit(page, (request) => (
    request?.command?.type === "run-building-action"
      && request.command.payload?.actionId === actionId
  ));
  const confirmation = page.locator(
    ".building-special-action-confirm:not([hidden])"
  );
  const confirmationPromise = confirmation.waitFor({
    state: "visible",
    timeout: 5_000
  }).then(
    () => "visible-confirmed",
    () => new Promise(() => {})
  );
  await actionButton.click();
  const firstOutcome = await Promise.race([
    confirmationPromise,
    responsePromise.then(() => "immediate-submit"),
    page.waitForTimeout(10_000).then(() => "timeout")
  ]);
  expect(firstOutcome, `${actionId} must open confirmation or submit`).not.toBe("timeout");
  if (firstOutcome === "visible-confirmed") {
    if (defaultedInputIds.length > 0) {
      const inputSummary = confirmation.locator(".building-special-action-confirm__stat")
        .filter({ hasText: "Volba" })
        .locator("strong");
      await expect(inputSummary, `${actionId} canonical defaults must be visible before submit`)
        .not.toHaveText("");
    }
    const confirmButton = confirmation.locator(
      ".building-special-action-confirm__button--confirm"
    );
    await expect(confirmButton).toBeVisible();
    await expect(confirmButton).toBeEnabled();
    await confirmButton.click();
  }
  const submission = await responsePromise;
  const { body: payload, request, response } = submission;
  expect(response.status(), `${actionId} visible submit`).toBe(200);
  expect(request.command).toMatchObject({
    playerId: payload.readModel.player.playerId,
    serverInstanceId,
    type: "run-building-action",
    payload: {
      actionId,
      buildingId,
      districtId
    }
  });
  for (const [inputId, value] of Object.entries(inputValues)) {
    expect(request.command.payload[inputId], `${actionId}.${inputId}`).toBe(value);
  }
  expect(payload.accepted, `${actionId} server acceptance`).toBe(true);
  expect(submission.stateVersionConflicts.length, `${actionId} single OCC rebase`).toBeLessThanOrEqual(1);
  if (submission.stateVersionConflicts.length === 1) {
    const staleRequest = submission.stateVersionConflicts[0].request;
    expect(request.command.id).not.toBe(staleRequest.command.id);
    expect(request.command.type).toBe(staleRequest.command.type);
    expect(request.command.payload).toEqual(staleRequest.command.payload);
  }
  expect(payload.readModel.server.stateVersion).toBeGreaterThan(previousStateVersion);
  const report = payload.readModel.reports.find((candidate) => (
    candidate.reportType === "building-action"
      && candidate.buildingActionId === actionId
      && candidate.buildingId === buildingId
      && candidate.districtId === districtId
  ));
  expect(report).toMatchObject({
    actionType: "run-building-action",
    buildingActionId: actionId,
    buildingId,
    districtId,
    reportType: "building-action",
    result: "success"
  });
  expect(report.reportId, `${actionId} report persistence identity`).toBeTruthy();
  await expect.poll(
    async () => Number((await readCurrentReadModel(page)).server.stateVersion),
    {
      message: `${actionId} accepted read model must reach the visible client`,
      timeout: 30_000
    }
  ).toBeGreaterThanOrEqual(payload.readModel.server.stateVersion);
  return {
    attemptCommandIds: submission.attempts.map(
      (attempt) => String(attempt.request?.command?.id || "")
    ).filter(Boolean),
    confirmation: firstOutcome,
    reportId: report.reportId,
    stateVersion: payload.readModel.server.stateVersion,
    tick: Number(payload.readModel.server.currentTick)
  };
}

async function closeVisibleBuildingDetail(page) {
  const shell = page.locator("[data-district-building-detail-popup]:not([hidden])").last();
  if (!await shell.isVisible().catch(() => false)) return;
  const close = shell.locator("[data-district-building-detail-close]").last();
  await expect(close).toBeVisible();
  await close.click();
  await expect(shell).toBeHidden();
}

async function closeVisibleDistrict(page) {
  const popup = page.locator("[data-district-popup]");
  if (!await popup.isVisible().catch(() => false)) return;
  const close = popup.locator("[data-district-popup-close]").last();
  await expect(close).toBeVisible();
  await close.click();
  await expect(popup).toBeHidden();
}
