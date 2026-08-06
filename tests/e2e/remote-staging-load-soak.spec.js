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
const actionClientsPerCycle = 5;
const maximumCityChatAttempts = 20;
const actionWeights = Object.freeze([
  { action: "buy-market-resource", weight: 15 },
  { action: "sell-market-resource", weight: 10 },
  { action: "collect-production", weight: 14 },
  { action: "craft-item", weight: 14 },
  { action: "run-building-action", weight: 14 },
  { action: "spy-district", weight: 8 },
  { action: "rob-district", weight: 7 },
  { action: "heist-district", weight: 5 },
  { action: "occupy-district", weight: 4 },
  { action: "attack-district", weight: 4 },
  { action: "send-city-chat-message", weight: 5 }
]);

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
    heartbeatAgesMs: [],
    actionOutcomes: []
  };
  const actionPressure = { sequence: 0, clientOffset: 0, cityChatAttempts: 0 };
  const cohortEvidence = [];
  let clients = [];
  let report = null;
  try {
    for (const count of [5, 10]) {
      const cohort = await openCohort(browser, identities.slice(0, count), samples);
      cohortEvidence.push({ count, loginDurationMs: cohort.loginDurationMs });
      await runActionBurst(cohort.clients, samples, actionPressure);
      await Promise.allSettled(cohort.clients.map(({ context }) => context.close()));
    }
    const finalCohort = await openCohort(browser, identities, samples);
    clients = finalCohort.clients;
    cohortEvidence.push({ count: 20, loginDurationMs: finalCohort.loginDurationMs });
    await runActionBurst(clients, samples, actionPressure);

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
      samples.statusCodes.push(apiHealth.status, workerHealth.status);
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
      await runActionBurst(clients, samples, actionPressure);
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
      metrics,
      actionSamples: samples.actionOutcomes
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
      metrics: summarizeRemoteLoadSamples(samples),
      actionSamples: samples.actionOutcomes
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
    page.on("response", (response) => {
      const pathname = new URL(response.url()).pathname;
      if (pathname.startsWith("/api/")) samples.statusCodes.push(response.status());
    });
    const entry = await loginAndResumeHostedUiParityGame(page, identity);
    return { context, page, diagnostics: entry.diagnostics, identity };
  }));
  const loginDurationMs = Date.now() - started;
  samples.loginDurationsMs.push(loginDurationMs);
  return { clients, loginDurationMs };
}

