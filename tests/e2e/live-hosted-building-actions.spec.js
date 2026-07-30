import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import {
  expectHostedUiParityClean,
  loginAndResumeHostedUiParityGame,
  waitForLiveGame
} from "./helpers/hostedUiParityEntry.js";

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

test.describe("hosted canonical building actions", () => {
  test.skip(
    !hostedEnabled
      || !serverInstanceId
      || !["day", "night"].includes(phase)
      || !username
      || !password,
    "Local hosted building action coverage requires the guarded harness identity and phase."
  );
  test.setTimeout(900_000);

  test(`executes every ${phase || "selected"} visible action through server authority`, async ({ page }) => {
    const entry = await loginAndResumeHostedUiParityGame(page, {
      username,
      password,
      networkIdentifier
    });
    expect(phaseEntries.length).toBeGreaterThan(0);

    const commandCountsByTick = new Map();
    let lastAccepted = null;
    for (const matrixEntry of phaseEntries) {
      let loaded = await loadDistrict(page, matrixEntry.districtId);
      expect(loaded.readModel?.dayNight?.phaseId, matrixEntry.actionId).toBe(phase);
      const building = loaded.readModel?.district?.buildings?.find(
        (candidate) => candidate.buildingTypeId === matrixEntry.buildingTypeId
      );
      expect(building, `${matrixEntry.buildingTypeId} must exist in ${matrixEntry.districtId}`).toBeTruthy();
      const action = building.actions?.find(
        (candidate) => candidate.actionId === matrixEntry.actionId
      );
      expect(action, `${matrixEntry.actionId} must be projected as a visible action`).toBeTruthy();
      expect(action.enabled, action.disabledReason || matrixEntry.actionId).toBe(true);

      const currentTick = Number(loaded.readModel.server.currentTick);
      if ((commandCountsByTick.get(currentTick) || 0) >= 4) {
        loaded = await waitForNextTick(page, matrixEntry.districtId, currentTick);
      }
      const accepted = await submitBuildingAction(page, {
        action,
        building,
        readModel: loaded.readModel
      });
      const acceptedTick = Number(accepted.readModel.server.currentTick);
      commandCountsByTick.set(acceptedTick, (commandCountsByTick.get(acceptedTick) || 0) + 1);
      expect(accepted.readModel.server.stateVersion)
        .toBeGreaterThan(loaded.readModel.server.stateVersion);
      expect(accepted.readModel.reports).toEqual(expect.arrayContaining([
        expect.objectContaining({
          reportType: "building-action",
          actionType: "run-building-action",
          districtId: matrixEntry.districtId,
          buildingId: building.buildingId,
          buildingActionId: matrixEntry.actionId,
          result: "success"
        })
      ]));
      lastAccepted = {
        actionId: matrixEntry.actionId,
        districtId: matrixEntry.districtId,
        stateVersion: accepted.readModel.server.stateVersion
      };
    }

    expect(entry.diagnostics.submitRequests).toHaveLength(phaseEntries.length);
    expect(entry.diagnostics.submitRequests.every(
      (request) => request?.command?.type === "run-building-action"
    )).toBe(true);
    expect(lastAccepted).toBeTruthy();

    await page.reload({ waitUntil: "load" });
    await waitForLiveGame(page);
    const restored = await loadDistrict(page, lastAccepted.districtId);
    expect(restored.readModel.server.stateVersion).toBeGreaterThanOrEqual(lastAccepted.stateVersion);
    expect(restored.readModel.reports).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reportType: "building-action",
        buildingActionId: lastAccepted.actionId,
        result: "success"
      })
    ]));
    await expectHostedUiParityClean(page, entry.diagnostics);
  });
});

async function loadDistrict(page, districtId) {
  const result = await postGameplaySliceRequest(page, "load", {
    serverInstanceId,
    districtId
  });
  expect(result.status, `${districtId} load status`).toBe(200);
  expect(result.payload?.accepted, `${districtId} load`).toBe(true);
  expect(result.payload?.readModel?.district?.districtId).toBe(districtId);
  return result.payload;
}

async function waitForNextTick(page, districtId, currentTick) {
  await expect.poll(
    async () => (await loadDistrict(page, districtId)).readModel.server.currentTick,
    {
      message: `Command rate window must advance after tick ${currentTick}.`,
      timeout: 30_000
    }
  ).toBeGreaterThan(currentTick);
  return loadDistrict(page, districtId);
}

async function submitBuildingAction(page, { action, building, readModel }) {
  const payload = {
    districtId: readModel.district.districtId,
    buildingId: building.buildingId,
    actionId: action.actionId,
    ...createActionInput(action.requiresInput)
  };
  const result = await postGameplaySliceRequest(page, "submit", {
    command: {
      id: `hosted-building-action:${action.actionId}:${Date.now().toString(36)}`,
      type: "run-building-action",
      mode: readModel.mode.mode,
      playerId: readModel.player.playerId,
      serverInstanceId: readModel.server.serverInstanceId,
      issuedAt: new Date().toISOString(),
      payload,
      clientRequestId: null
    },
    focusDistrictId: readModel.district.districtId,
    expectedStateVersion: null
  });
  expect(result.status, `${action.actionId} submit status`).toBe(200);
  const errorCodes = result.payload?.errors?.map((error) => error.code).filter(Boolean).join(", ");
  expect(
    result.payload?.accepted,
    `${action.actionId} submit${errorCodes ? ` (${errorCodes})` : ""}`
  ).toBe(true);
  return result.payload;
}

function createActionInput(inputs = []) {
  return Object.fromEntries(inputs.flatMap((input) => {
    if (input.type === "select") {
      const value = input.options?.[0]?.value;
      return value ? [[input.id, value]] : [];
    }
    if (input.type === "number") {
      return [[input.id, Math.max(1, Number(input.min || 1))]];
    }
    if (input.required) {
      return [[input.id, "commercial"]];
    }
    return [];
  }));
}

async function postGameplaySliceRequest(page, route, requestBody) {
  return page.evaluate(async ({ requestRoute, body }) => {
    const response = await fetch(`/api/gameplay-slice/${requestRoute}`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      credentials: "same-origin",
      body: JSON.stringify(body)
    });
    return {
      status: response.status,
      payload: await response.json()
    };
  }, {
    requestRoute: route,
    body: requestBody
  });
}
