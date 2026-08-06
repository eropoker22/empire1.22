import { expect, test } from "@playwright/test";
import {
  expectHostedUiParityClean,
  loginHostedUiParityAccount
} from "./helpers/hostedUiParityEntry.js";

const hostedEnabled = process.env.EMPIRE_HOSTED_UI_PARITY_E2E === "1";
const serverInstanceId = process.env.EMPIRE_UI_PARITY_SERVER_ID || "";
const identities = parseJsonArray(process.env.EMPIRE_HOSTED_BOOTSTRAP_IDENTITIES_JSON);

test.skip(
  !hostedEnabled || !serverInstanceId,
  "Set the public hosted E2E environment and finalized full-lifecycle server."
);
test.setTimeout(1_800_000);

test("reconnects twenty-player match results without restoring mutation authority", async ({ browser }) => {
  expect(identities.length).toBe(20);
  const observations = [];

  for (let index = 0; index < identities.length; index += 1) {
    const observation = await observeFinishedAccount(browser, identities[index]);
    observations.push(observation.result);
  }

  expect(observations).toHaveLength(20);
  expect(observations.filter(({ currentPlayerStatus }) => currentPlayerStatus === "defeated")).toHaveLength(12);
  expect(observations.filter(({ currentPlayerStatus }) => currentPlayerStatus === "active")).toHaveLength(8);
  expect(new Set(observations.map(({ currentPlayerId }) => currentPlayerId)).size).toBe(20);
  expect(observations.map(({ currentAccountPlacement }) => currentAccountPlacement).sort((left, right) => left - right))
    .toEqual(Array.from({ length: 20 }, (_, index) => index + 1));

  const [first] = observations;
  expect(first.top3.map((entry) => entry.rank)).toEqual([1, 2, 3]);
  expect(first.winner).toMatchObject(first.top3[0]);
  expect(first.winner.rank).toBe(1);
  for (const observation of observations) {
    expect(canonicalTop3(observation.top3)).toEqual(canonicalTop3(first.top3));
    expect(canonicalTop3(observation.finalLockdown.leaderboardTop3)).toEqual(canonicalTop3(first.top3));
    expect(observation.winner).toEqual(first.winner);
    expect(canonicalMatchEvidence(observation)).toEqual(canonicalMatchEvidence(first));
  }
});

async function observeFinishedAccount(browser, identity) {
  const context = await browser.newContext({
    baseURL: process.env.PLAYWRIGHT_E2E_BASE_URL
  });
  const page = await context.newPage();
  try {
    const entry = await loginHostedUiParityAccount(page, identity);
    expect((await context.cookies()).some((cookie) => cookie.name === "empire_gameplay_session")).toBe(false);

    const result = await loadFinishedResults(page);
    expectFinishedResult(result);
    const membership = await loadFinishedMembership(page);
    expect(membership).toMatchObject({
      serverInstanceId,
      status: "completed",
      playerId: result.currentPlayerId,
      finalRank: result.currentAccountPlacement
    });

    await page.locator('[data-lobby-nav-target="gang"]').click();
    const visibleResult = page.locator(
      `[data-testid="completed-server-result"][data-server-instance-id="${serverInstanceId}"]`
    );
    await expect(visibleResult).toBeVisible();
    await expect(visibleResult).toHaveAttribute("data-result-state", "resolved");
    await expect(visibleResult).toHaveAttribute("data-server-status", "ended");
    await expect(visibleResult).toHaveAttribute("data-final-lockdown-status", "resolved");
    await expect(visibleResult).toHaveAttribute("data-current-player-status", result.currentPlayerStatus);
    await expect(visibleResult).not.toContainText(/Načítám|loading/iu);
    if (result.currentPlayerStatus === "defeated") await expect(visibleResult).toContainText("PORÁŽKA");

    await expectFinishedSubmitIsReadOnly(page, result);
    await expectHostedUiParityClean(page, entry.diagnostics);
    return { result };
  } finally {
    await context.close();
  }
}

