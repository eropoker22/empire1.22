import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import {
  expectHostedUiParityClean,
  loginAndResumeHostedUiParityGame
} from "./helpers/hostedUiParityEntry.js";
import { summarizeRemoteLoadSamples } from "../../scripts/remote-staging-load-metrics.mjs";

const enabled = process.env.EMPIRE_REMOTE_STAGING_LOAD_SOAK === "1";
const serverInstanceId = String(process.env.EMPIRE_UI_PARITY_SERVER_ID || "");
const identities = parseIdentities(process.env.EMPIRE_HOSTED_BOOTSTRAP_IDENTITIES_JSON);
const workerOrigin = String(process.env.EMPIRE_HOSTED_WORKER_ORIGIN || "");
const buildSha = String(process.env.EMPIRE_BUILD_SHA || "");
const durationMinutes = Number(process.env.EMPIRE_REMOTE_LOAD_SOAK_MINUTES || 0);
const pollIntervalMs = Number(process.env.EMPIRE_REMOTE_LOAD_POLL_INTERVAL_MS || 30_000);
const reportPath = String(process.env.EMPIRE_REMOTE_LOAD_REPORT_PATH || "artifacts/remote-staging/load-soak-browser.json");

test.skip(
  !enabled
    || !serverInstanceId
    || identities.length !== 20
    || !/^https:\/\/[^/]+$/u.test(workerOrigin)
    || !/^[0-9a-f]{40}$/u.test(buildSha)
    || !Number.isInteger(durationMinutes)
    || durationMinutes < 60
    || durationMinutes > 360
    || !Number.isInteger(pollIntervalMs)
    || pollIntervalMs < 10_000,
  "Remote staging load soak requires the guarded 20-player public staging harness for 60-360 minutes."
);
test.setTimeout((durationMinutes + 30) * 60_000);