async function runActionBurst(clients, samples, pressure) {
  const clientCount = Math.min(actionClientsPerCycle, clients.length);
  if (clientCount === 0) return;
  const selectedClients = Array.from({ length: clientCount }, (_, index) => (
    clients[(pressure.clientOffset + index) % clients.length]
  ));
  pressure.clientOffset = (pressure.clientOffset + clientCount) % clients.length;
  const remainingChatBudget = Math.max(0, maximumCityChatAttempts - pressure.cityChatAttempts);
  const outcomes = await Promise.all(selectedClients.map(({ page }, index) => {
    pressure.sequence += 1;
    const sequence = pressure.sequence;
    return page.evaluate(async (input) => {
      const started = performance.now();
      const desiredAction = input.desiredAction;
      const unavailable = (errorCode, actualAction = null) => ({
        desiredAction,
        actualAction,
        outcome: "error",
        accepted: false,
        skipped: false,
        errorCode,
        errorCodes: [errorCode],
        transportFailure: false,
        durationMs: performance.now() - started
      });
      const client = window.EmpireGameplaySliceClient;
      const initialReadModel = client?.getCurrentReadModel?.() || null;
      let selectedDistrictChanged = false;
      if (initialReadModel && input.sequence % 4 === 0
        && typeof client?.selectDistrict === "function") {
        const districtOptions = (Array.isArray(initialReadModel.districts)
          ? initialReadModel.districts
          : []).filter((entry) => typeof entry?.districtId === "string");
        const nextDistrict = districtOptions.find((entry, index) => (
          entry.districtId !== initialReadModel.district?.districtId
          && index >= input.sequence % Math.max(1, districtOptions.length)
        )) ?? districtOptions.find((entry) => (
          entry.districtId !== initialReadModel.district?.districtId
        ));
        if (nextDistrict) {
          await client.selectDistrict(nextDistrict.districtId);
          selectedDistrictChanged = client.getCurrentReadModel?.()?.district?.districtId
            === nextDistrict.districtId;
        }
      }
      const readModel = client?.getCurrentReadModel?.() || initialReadModel;
      if (!readModel || typeof client?.submitCommand !== "function") {
        return unavailable("LOAD_ACTION_CLIENT_UNAVAILABLE");
      }
      const playerId = typeof readModel.player?.playerId === "string" ? readModel.player.playerId : "";
      const mode = typeof readModel.mode?.mode === "string"
        ? readModel.mode.mode
        : typeof readModel.player?.mode === "string" ? readModel.player.mode : "";
      const currentServerInstanceId = typeof readModel.server?.serverInstanceId === "string"
        ? readModel.server.serverInstanceId
        : typeof readModel.player?.instanceId === "string" ? readModel.player.instanceId : "";
      const focusDistrictId = typeof readModel.district?.districtId === "string"
        ? readModel.district.districtId
        : "";
      if (!playerId || !mode || !currentServerInstanceId || !focusDistrictId) {
        return unavailable("LOAD_ACTION_COMMAND_CONTEXT_MISSING");
      }
      if (currentServerInstanceId !== input.serverInstanceId) {
        return unavailable("LOAD_ACTION_INSTANCE_MISMATCH");
      }

      const candidates = [];
      const candidateKeys = new Set();
      const addCandidate = (action, payload) => {
        const key = `${action}:${JSON.stringify(payload)}`;
        if (candidateKeys.has(key)) return;
        candidateKeys.add(key);
        candidates.push({ action, payload });
      };
      const addOptionalNumber = (payload, key, value) => {
        if (Number.isInteger(value) && value >= 0) payload[key] = value;
      };

      const balances = readModel.player?.resourceBalances || {};
      for (const resource of Array.isArray(readModel.market?.resources) ? readModel.market.resources : []) {
        const resourceId = typeof resource?.id === "string" ? resource.id : "";
        const normalMarket = resource?.normalMarket;
        if (!resourceId || !normalMarket) continue;
        if (normalMarket.canBuy === true && Number(normalMarket.stock) >= 1) {
          addCandidate("buy-market-resource", {
            resourceId,
            amount: 1,
            marketType: "normal",
            paymentType: "cleanCash"
          });
        }
        if (normalMarket.canSell === true && Number(balances[resourceId]) >= 1) {
          addCandidate("sell-market-resource", { resourceId, amount: 1 });
        }
      }

      const district = readModel.district;
      if (district?.isOwnedByPlayer === true) {
        for (const slot of Array.isArray(district.slots) ? district.slots : []) {
          if (typeof slot?.buildingId !== "string") continue;
          if (slot.production?.canCollect === true && typeof slot.production.resourceKey === "string") {
            addCandidate("collect-production", {
              districtId: district.districtId,
              buildingId: slot.buildingId,
              resourceKey: slot.production.resourceKey
            });
          }
          for (const craft of Array.isArray(slot.craftOptions) ? slot.craftOptions : []) {
            if (craft?.canCraft !== true || typeof craft.recipeId !== "string") continue;
            addCandidate("craft-item", {
              districtId: district.districtId,
              buildingId: slot.buildingId,
              recipeId: craft.recipeId,
              quantity: 1
            });
          }
        }

        for (const building of Array.isArray(district.buildings) ? district.buildings : []) {
          if (typeof building?.buildingId !== "string") continue;
          for (const action of Array.isArray(building.actions) ? building.actions : []) {
            if (action?.enabled !== true || !Array.isArray(action.requiresInput) || action.requiresInput.length !== 0) continue;
            if (typeof action.actionId !== "string") continue;
            addCandidate("run-building-action", {
              districtId: district.districtId,
              buildingId: building.buildingId,
              actionId: action.actionId
            });
          }

          const productionGroups = [
            building.pharmacy?.lines,
            building.drugLab?.lines,
            building.factory?.productionLines,
            building.armory?.productionLines
          ];
          if (building.factory?.canCollect === true) {
            addCandidate("collect-production", {
              districtId: district.districtId,
              buildingId: building.buildingId
            });
          }
          for (const lines of productionGroups) {
            for (const line of Array.isArray(lines) ? lines : []) {
              const recipeId = typeof line?.recipeId === "string" ? line.recipeId : "";
              if (!recipeId) continue;
              if (line.canStart === true && (
                line.maxStartQuantity === undefined || Number(line.maxStartQuantity) >= 1
              )) {
                addCandidate("craft-item", {
                  districtId: district.districtId,
                  buildingId: building.buildingId,
                  recipeId,
                  quantity: 1
                });
              }
              if (line.canCollect === true) {
                const resourceKey = typeof line.resourceKey === "string" ? line.resourceKey : recipeId;
                addCandidate("collect-production", {
                  districtId: district.districtId,
                  buildingId: building.buildingId,
                  resourceKey
                });
              }
            }
          }
        }
      }

      const targetList = (key) => {
        const combined = [
          ...(Array.isArray(district?.targetActions?.[key]) ? district.targetActions[key] : []),
          ...(Array.isArray(district?.[key]) ? district[key] : [])
        ];
        return combined.filter((target, index) => combined.findIndex((candidate) => (
          candidate?.districtId === target?.districtId
        )) === index);
      };
      for (const target of targetList("spyTargets")) {
        if (target?.enabled !== true || typeof target.districtId !== "string" || typeof target.sourceDistrictId !== "string") continue;
        addCandidate("spy-district", {
          districtId: target.districtId,
          sourceDistrictId: target.sourceDistrictId
        });
      }
      for (const target of targetList("robTargets")) {
        if (target?.enabled !== true || typeof target.districtId !== "string" || typeof target.sourceDistrictId !== "string") continue;
        if (!Number.isInteger(target.expectedConflictRevision) || target.expectedConflictRevision < 0) continue;
        const payload = {
          targetDistrictId: target.districtId,
          sourceDistrictId: target.sourceDistrictId,
          expectedConflictRevision: target.expectedConflictRevision
        };
        addOptionalNumber(payload, "expectedTargetVersion", target.expectedTargetVersion);
        addOptionalNumber(payload, "expectedSourceVersion", target.expectedSourceVersion);
        addOptionalNumber(payload, "expectedLootPoolRevision", target.expectedLootPoolRevision);
        addCandidate("rob-district", payload);
      }
      for (const target of targetList("heistTargets")) {
        if (target?.enabled !== true || typeof target.districtId !== "string" || typeof target.sourceDistrictId !== "string") continue;
        if (!Number.isInteger(target.expectedConflictRevision) || target.expectedConflictRevision < 0) continue;
        const styles = (Array.isArray(target.styles) ? target.styles : []).filter((style) => style?.enabled !== false);
        const style = styles.find((candidate) => candidate.style === target.recommendedStyle)
          || styles.find((candidate) => candidate.style === "balanced")
          || styles[0];
        const gangMembersSent = Number(style?.defaultGangMembersSent);
        const availablePopulation = Number(target.availablePopulation ?? balances.population);
        if (!["stealth", "balanced", "all_in"].includes(style?.style)
          || !Number.isInteger(gangMembersSent)
          || gangMembersSent <= 0
          || !Number.isFinite(availablePopulation)
          || gangMembersSent > availablePopulation
          || (Number.isFinite(Number(style.minMembers)) && gangMembersSent < Number(style.minMembers))
          || (Number.isFinite(Number(style.maxMembers)) && gangMembersSent > Number(style.maxMembers))) continue;
        const payload = {
          targetDistrictId: target.districtId,
          sourceDistrictId: target.sourceDistrictId,
          style: style.style,
          gangMembersSent,
          expectedConflictRevision: target.expectedConflictRevision
        };
        addOptionalNumber(payload, "expectedTargetVersion", target.expectedTargetVersion);
        addOptionalNumber(payload, "expectedSourceVersion", target.expectedSourceVersion);
        addCandidate("heist-district", payload);
      }
      for (const target of targetList("occupyTargets")) {
        if (target?.enabled !== true || typeof target.districtId !== "string" || typeof target.sourceDistrictId !== "string") continue;
        if (!Number.isInteger(target.expectedConflictRevision) || target.expectedConflictRevision < 0) continue;
        addCandidate("occupy-district", {
          districtId: target.districtId,
          sourceDistrictId: target.sourceDistrictId,
          expectedConflictRevision: target.expectedConflictRevision
        });
      }
      const attackInventory = new Map((Array.isArray(readModel.player?.attackWeapons?.weapons)
        ? readModel.player.attackWeapons.weapons
        : []).map((weapon) => [weapon.resourceKey, Number(weapon.availableAmount)]));
      const attackPopulation = Number(readModel.player?.attackWeapons?.availablePopulation);
      for (const target of targetList("attackTargets")) {
        if (target?.enabled !== true || typeof target.districtId !== "string" || typeof target.sourceDistrictId !== "string") continue;
        if (!Number.isInteger(target.expectedConflictRevision) || target.expectedConflictRevision < 0) continue;
        const loadout = target.selectedLoadout && typeof target.selectedLoadout === "object"
          ? target.selectedLoadout
          : null;
        const loadoutEntries = loadout ? Object.entries(loadout) : [];
        const positiveEntries = loadoutEntries.filter(([, amount]) => Number(amount) > 0);
        const projectedPopulationCost = Number(target.projectedPopulationCost);
        const loadoutValid = positiveEntries.length > 0
          && loadoutEntries.every(([weaponId, amount]) => (
            attackInventory.has(weaponId)
            && Number.isInteger(Number(amount))
            && Number(amount) >= 0
            && Number(amount) <= attackInventory.get(weaponId)
          ))
          && Number.isFinite(attackPopulation)
          && Number.isFinite(projectedPopulationCost)
          && projectedPopulationCost > 0
          && projectedPopulationCost <= attackPopulation;
        if (!loadoutValid) continue;
        const payload = {
          districtId: target.districtId,
          sourceDistrictId: target.sourceDistrictId,
          weapons: Object.fromEntries(positiveEntries.map(([weaponId, amount]) => [weaponId, Number(amount)])),
          expectedConflictRevision: target.expectedConflictRevision
        };
        addOptionalNumber(payload, "expectedTargetVersion", target.expectedTargetVersion);
        addOptionalNumber(payload, "expectedSourceVersion", target.expectedSourceVersion);
        addCandidate("attack-district", payload);
      }

      if (input.allowCityChat && readModel.cityChat?.canSend === true) {
        const maximumLength = Math.floor(Number(readModel.cityChat.maxMessageLength));
        const body = `Load soak ${input.sequence}`.slice(0, Math.max(0, maximumLength));
        if (body) addCandidate("send-city-chat-message", { body });
      }

      const chooseCandidate = () => {
        const desired = candidates.filter((candidate) => candidate.action === desiredAction);
        if (desired.length > 0) return desired[input.sequence % desired.length];
        const availableWeights = input.weights.filter(({ action, weight }) => (
          Number(weight) > 0 && candidates.some((candidate) => candidate.action === action)
        ));
        const totalWeight = availableWeights.reduce((total, entry) => total + entry.weight, 0);
        if (totalWeight <= 0) return null;
        let slot = (input.sequence * 53) % totalWeight;
        const selectedWeight = availableWeights.find((entry) => {
          if (slot < entry.weight) return true;
          slot -= entry.weight;
          return false;
        });
        const fallback = candidates.filter((candidate) => candidate.action === selectedWeight?.action);
        return fallback.length > 0 ? fallback[input.sequence % fallback.length] : null;
      };
      const selected = chooseCandidate();
      if (!selected) {
        return {
          desiredAction,
          actualAction: null,
          outcome: "skipped",
          accepted: false,
          skipped: true,
          skipReason: "NO_ENABLED_SERVER_ACTION",
          errorCode: null,
          errorCodes: [],
          transportFailure: false,
          selectedDistrictChanged,
          durationMs: performance.now() - started
        };
      }

      const command = {
        id: `remote-load:${input.sequence}:${selected.action}`,
        type: selected.action,
        mode,
        playerId,
        serverInstanceId: currentServerInstanceId,
        issuedAt: new Date().toISOString(),
        payload: selected.payload,
        clientRequestId: null
      };
      try {
        const result = await client.submitCommand(command);
        const errorCodes = Array.isArray(result?.errors)
          ? result.errors.map((error) => String(error?.code || "").trim()).filter(Boolean)
          : [];
        const accepted = result?.accepted === true;
        return {
          desiredAction,
          actualAction: selected.action,
          outcome: accepted ? "accepted" : "error",
          accepted,
          skipped: false,
          errorCode: errorCodes[0] || null,
          errorCodes,
          transportFailure: result?.transportFailure === true,
          selectedDistrictChanged,
          durationMs: performance.now() - started
        };
      } catch {
        return unavailable("LOAD_ACTION_SUBMIT_THROWN", selected.action);
      }
    }, {
      desiredAction: desiredActionForSequence(sequence),
      sequence,
      serverInstanceId,
      weights: actionWeights,
      allowCityChat: index < remainingChatBudget
    });
  }));
  pressure.cityChatAttempts += outcomes.filter((entry) => (
    entry.actualAction === "send-city-chat-message" && entry.skipped !== true
  )).length;
  samples.actionOutcomes.push(...outcomes);
  samples.commandDurationsMs.push(...outcomes
    .filter((entry) => entry.actualAction && Number.isFinite(entry.durationMs))
    .map((entry) => entry.durationMs));
}

function desiredActionForSequence(sequence) {
  const totalWeight = actionWeights.reduce((total, entry) => total + entry.weight, 0);
  let slot = (sequence * 37) % totalWeight;
  for (const entry of actionWeights) {
    if (slot < entry.weight) return entry.action;
    slot -= entry.weight;
  }
  return actionWeights[0].action;
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