async function loadFinishedResults(page) {
  const response = await page.evaluate(async (instanceId) => {
    const result = await fetch(`/api/lobby/servers/${encodeURIComponent(instanceId)}/results`, {
      credentials: "same-origin",
      cache: "no-store"
    });
    return { status: result.status, payload: await result.json() };
  }, serverInstanceId);
  expect(response.status).toBe(200);
  expect(response.payload).toMatchObject({ accepted: true, data: { serverInstanceId } });
  return response.payload.data;
}

async function loadFinishedMembership(page) {
  const response = await page.evaluate(async (instanceId) => {
    const result = await fetch("/api/lobby/overview", {
      credentials: "same-origin",
      cache: "no-store"
    });
    const payload = await result.json();
    return {
      status: result.status,
      accepted: payload?.accepted === true,
      activeBlockingMembership: payload?.data?.activeBlockingMembership ?? null,
      membership: payload?.data?.memberships?.find((entry) => (
        entry.serverInstanceId === instanceId
      )) ?? null
    };
  }, serverInstanceId);
  expect(response).toMatchObject({
    status: 200,
    accepted: true,
    activeBlockingMembership: null,
    membership: { serverInstanceId, status: "completed" }
  });
  return response.membership;
}

function expectFinishedResult(result) {
  expect(result).toMatchObject({
    serverInstanceId,
    server: {
      serverInstanceId,
      status: "ended",
      currentTick: expect.any(Number),
      stateVersion: expect.any(Number)
    },
    finalLockdown: {
      status: "resolved",
      currentPlayerRank: expect.any(Number),
      leaderboardTop3: expect.any(Array)
    },
    currentPlayerStatus: expect.stringMatching(/^(?:active|defeated)$/u),
    currentPlayerId: expect.stringMatching(/^player:/u),
    currentAccountPlacement: expect.any(Number),
    top3: expect.any(Array)
  });
  expect(result.server.stateVersion).toBeGreaterThan(0);
  expect(result.top3).toHaveLength(3);
  expect(result.finalLockdown.currentPlayerRank).toBe(result.currentAccountPlacement);
}

async function expectFinishedSubmitIsReadOnly(page, before) {
  const response = await page.evaluate(async ({ instanceId, playerId, stateVersion }) => {
    const result = await fetch("/api/gameplay-slice/submit", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        command: {
          id: `finished-reconnect:${crypto.randomUUID()}`,
          type: "activate-player-boost",
          mode: "free",
          playerId,
          serverInstanceId: instanceId,
          issuedAt: new Date().toISOString(),
          payload: { boostId: "ghost-network" },
          clientRequestId: null
        },
        focusDistrictId: "district:finished-result-read-only",
        expectedStateVersion: stateVersion
      })
    });
    return { status: result.status, payload: await result.json() };
  }, {
    instanceId: serverInstanceId,
    playerId: before.currentPlayerId,
    stateVersion: before.server.stateVersion
  });

  expect(response).toMatchObject({
    status: 200,
    payload: {
      accepted: false,
      readModel: null,
      errors: [{ code: "GAME_FINISHED" }],
      metadata: {
        serverTick: before.server.currentTick,
        stateVersion: before.server.stateVersion
      }
    }
  });
  const after = await loadFinishedResults(page);
  expect(after.server.stateVersion).toBe(before.server.stateVersion);
  expect(after.server.currentTick).toBe(before.server.currentTick);
}

function canonicalTop3(entries) {
  return entries.map(({ playerId, playerName, gangName, rank, score }) => ({
    playerId,
    playerName,
    gangName,
    rank,
    score
  }));
}

function canonicalMatchEvidence(result) {
  return {
    serverInstanceId: result.server.serverInstanceId,
    serverStatus: result.server.status,
    currentTick: result.server.currentTick,
    stateVersion: result.server.stateVersion,
    finalLockdownStatus: result.finalLockdown.status,
    completedAt: result.completedAt,
    completionReason: result.completionReason,
    winner: result.winner,
    top3: canonicalTop3(result.top3)
  };
}

function parseJsonArray(value) {
  if (!value) return [];
  const parsed = JSON.parse(value);
  return Array.isArray(parsed) ? parsed : [];
}