test("sustains 5, 10 and 20 player login, polling and command pressure", async ({ browser }, testInfo) => {
  const samples = {
    apiDurationsMs: [],
    commandDurationsMs: [],
    loginDurationsMs: [],
    workerDurationsMs: [],
    statusCodes: [],
    ticks: [],
    snapshotRecoveryHeadUpdates: [],
    heartbeatAgesMs: []
  };
  const cohortEvidence = [];
  let clients = [];
  let report = null;
  try {
    for (const count of [5, 10]) {
      const cohort = await openCohort(browser, identities.slice(0, count), samples);
      cohortEvidence.push({ count, loginDurationMs: cohort.loginDurationMs });
      await runCommandBurst(cohort.clients, samples);
      await Promise.allSettled(cohort.clients.map(({ context }) => context.close()));
    }
    const finalCohort = await openCohort(browser, identities, samples);
    clients = finalCohort.clients;
    cohortEvidence.push({ count: 20, loginDurationMs: finalCohort.loginDurationMs });
    await runCommandBurst(clients, samples);

    const deadline = Date.now() + durationMinutes * 60_000;
    while (Date.now() < deadline) {
      const cycleStarted = Date.now();
      const [loads, apiHealth, workerHealth] = await Promise.all([
        Promise.all(clients.map(({ page }) => loadGameplaySlice(page, serverInstanceId))),
        fetchJsonWithDuration(`${process.env.EMPIRE_PUBLIC_ORIGIN}/api/health`),
        fetchJsonWithDuration(`${workerOrigin}/health`)
      ]);
      samples.apiDurationsMs.push(...loads.map((entry) => entry.durationMs), apiHealth.durationMs);
      samples.workerDurationsMs.push(workerHealth.durationMs);
      samples.statusCodes.push(...loads.map((entry) => entry.status), apiHealth.status, workerHealth.status);
      samples.ticks.push(...loads.map((entry) => entry.tick).filter(Number.isFinite));
      samples.heartbeatAgesMs.push(Number(workerHealth.body?.heartbeat?.ageMs));
      samples.snapshotRecoveryHeadUpdates.push(Number(
        workerHealth.body?.snapshotPersistence?.metrics?.recoveryHeadUpdates
      ));
      expect(apiHealth.body).toMatchObject({
        status: "ready",
        apiBuildSha: buildSha,
        environment: "staging"
      });
      expect(workerHealth.body).toMatchObject({
        status: "ok",
        buildSha,
        environment: "staging",
        heartbeat: { registered: true }
      });
      const remainingDelay = Math.max(0, pollIntervalMs - (Date.now() - cycleStarted));
      if (remainingDelay > 0 && Date.now() + remainingDelay < deadline) {
        await new Promise((resolve) => setTimeout(resolve, remainingDelay));
      }
    }
    for (const client of clients) await expectHostedUiParityClean(client.page, client.diagnostics);
    const metrics = summarizeRemoteLoadSamples(samples);
    report = {
      checkedAt: new Date().toISOString(),
      environment: "staging",
      buildSha,
      serverInstanceHash: createHash("sha256").update(serverInstanceId).digest("hex").slice(0, 16),
      durationMinutes,
      pollIntervalMs,
      cohorts: cohortEvidence,
      metrics
    };
    expect(metrics.violations).toEqual([]);
  } finally {
    report ??= {
      checkedAt: new Date().toISOString(),
      environment: "staging",
      buildSha,
      serverInstanceHash: serverInstanceId
        ? createHash("sha256").update(serverInstanceId).digest("hex").slice(0, 16)
        : null,
      durationMinutes,
      pollIntervalMs,
      cohorts: cohortEvidence,
      metrics: summarizeRemoteLoadSamples(samples)
    };
    mkdirSync(path.dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    await testInfo.attach("remote-staging-load-soak.json", {
      body: Buffer.from(`${JSON.stringify(report, null, 2)}\n`),
      contentType: "application/json"
    });
    await Promise.allSettled(clients.map(({ context }) => context.close()));
  }
});

async function openCohort(browser, cohortIdentities, samples) {
  const started = Date.now();
  const clients = await Promise.all(cohortIdentities.map(async (identity) => {
    const context = await browser.newContext({
      baseURL: process.env.PLAYWRIGHT_E2E_BASE_URL,
      viewport: { width: 1440, height: 900 }
    });
    const page = await context.newPage();
    page.setDefaultTimeout(30_000);
    const networkStatuses = [];
    page.on("response", (response) => {
      const pathname = new URL(response.url()).pathname;
      if (pathname.startsWith("/api/")) networkStatuses.push(response.status());
    });
    const entry = await loginAndResumeHostedUiParityGame(page, identity);
    samples.statusCodes.push(...networkStatuses);
    return { context, page, diagnostics: entry.diagnostics, identity };
  }));
  const loginDurationMs = Date.now() - started;
  samples.loginDurationsMs.push(loginDurationMs);
  return { clients, loginDurationMs };
}

async function runCommandBurst(clients, samples) {
  const commands = await Promise.all(clients.map(({ page }, index) => page.evaluate(async (resourceOffset) => {
    const readModel = window.EmpireGameplaySliceClient?.getCurrentReadModel?.() || null;
    const offers = (readModel?.market?.resources || []).filter((resource) => (
      resource?.normalMarket?.canBuy === true && Number(resource.normalMarket.stock) > 0
    ));
    const resource = offers[resourceOffset % Math.max(1, offers.length)] || null;
    const started = performance.now();
    if (!resource || typeof window.EmpireGameplaySliceClient?.submitCommand !== "function") {
      return { accepted: false, durationMs: performance.now() - started, errorCode: "MARKET_OFFER_MISSING" };
    }
    const result = await window.EmpireGameplaySliceClient.submitCommand({
      type: "buy-market-resource",
      focusDistrictId: readModel?.district?.districtId,
      payload: {
        resourceId: resource.resourceId,
        amount: 1,
        marketType: "normal",
        paymentType: "cleanCash"
      }
    });
    return {
      accepted: result?.accepted === true,
      durationMs: performance.now() - started,
      errorCode: result?.errors?.[0]?.code || null
    };
  }, index)));
  samples.commandDurationsMs.push(...commands.map((entry) => entry.durationMs));
  expect(commands.filter((entry) => entry.accepted).length).toBeGreaterThanOrEqual(
    Math.max(1, Math.floor(clients.length * 0.8))
  );
}

async function loadGameplaySlice(page, instanceId) {
  return page.evaluate(async (serverId) => {
    const current = window.EmpireGameplaySliceClient?.getCurrentReadModel?.() || null;
    const started = performance.now();
    const response = await fetch("/api/gameplay-slice/load", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        serverInstanceId: serverId,
        districtId: current?.district?.districtId || current?.player?.homeDistrictId
      })
    });
    const body = await response.json();
    return {
      accepted: body?.accepted === true,
      durationMs: performance.now() - started,
      status: response.status,
      tick: Number(body?.readModel?.server?.currentTick)
    };
  }, instanceId).then((result) => {
    expect(result.status).toBe(200);
    expect(result.accepted).toBe(true);
    return result;
  });
}

async function fetchJsonWithDuration(url) {
  const started = performance.now();
  const response = await fetch(url, {
    cache: "no-store",
    headers: { "cache-control": "no-cache" },
    signal: AbortSignal.timeout(15_000)
  });
  return {
    status: response.status,
    durationMs: performance.now() - started,
    body: await response.json()
  };
}

function parseIdentities(value) {
  try {
    const parsed = JSON.parse(String(value || "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
