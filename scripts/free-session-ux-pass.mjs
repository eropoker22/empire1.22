import "./require-node20.mjs";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const DEFAULT_URL = "http://127.0.0.1:5174/pages/game.html";
const BROWSER_CANDIDATES = [
  process.env.EMPIRE_BROWSER_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
].filter(Boolean);

const url = process.argv.find((arg) => arg.startsWith("--url="))?.slice("--url=".length) || DEFAULT_URL;
const timeoutMs = Number(process.argv.find((arg) => arg.startsWith("--timeout-ms="))?.slice("--timeout-ms=".length) || 90000);
const expectedRuntime = process.argv.find((arg) => arg.startsWith("--expect-runtime="))?.slice("--expect-runtime=".length) || "any";
const allowedRuntimeExpectations = new Set([
  "any",
  "demo-ready",
  "server-authoritative-ready",
  "legacy-fallback",
  "server-authoritative-error"
]);

if (!allowedRuntimeExpectations.has(expectedRuntime)) {
  throw new Error(`Unsupported --expect-runtime=${expectedRuntime}`);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function findBrowserPath() {
  return BROWSER_CANDIDATES.find((candidate) => existsSync(candidate)) || null;
}

async function startVite(targetUrl) {
  try {
    const response = await fetch(targetUrl, { method: "GET" });
    if (response.ok) {
      return {
        async stop() {}
      };
    }
  } catch {}

  const parsedUrl = new URL(targetUrl);
  const host = parsedUrl.hostname || "127.0.0.1";
  const port = parsedUrl.port || "5174";
  const child = spawn(process.execPath, [
    "scripts/run-local-bin.mjs",
    "vite/bin/vite.js",
    "--config",
    "vite.game.config.ts",
    "--host",
    host,
    "--port",
    port
  ], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  const output = [];
  child.stdout?.setEncoding("utf8");
  child.stderr?.setEncoding("utf8");
  child.stdout?.on("data", (chunk) => output.push(String(chunk).trim()));
  child.stderr?.on("data", (chunk) => output.push(String(chunk).trim()));

  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (child.exitCode !== null) {
      throw new Error(`Local gameplay dev server exited before smoke could start. Port ${port} may be in use.\n${output.slice(-20).join("\n")}`);
    }
    try {
      const response = await fetch(targetUrl, { method: "GET" });
      if (response.ok) {
        return {
          async stop() {
            if (child.exitCode === null && !child.killed) {
              child.kill();
              await Promise.race([
                once(child, "exit").catch(() => {}),
                delay(1500)
              ]);
            }
          }
        };
      }
    } catch {}
    await delay(300);
  }

  child.kill();
  throw new Error(`Timed out waiting for local gameplay dev server at ${targetUrl}.\n${output.slice(-20).join("\n")}`);
}

class CdpPipe {
  constructor(browserProcess) {
    this.browserProcess = browserProcess;
    this.writePipe = browserProcess.stdio[3];
    this.readPipe = browserProcess.stdio[4];
    this.nextId = 1;
    this.buffer = "";
    this.pending = new Map();
    this.waiters = [];

    this.readPipe.setEncoding("utf8");
    this.readPipe.on("data", (chunk) => this.handleData(chunk));
    this.readPipe.on("error", (error) => this.rejectAll(error));
    this.writePipe.on("error", (error) => this.rejectAll(error));
    browserProcess.on("exit", (code, signal) => {
      this.rejectAll(new Error(`Browser exited before CDP completed: code=${code} signal=${signal}`));
    });
  }

  handleData(chunk) {
    this.buffer += chunk;
    let separatorIndex = this.buffer.indexOf("\0");
    while (separatorIndex >= 0) {
      const raw = this.buffer.slice(0, separatorIndex);
      this.buffer = this.buffer.slice(separatorIndex + 1);
      separatorIndex = this.buffer.indexOf("\0");
      if (!raw.trim()) {
        continue;
      }
      let message;
      try {
        message = JSON.parse(raw);
      } catch (error) {
        this.rejectAll(error);
        continue;
      }
      this.handleMessage(message);
    }
  }

  handleMessage(message) {
    if (message.id && this.pending.has(message.id)) {
      const { resolve, reject, timer } = this.pending.get(message.id);
      clearTimeout(timer);
      this.pending.delete(message.id);
      if (message.error) {
        reject(new Error(`${message.error.message || "CDP error"} ${JSON.stringify(message.error.data || "")}`));
      } else {
        resolve(message.result || {});
      }
      return;
    }

    for (const waiter of [...this.waiters]) {
      if (waiter.method !== message.method) {
        continue;
      }
      if (waiter.sessionId && waiter.sessionId !== message.sessionId) {
        continue;
      }
      if (waiter.predicate && !waiter.predicate(message)) {
        continue;
      }
      clearTimeout(waiter.timer);
      this.waiters = this.waiters.filter((entry) => entry !== waiter);
      waiter.resolve(message);
    }
  }

  rejectAll(error) {
    for (const { reject, timer } of this.pending.values()) {
      clearTimeout(timer);
      reject(error);
    }
    this.pending.clear();
    for (const waiter of this.waiters) {
      clearTimeout(waiter.timer);
      waiter.reject(error);
    }
    this.waiters = [];
  }

  send(method, params = {}, sessionId = null, commandTimeoutMs = 30000) {
    const id = this.nextId++;
    const payload = sessionId ? { id, method, params, sessionId } : { id, method, params };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timed out waiting for CDP command ${method}`));
      }, commandTimeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.writePipe.write(`${JSON.stringify(payload)}\0`);
    });
  }

  waitForEvent(method, { sessionId = null, predicate = null, timeout = 30000 } = {}) {
    return new Promise((resolve, reject) => {
      const waiter = {
        method,
        sessionId,
        predicate,
        resolve,
        reject,
        timer: setTimeout(() => {
          this.waiters = this.waiters.filter((entry) => entry !== waiter);
          reject(new Error(`Timed out waiting for CDP event ${method}`));
        }, timeout)
      };
      this.waiters.push(waiter);
    });
  }
}

async function evaluate(cdp, sessionId, expression, timeout = 30000) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true
  }, sessionId, timeout);

  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "Runtime.evaluate failed");
  }
  return result.result?.value;
}

async function navigate(cdp, sessionId, targetUrl) {
  const loadEvent = cdp.waitForEvent("Page.loadEventFired", { sessionId, timeout: 30000 });
  await cdp.send("Page.navigate", { url: targetUrl }, sessionId);
  await loadEvent;
}

async function waitForRuntime(cdp, sessionId, timeout = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeout) {
    const state = await evaluate(cdp, sessionId, String.raw`
      (() => ({
        legacyReady: Boolean(window.EmpireRuntime && window.empireStreetsDistrictState && document.querySelector("#game-root")?.dataset?.runtimeInit === "ready"),
        gameplayRuntime: document.body?.dataset?.gameplayRuntime || "",
        gameplayServerRuntime: document.body?.dataset?.gameplayServerRuntime || "",
        gameplayFallback: document.body?.dataset?.gameplayFallback || "",
        sliceRuntime: document.querySelector("[data-gameplay-slice-client]")?.dataset?.gameplayRuntime || "",
        sliceServerRuntime: document.querySelector("[data-gameplay-slice-client]")?.dataset?.gameplayServerRuntime || "",
        sliceUnavailable: document.querySelector("[data-gameplay-slice-client]")?.dataset?.gameplaySliceUnavailable || ""
      }))()
    `, 10000);
    if (state?.legacyReady && state?.gameplayRuntime) {
      return state;
    }
    await delay(250);
  }
  return null;
}

async function collectRuntimeDiagnostics(cdp, sessionId, {
  pageMessages = [],
  failedRequests = [],
  apiResponses = [],
  seed = null
} = {}) {
  const pageState = await evaluate(cdp, sessionId, String.raw`
    (() => {
      const sessionRaw = localStorage.getItem("empireStreets.session.v1");
      let session = null;
      try {
        session = sessionRaw ? JSON.parse(sessionRaw) : null;
      } catch {}
      const sliceRoot = document.querySelector("[data-gameplay-slice-client]");
      return {
        url: location.href,
        hasSession: Boolean(sessionRaw),
        session: session ? {
          identity: session.registration?.identity || "",
          serverId: session.registration?.serverId || session.registration?.activeServerId || "",
          serverInstanceId: session.registration?.serverInstanceId || session.registration?.activeServerInstanceId || "",
          factionId: session.registration?.factionId || session.registration?.selectedFaction || "",
          startDistrictId: session.registration?.startDistrictId || session.registration?.preferredStartDistrictId || null
        } : null,
        legacyRuntimeInit: document.querySelector("#game-root")?.dataset?.runtimeInit || "",
        gameplayRuntime: document.body?.dataset?.gameplayRuntime || "",
        gameplayServerRuntime: document.body?.dataset?.gameplayServerRuntime || "",
        gameplayFallback: document.body?.dataset?.gameplayFallback || "",
        sliceRuntime: sliceRoot?.dataset?.gameplayRuntime || "",
        sliceServerRuntime: sliceRoot?.dataset?.gameplayServerRuntime || "",
        sliceUnavailable: sliceRoot?.dataset?.gameplaySliceUnavailable || "",
        sliceError: sliceRoot?.dataset?.gameplaySliceError || "",
        loadEndpoint: sliceRoot?.dataset?.gameplaySliceEndpoint || ""
      };
    })()
  `, 10000).catch((error) => ({
    url: "",
    evaluateError: error instanceof Error ? error.message : String(error)
  }));

  return {
    ...pageState,
    expectedRuntime,
    seed,
    gameplaySliceLoad: apiResponses.find((entry) => entry.url.includes("/api/gameplay-slice/load")) || null,
    apiResponses: apiResponses.slice(-10),
    failedApiRequests: failedRequests.filter((entry) => entry.url.includes("/api/")).slice(-10),
    consoleErrors: pageMessages.filter((entry) => ["error", "warning", "assert"].includes(entry.type)).slice(-20)
  };
}

function createDiagnosticError(message, diagnostics) {
  return new Error(`${message}\nDiagnostics: ${JSON.stringify(diagnostics, null, 2)}`);
}

function isExpectedGameUrl(expectedUrl, actualUrl) {
  try {
    const expected = new URL(expectedUrl);
    const actual = new URL(actualUrl);
    return expected.origin === actual.origin && expected.pathname === actual.pathname;
  } catch {
    return false;
  }
}

async function waitForRuntimeWithPlaywright(page, timeout = 30000) {
  await page.waitForFunction(() => {
    const root = document.querySelector("#game-root");
    const marker = document.body?.dataset?.gameplayRuntime || "";
    return Boolean(
      window.EmpireRuntime
      && window.empireStreetsDistrictState
      && root?.dataset?.runtimeInit === "ready"
      && marker
      && marker !== "initializing"
    );
  }, null, { timeout });

  return page.evaluate(String.raw`
    (() => ({
      legacyReady: Boolean(window.EmpireRuntime && window.empireStreetsDistrictState && document.querySelector("#game-root")?.dataset?.runtimeInit === "ready"),
      gameplayRuntime: document.body?.dataset?.gameplayRuntime || "",
      gameplayServerRuntime: document.body?.dataset?.gameplayServerRuntime || "",
      gameplayFallback: document.body?.dataset?.gameplayFallback || "",
      sliceRuntime: document.querySelector("[data-gameplay-slice-client]")?.dataset?.gameplayRuntime || "",
      sliceServerRuntime: document.querySelector("[data-gameplay-slice-client]")?.dataset?.gameplayServerRuntime || "",
      sliceUnavailable: document.querySelector("[data-gameplay-slice-client]")?.dataset?.gameplaySliceUnavailable || ""
    }))()
  `);
}

async function collectPlaywrightDiagnostics(page, {
  pageMessages = [],
  failedRequests = [],
  apiResponses = [],
  seed = null
} = {}) {
  const pageState = await page.evaluate(String.raw`
    (() => {
      const sessionRaw = localStorage.getItem("empireStreets.session.v1");
      let session = null;
      try {
        session = sessionRaw ? JSON.parse(sessionRaw) : null;
      } catch {}
      const sliceRoot = document.querySelector("[data-gameplay-slice-client]");
      return {
        url: location.href,
        hasSession: Boolean(sessionRaw),
        session: session ? {
          identity: session.registration?.identity || "",
          serverId: session.registration?.serverId || session.registration?.activeServerId || "",
          serverInstanceId: session.registration?.serverInstanceId || session.registration?.activeServerInstanceId || "",
          factionId: session.registration?.factionId || session.registration?.selectedFaction || "",
          startDistrictId: session.registration?.startDistrictId || session.registration?.preferredStartDistrictId || null
        } : null,
        legacyRuntimeInit: document.querySelector("#game-root")?.dataset?.runtimeInit || "",
        gameplayRuntime: document.body?.dataset?.gameplayRuntime || "",
        gameplayServerRuntime: document.body?.dataset?.gameplayServerRuntime || "",
        gameplayFallback: document.body?.dataset?.gameplayFallback || "",
        sliceRuntime: sliceRoot?.dataset?.gameplayRuntime || "",
        sliceServerRuntime: sliceRoot?.dataset?.gameplayServerRuntime || "",
        sliceUnavailable: sliceRoot?.dataset?.gameplaySliceUnavailable || "",
        sliceError: sliceRoot?.dataset?.gameplaySliceError || "",
        loadEndpoint: sliceRoot?.dataset?.gameplaySliceEndpoint || ""
      };
    })()
  `).catch((error) => ({
    url: "",
    evaluateError: error instanceof Error ? error.message : String(error)
  }));

  return {
    ...pageState,
    expectedRuntime,
    seed,
    gameplaySliceLoad: apiResponses.find((entry) => entry.url.includes("/api/gameplay-slice/load")) || null,
    apiResponses: apiResponses.slice(-10),
    failedApiRequests: failedRequests.filter((entry) => entry.url.includes("/api/")).slice(-10),
    consoleErrors: pageMessages.filter((entry) => ["error", "warning", "assert"].includes(entry.type)).slice(-20)
  };
}

async function runWithPlaywright() {
  const browserPath = findBrowserPath();
  if (!browserPath) {
    throw new Error("Chrome/Edge executable not found.");
  }

  const pageMessages = [];
  const failedRequests = [];
  const apiResponses = [];
  let server = null;
  let browser = null;

  try {
    server = await startVite(url);
    browser = await chromium.launch({
      executablePath: browserPath,
      headless: true
    });
    const page = await browser.newPage();

    page.on("console", (message) => {
      const text = message.text();
      const locationUrl = message.location().url || "";
      if (/favicon\.ico/i.test(`${text} ${locationUrl}`)) {
        return;
      }
      pageMessages.push({
        type: message.type(),
        text: text.slice(0, 500),
        url: locationUrl
      });
    });
    page.on("requestfailed", (request) => {
      failedRequests.push({
        url: request.url(),
        errorText: request.failure()?.errorText || "",
        type: request.resourceType()
      });
    });
    page.on("response", (response) => {
      if (!response.url().includes("/api/")) {
        return;
      }
      apiResponses.push({
        url: response.url(),
        status: response.status(),
        mimeType: response.headers()["content-type"] || ""
      });
    });

    await page.addInitScript(seedExpression);
    await page.goto(url, { waitUntil: "load", timeout: timeoutMs });
    const seed = await page.evaluate(sessionSnapshotExpression);
    const currentUrl = page.url();
    if (!isExpectedGameUrl(url, currentUrl)) {
      throw createDiagnosticError(
        "Game page redirected before the seeded session reached the auth guard.",
        await collectPlaywrightDiagnostics(page, { pageMessages, failedRequests, apiResponses, seed })
      );
    }

    const ready = await waitForRuntimeWithPlaywright(page, 30000).catch(async () => {
      throw createDiagnosticError(
        "Game runtime did not reach ready state.",
        await collectPlaywrightDiagnostics(page, { pageMessages, failedRequests, apiResponses, seed })
      );
    });

    const result = await page.evaluate(passExpression);
    result.seed = seed;
    result.runtimeReady = ready;
    result.api = {
      gameplaySliceLoad: apiResponses.find((entry) => entry.url.includes("/api/gameplay-slice/load")) || null,
      gameplaySliceSubmit: apiResponses.find((entry) => entry.url.includes("/api/gameplay-slice/submit")) || null,
      responses: apiResponses.slice(-10),
      failedRequests: failedRequests.slice(-10)
    };
    result.console = pageMessages
      .filter((entry) => ["error", "warning", "assert"].includes(entry.type))
      .filter((entry) => !(
        (expectedRuntime === "server-authoritative-error" || expectedRuntime === "demo-ready")
        && entry.type === "warning"
        && String(entry.text || "").includes("[gameplay-slice] Server-authoritative runtime failed")
      ))
      .slice(0, 20);
    result.browserStderr = [];
    result.validationFailures = validatePassResult(result);
    console.log(JSON.stringify(result, null, 2));
    if (result.validationFailures.length > 0) {
      throw new Error(`Free-session UX pass failed validation: ${result.validationFailures.join("; ")}`);
    }
  } finally {
    await browser?.close().catch(() => {});
    await server?.stop().catch(() => {});
  }
}

const seedExpression = String.raw`
(() => {
  const now = new Date().toISOString();
  const serverInstanceId = "instance:free:eu-central:public-1";
  localStorage.clear();
  localStorage.setItem("empire:active_guest_mode", "free");
  localStorage.setItem("empire:active_mode", "free");

  const session = {
    registration: {
      identity: "Manual UX Boss",
      gangName: "Manual UX Crew",
      isGuest: true,
      loginKind: "guest",
      activeServerId: serverInstanceId,
      activeServerInstanceId: serverInstanceId,
      activeServerName: "Neon Docks FREE-01",
      activeServerMode: "free",
      activeServerRegion: "EU Central",
      activeServerStatus: "ONLINE",
      serverId: serverInstanceId,
      serverInstanceId,
      serverLabel: "Neon Docks FREE-01",
      serverMode: "free",
      serverRegion: "EU Central",
      preferredStartDistrictId: 1,
      startDistrictId: 1,
      factionId: "mafian",
      selectedFaction: "mafian",
      structure: "mafián",
      selectedStructure: "mafián",
      factionLocked: true,
      hasCompletedServerEntry: true,
      serverRegistrationStatus: "faction_locked",
      gangColor: "#67e8f9",
      lastLoginAt: now,
      lobbyLockedAt: now,
      lockedAt: now
    },
    world: {
      ownedDistrictIds: [1],
      phaseState: {
        gamePhase: "live",
        mapPhase: "night",
        cityMinutes: 1334
      },
      destroyedDistrictIds: [],
      districtDefenseById: {
        28: 15,
        29: 20
      },
      districtDefenseLoadoutById: {},
      districtDefenseResidentsById: {},
      districtTrapById: {},
      districtGossipById: {},
      districtPoliceActionById: {}
    },
    inventory: {
      weapons: {
        "baseball-bat": 6,
        pistol: 4
      },
      materials: {
        chemicals: 8,
        biomass: 8
      },
      factorySupplies: {
        metalParts: 20,
        techCore: 8,
        combatModule: 0
      }
    },
    economy: {
      cleanMoney: 5000,
      dirtyMoney: 2500
    },
    gang: {
      members: 24,
      heat: 35,
      influence: 25,
      policeRaidProtectionUntil: 0,
      autoPoliceNextActionAt: 0,
      heatJournal: [],
      dirtyHeatReductionTimestamps: [],
      lastHeatDecayAt: now
    },
    missions: {
      attackOrders: [],
      occupyOrders: [],
      robberyOrders: [],
      spy: {
        available: 3,
        missions: []
      },
      spyIntel: {
        occupiableDistrictIds: [],
        revealedTypeDistrictIds: [],
        revealedDefenseDistrictIds: []
      }
    },
    production: {
      jobs: {},
      factory: {
        level: 1,
        resources: {},
        slots: [],
        boosts: { active: null },
        updatedAt: Date.now()
      },
      buildings: {
        pharmacy: { level: 1 },
        druglab: { level: 1 },
        armory: { level: 1 }
      }
    }
  };
  localStorage.setItem("empireStreets.session.v1", JSON.stringify(session));
  localStorage.setItem("empireStreets.session.free.instance-free-eu-central-public-1.v1", JSON.stringify(session));
  return {
    mode: session.registration.serverMode,
    serverId: session.registration.serverId,
    serverInstanceId: session.registration.serverInstanceId,
    startDistrictId: session.registration.startDistrictId,
    ownedDistrictIds: session.world.ownedDistrictIds
  };
})()
`;

const sessionSnapshotExpression = String.raw`
(() => {
  const raw = localStorage.getItem("empireStreets.session.v1");
  if (!raw) {
    return { hasSession: false };
  }
  try {
    const session = JSON.parse(raw);
    return {
      hasSession: true,
      identity: session.registration?.identity || "",
      serverId: session.registration?.serverId || "",
      serverInstanceId: session.registration?.serverInstanceId || "",
      factionId: session.registration?.factionId || "",
      startDistrictId: session.registration?.startDistrictId || null,
      ownedDistrictIds: Array.isArray(session.world?.ownedDistrictIds) ? session.world.ownedDistrictIds : []
    };
  } catch {
    return { hasSession: true, parseError: true };
  }
})()
`;

const passExpression = String.raw`
(async () => {
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const safeText = (selector, max = 500) => String(document.querySelector(selector)?.innerText || "").trim().slice(0, max);
  const isVisible = (element) => Boolean(element && !element.hidden && !element.classList?.contains("hidden"));
  const visibleModalText = (selector, max = 700) => {
    const element = document.querySelector(selector);
    return isVisible(element) ? String(element.innerText || "").trim().slice(0, max) : "";
  };
  const safeActionStatusText = (max = 650) => [
    safeText("[data-building-action-state]", 120),
    safeText("[data-building-action-summary]", 420),
    safeText("[data-building-action-meta]", 180)
  ].filter(Boolean).join("\n").slice(0, max);
  const getOnboardingProgress = () => window.EmpireRuntime?.getFreeSessionOnboardingProgress?.(root)
    || window.EmpireRuntimeModules?.onboarding?.getProgress?.(root)
    || null;
  const advanceOnboardingIfCurrent = async (stepId) => {
    const progress = getOnboardingProgress();
    if (String(progress?.currentStepId || "") !== stepId) {
      return false;
    }
    const button = document.querySelector("[data-free-onboarding-panel] [data-onboarding-primary-action]");
    if (!button) {
      return false;
    }
    button.click();
    await wait(240);
    return true;
  };
  const root = document.querySelector("#game-root");
  const mapGeometry = await import("/page-assets/js/app/map/mapGeometry.js");
  const runtimeModule = await import("/page-assets/js/app/runtime.js");
  const events = [];
  const eventNames = [
    "empire:district-opened",
    "empire:building-opened",
    "empire:action-result",
    "empire:spy-started",
    "empire:attack-started",
    "empire:result-modal-opened",
    "empire:heat-changed",
    "empire:police-feedback"
  ];
  for (const name of eventNames) {
    document.addEventListener(name, (event) => {
      const detail = event?.detail || {};
      const mission = detail.mission || detail.order || {};
      events.push({
        name,
        detailKind: detail.kind || detail.type || "",
        detailKeys: Object.keys(detail || {}).slice(0, 10),
        sourceDistrictId: detail.sourceDistrictId ?? mission.sourceDistrictId ?? "",
        targetDistrictId: detail.targetDistrictId ?? mission.targetDistrictId ?? "",
        resolveAt: detail.resolveAt ?? mission.resolveAt ?? mission.returnAt ?? "",
        status: detail.status ?? mission.status ?? ""
      });
    });
  }

  const result = {
    bootstrap: root?.dataset?.runtimeInit || "",
    url: location.href,
    bodyLength: document.body.innerText.trim().length,
    handlers: {},
    missingHandlers: [],
    session: {},
    ui: {},
    actions: {},
    selected: {},
    modals: {},
    missions: {},
    events,
    errors: []
  };
  result.runtime = {
    marker: document.body?.dataset?.gameplayRuntime || "",
    serverRuntime: document.body?.dataset?.gameplayServerRuntime || "",
    fallback: document.body?.dataset?.gameplayFallback || "",
    sliceMarker: document.querySelector("[data-gameplay-slice-client]")?.dataset?.gameplayRuntime || "",
    sliceServerRuntime: document.querySelector("[data-gameplay-slice-client]")?.dataset?.gameplayServerRuntime || "",
    sliceUnavailable: document.querySelector("[data-gameplay-slice-client]")?.dataset?.gameplaySliceUnavailable || "",
    legacyRuntimeInit: root?.dataset?.runtimeInit || ""
  };

  for (const name of [
    "selectDistrict",
    "openDistrict",
    "openBuildingDetail",
    "collectProduction",
    "runBuildingAction",
    "craftItem",
    "openMarket",
    "buyMarketItem",
    "sellMarketItem",
    "openAttackPanel",
    "startAttack",
    "openSpyPanel",
    "startSpy",
    "showToast",
    "openPlayerProfile",
    "acknowledgePendingRaid"
  ]) {
    result.handlers[name] = typeof window[name] === "function";
    if (!result.handlers[name]) {
      result.missingHandlers.push(name);
    }
  }

  const initialState = window.EmpireRuntime?.hydrateInitialState?.(root) || {};
  const ownedDistrictIds = Array.from(initialState.world?.ownedDistrictIds || []).map(Number).filter(Boolean);
  const ownDistrictId = ownedDistrictIds[0] || Number(initialState.registration?.startDistrictId || 27);
  const districtApi = window.empireStreetsDistrictState;
  const knownDistricts = Array.from({ length: 80 }, (_, index) => districtApi?.getDistrictById?.(index + 1)).filter(Boolean);
  const geometry = mapGeometry.createDistrictGeometry(1200, 720, 0, 0, 0);
  const adjacentEnemyIds = mapGeometry.getAdjacentDistrictIdsFromGeometry(geometry, ownDistrictId)
    .map(Number)
    .filter((districtId) => districtId > 0 && !ownedDistrictIds.includes(districtId));
  const enemyDistrict = adjacentEnemyIds.map((districtId) => districtApi?.getDistrictById?.(districtId)).find(Boolean)
    || knownDistricts.find((district) => !ownedDistrictIds.includes(Number(district.id)) && Number(district.id) !== ownDistrictId)
    || districtApi?.getDistrictById?.(28)
    || null;
  const enemyDistrictId = Number(enemyDistrict?.id || 28);

  result.session = {
    mode: initialState.registration?.serverMode || "",
    serverId: initialState.registration?.serverId || "",
    factionId: initialState.registration?.factionId || "",
    startDistrictId: Number(initialState.registration?.startDistrictId || 0),
    ownedDistrictIds,
    demoActive: Boolean(window.EmpireRuntime?.isDemoScenarioMode?.(initialState.registration || {}))
  };
  result.ui = {
    onboardingVisible: Boolean(document.querySelector("[data-free-onboarding-panel]")),
    onboardingText: safeText("[data-free-onboarding-panel]", 350),
    actionFeedVisible: Boolean(document.querySelector("[data-building-action-feed]")),
    actionFeedText: safeText("[data-building-action-feed]", 450),
    policeFeedVisible: Boolean(document.querySelector("[data-police-feed]")),
    policeFeedText: safeText("[data-police-feed]", 350),
    gangStarsText: safeText("[data-gang-stars]", 120),
    storageButtonVisible: Boolean(document.querySelector("[data-storage-popup-open]")),
    wantedPopupExists: Boolean(document.querySelector("[data-wanted-popup]"))
  };

  const onboardingStartButton = document.querySelector("[data-free-onboarding-panel] [data-onboarding-primary-action]");
  result.actions.startOnboarding = Boolean(onboardingStartButton);
  onboardingStartButton?.click?.();
  await wait(180);
  result.ui.onboardingTextAfterStart = safeText("[data-free-onboarding-panel]", 350);

  result.actions.openOwnDistrict = Boolean(window.openDistrict?.(ownDistrictId));
  await wait(350);
  const buildingButtons = Array.from(document.querySelectorAll("[data-district-building-name]"));
  const buildingButton = buildingButtons.find((button) => /restaurace/i.test(String(button?.dataset?.districtBuildingName || button?.textContent || "")))
    || buildingButtons[0]
    || null;
  const buildingName = String(buildingButton?.dataset?.districtBuildingName || buildingButton?.textContent || "").trim().split("\n")[0];
  result.selected.ownDistrictId = ownDistrictId;
  result.selected.enemyDistrictId = enemyDistrictId;
  result.selected.firstBuildingName = buildingName;
  result.selected.districtPopupText = safeText("#district-popup, [data-district-popup]", 450);

  result.actions.openBuildingDetail = buildingName ? Boolean(window.openBuildingDetail?.(ownDistrictId, buildingName)) : false;
  await wait(350);
  result.ui.buildingDetailVisible = Boolean(document.querySelector("[data-district-building-detail-popup]:not([hidden])"));
  result.ui.buildingDetailText = safeText("[data-district-building-detail-popup]", 450);

  result.actions.collectProduction = Boolean(window.collectProduction?.());
  await wait(350);
  result.actions.runBuildingAction = Boolean(window.runBuildingAction?.(0));
  await wait(200);
  result.ui.buildingActionConfirmText = visibleModalText(".building-special-action-confirm:not([hidden])", 650);
  const buildingActionConfirm = document.querySelector(".building-special-action-confirm:not([hidden]) .building-special-action-confirm__button--confirm:not(:disabled)");
  result.actions.confirmBuildingAction = Boolean(buildingActionConfirm);
  if (buildingActionConfirm) {
    buildingActionConfirm.click();
    await wait(550);
  } else {
    document.querySelector(".building-special-action-confirm:not([hidden]) .building-special-action-confirm__button--ghost")?.click?.();
    await wait(350);
  }
  result.actions.advanceHeatPoliceOnboarding = await advanceOnboardingIfCurrent("heat-police");
  result.ui.actionFeedTextAfterBuildingAction = safeText("[data-building-action-feed]", 550);
  result.ui.actionSummaryAfterBuildingAction = safeText("[data-building-action-summary]", 550);
  result.ui.actionMetaAfterBuildingAction = safeText("[data-building-action-meta]", 220);
  result.ui.actionStatusAfterBuildingAction = safeActionStatusText();
  const storageButton = document.querySelector("[data-storage-popup-open]");
  storageButton?.click?.();
  await wait(250);
  result.ui.storageVisible = Boolean(document.querySelector("[data-storage-popup]:not([hidden])"));
  result.ui.storageText = safeText("[data-storage-popup]", 350);
  result.actions.craftItem = Boolean(window.craftItem?.());
  await wait(350);
  result.ui.topbarText = safeText(".game-topbar, #game-topbar, header", 350);
  result.ui.cleanMoneyText = safeText("[data-topbar-clean-money]", 80);
  result.ui.dirtyMoneyText = safeText("[data-topbar-dirty-money]", 80);

  result.actions.openEnemyDistrict = Boolean(window.openDistrict?.(enemyDistrictId));
  await wait(350);
  result.selected.enemyPopupText = safeText("#district-popup, [data-district-popup]", 450);
  result.actions.openSpyPanel = Boolean(window.openSpyPanel?.(enemyDistrictId));
  await wait(250);
  result.actions.startSpy = Boolean(window.startSpy?.(enemyDistrictId));
  await wait(result.actions.startSpy ? 900 : 800);
  result.ui.spyStatusAfterStart = safeActionStatusText();
  const spyStartedEvent = events.find((event) => event.name === "empire:spy-started");
  result.missions.spyStarted = Boolean(spyStartedEvent);
  result.missions.spyTargetDistrictId = spyStartedEvent?.targetDistrictId ?? "";
  result.missions.spyResolveAt = spyStartedEvent?.resolveAt ?? "";
  result.modals.spyReport = visibleModalText("#spy-result-modal, #spy-warning-modal", 550);
  document.querySelector("#spy-result-modal-ok, #spy-warning-modal-ok")?.click?.();
  await wait(250);

  result.actions.openAttackPanel = Boolean(window.openAttackPanel?.(enemyDistrictId));
  await wait(250);
  const attackInput = document.querySelector('[data-attack-weapon-input="baseball-bat"]')
    || document.querySelector('[data-attack-weapon-input="pistol"]');
  if (attackInput) {
    attackInput.value = "2";
    attackInput.dispatchEvent(new Event("input", { bubbles: true }));
    attackInput.dispatchEvent(new Event("change", { bubbles: true }));
  }
  await wait(250);
  result.actions.startAttack = Boolean(window.startAttack?.(enemyDistrictId));
  await wait(result.actions.startAttack ? 900 : 800);
  result.ui.attackStatusAfterStart = safeActionStatusText();
  const attackStartedEvent = events.find((event) => event.name === "empire:attack-started");
  result.missions.attackStarted = Boolean(attackStartedEvent);
  result.missions.attackTargetDistrictId = attackStartedEvent?.targetDistrictId ?? "";
  result.missions.attackResolveAt = attackStartedEvent?.resolveAt ?? "";
  result.modals.attackReport = visibleModalText("#attack-result-modal", 700);
  result.modals.policeAction = visibleModalText("#police-action-result-modal", 450);
  result.actions.completeDoneOnboarding = await advanceOnboardingIfCurrent("done");

  runtimeModule.setStoredGangState({
    heat: 155,
    heatJournal: [
      {
        type: "rise",
        amount: 120,
        reason: "Manual UX police threat",
        createdAt: new Date().toISOString()
      }
    ]
  });
  window.EmpireRuntime?.refreshAllUi?.(window.EmpireRuntime?.hydrateInitialState?.(root));
  document.dispatchEvent(new CustomEvent("empire:gang-state-changed", { detail: { heat: 155 } }));
  document.dispatchEvent(new CustomEvent("empire:heat-changed", { detail: { heat: 155, message: "Manual UX police threat" } }));
  document.dispatchEvent(new CustomEvent("empire:police-state-changed", { detail: { heat: 155 } }));
  await wait(500);
  result.ui.policeFeedAfterHeat = safeText("[data-police-feed]", 450);
  result.ui.gangStarsPoliceThreat = document.querySelector("[data-gang-stars]")?.dataset?.policeThreat || "";
  result.ui.gangStarsPoliceThreatClass = Boolean(document.querySelector("[data-gang-stars]")?.classList?.contains("is-police-threat"));
  result.ui.activeThreatStars = document.querySelectorAll("[data-gang-stars] .is-active.is-police-threat").length;
  result.ui.policeFeedRisk = document.querySelector("[data-police-feed]")?.dataset?.policeRisk || "";

  for (const modalId of ["spy-result-modal", "attack-result-modal", "police-action-result-modal"]) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.hidden = true;
      modal.classList?.add?.("hidden");
    }
  }

  const longJournalReason = "Dlouhé upozornění policejního tlaku po hlučné akci, dirty cash přesunu a svědeckých hlášeních v okolí districtu";
  runtimeModule.setStoredGangState({
    heat: 155,
    heatJournal: [
      ...Array.from({ length: 5 }, (_, index) => ({
        type: "rise",
        amount: 6 + index,
        reason: longJournalReason + " #" + (index + 1),
        createdAt: new Date(Date.now() - index * 60_000).toISOString()
      })),
      ...Array.from({ length: 4 }, (_, index) => ({
        type: "fall",
        amount: 4 + index,
        reason: "Dlouhé vysvětlení poklesu heat po zahlazení stop, vyčištění části hotovosti a utlumení hlídek #" + (index + 1),
        createdAt: new Date(Date.now() - (index + 8) * 60_000).toISOString()
      }))
    ]
  });
  window.EmpireRuntime?.refreshAllUi?.(window.EmpireRuntime?.hydrateInitialState?.(root));
  document.querySelector("[data-gang-heat]")?.click?.();
  await wait(250);
  const collectHeatListMetrics = (selector) => {
    const list = document.querySelector(selector);
    const firstReason = list?.querySelector?.(".wanted-popup-item strong");
    const styles = list ? getComputedStyle(list) : null;
    const reasonStyles = firstReason ? getComputedStyle(firstReason) : null;
    return {
      exists: Boolean(list),
      overflowY: styles?.overflowY || "",
      maxHeight: styles?.maxHeight || "",
      clientHeight: list?.clientHeight || 0,
      scrollHeight: list?.scrollHeight || 0,
      scrollbarNeeded: Boolean(list && list.scrollHeight > list.clientHeight + 1),
      firstReasonText: String(firstReason?.textContent || ""),
      firstReasonClientHeight: firstReason?.clientHeight || 0,
      firstReasonScrollHeight: firstReason?.scrollHeight || 0,
      firstReasonWhiteSpace: reasonStyles?.whiteSpace || "",
      firstReasonOverflow: reasonStyles?.overflow || "",
      firstReasonTextOverflow: reasonStyles?.textOverflow || ""
    };
  };
  const policeToggle = document.querySelector("[data-wanted-popup-police-toggle]");
  const policeToggleStyle = policeToggle ? getComputedStyle(policeToggle) : null;
  const getRect = (element) => {
    const rect = element?.getBoundingClientRect?.();
    if (!rect) return null;
    return {
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      left: rect.left,
      width: rect.width,
      height: rect.height
    };
  };
  result.ui.wantedPopupVisible = Boolean(document.querySelector("[data-wanted-popup]:not([hidden])"));
  result.ui.wantedRiseListMetrics = collectHeatListMetrics("[data-wanted-popup-rise-list]");
  result.ui.wantedFallListMetrics = collectHeatListMetrics("[data-wanted-popup-fall-list]");
  result.ui.wantedPoliceToggleMetrics = {
    width: policeToggle?.clientWidth || 0,
    height: policeToggle?.clientHeight || 0,
    backgroundImage: policeToggleStyle?.backgroundImage || "",
    color: policeToggleStyle?.color || ""
  };
  policeToggle?.click?.();
  await wait(120);
  const policeWindow = document.querySelector("[data-wanted-popup-police-window]");
  const policeClose = document.querySelector("[data-wanted-popup-police-close]");
  const policeWindowStyle = policeWindow ? getComputedStyle(policeWindow) : null;
  const policeWindowRect = getRect(policeWindow);
  const policeCloseRect = getRect(policeClose);
  const policeToggleRect = getRect(policeToggle);
  const policeWindowCenterElement = policeWindowRect
    ? document.elementFromPoint(
        policeWindowRect.left + Math.min(policeWindowRect.width - 8, Math.max(8, policeWindowRect.width / 2)),
        policeWindowRect.top + Math.min(policeWindowRect.height - 8, Math.max(8, policeWindowRect.height / 2))
      )
    : null;
  result.ui.wantedPoliceWindowMetrics = {
    visible: Boolean(policeWindow && !policeWindow.hidden && policeWindowStyle?.display !== "none"),
    top: policeWindowRect?.top ?? null,
    left: policeWindowRect?.left ?? null,
    width: policeWindowRect?.width ?? null,
    height: policeWindowRect?.height ?? null,
    backgroundColor: policeWindowStyle?.backgroundColor || "",
    backgroundImage: policeWindowStyle?.backgroundImage || "",
    backdropFilter: policeWindowStyle?.backdropFilter || policeWindowStyle?.webkitBackdropFilter || "",
    opensBelowToggle: Boolean(policeWindowRect && policeToggleRect && policeWindowRect.top >= policeToggleRect.bottom - 4),
    startsNearToggle: Boolean(policeWindowRect && policeToggleRect && Math.abs(policeWindowRect.left - policeToggleRect.left) <= 56),
    topMostAtCenter: Boolean(policeWindow && policeWindowCenterElement && policeWindow.contains(policeWindowCenterElement)),
    topElementAtCenter: policeWindowCenterElement
      ? {
          tagName: policeWindowCenterElement.tagName || "",
          className: policeWindowCenterElement.className || "",
          datasetKeys: Object.keys(policeWindowCenterElement.dataset || {})
        }
      : null,
    closeTopOffset: policeWindowRect && policeCloseRect ? policeCloseRect.top - policeWindowRect.top : null,
    closeRightOffset: policeWindowRect && policeCloseRect ? policeWindowRect.right - policeCloseRect.right : null
  };
  const onboardingProgress = getOnboardingProgress();
  result.ui.onboardingTextAfterLoop = safeText("[data-free-onboarding-panel]", 500);
  result.ui.onboardingCurrentStepId = String(onboardingProgress?.currentStepId || "");
  result.ui.onboardingDoneCount = Number(onboardingProgress?.completedCount || onboardingProgress?.completedStepIds?.length || 0);
  result.ui.onboardingTotalCount = Number(onboardingProgress?.totalCount || 0);

  const finalState = window.EmpireRuntime?.hydrateInitialState?.(root) || {};
  result.session.finalHeat = finalState.gang?.heat ?? null;
  result.session.finalOwnedDistrictIds = Array.from(finalState.world?.ownedDistrictIds || []).map(Number).filter(Boolean);
  result.session.finalAttackOrders = Array.from(finalState.missions?.attackOrders || []).length;
  result.session.finalSpyMissions = Array.from(finalState.missions?.spy?.missions || []).length;
  result.events = events;
  return result;
})()
`;

function validatePassResult(result) {
  const failures = [];
  const requireCheck = (condition, message) => {
    if (!condition) failures.push(message);
  };
  const textIncludes = (text, expected) => String(text || "").toLowerCase().includes(String(expected).toLowerCase());
  const buildingFeedbackText = [
    result?.ui?.actionFeedTextAfterBuildingAction,
    result?.ui?.actionStatusAfterBuildingAction,
    result?.ui?.buildingActionConfirmText
  ].filter(Boolean).join("\n");
  const spyStatusText = String(result?.ui?.spyStatusAfterStart || "");
  const attackStatusText = String(result?.ui?.attackStatusAfterStart || "");
  const enemyDistrictId = String(result?.selected?.enemyDistrictId || "");

  requireCheck(result?.bootstrap === "ready", "runtime did not report ready bootstrap");
  requireCheck(Boolean(result?.runtime?.marker), "gameplay runtime marker is missing");
  if (expectedRuntime !== "any") {
    requireCheck(
      result?.runtime?.marker === expectedRuntime,
      `expected gameplay runtime ${expectedRuntime}, got ${result?.runtime?.marker || "missing"}`
    );
  }
  if (expectedRuntime === "server-authoritative-ready") {
    requireCheck(
      result?.api?.gameplaySliceLoad?.status && result.api.gameplaySliceLoad.status !== 404,
      "/api/gameplay-slice/load did not return a non-404 response"
    );
    requireCheck(Boolean(result?.seed?.hasSession), "session was not seeded before navigation");
    requireCheck(isExpectedGameUrl(url, result?.url || ""), "current URL is not the expected game URL");
    requireCheck(result?.runtime?.sliceMarker === "server-authoritative-ready", "gameplay slice root did not reach server-authoritative-ready");
    requireCheck(!result?.runtime?.sliceUnavailable, "gameplay slice marked itself unavailable");
    requireCheck(
      !result?.api?.failedRequests?.some((entry) => String(entry.url || "").includes("/api/gameplay-slice")),
      "gameplay slice API request failed"
    );
    requireCheck(Array.isArray(result?.console) && result.console.length === 0, "browser console has warnings/errors");
    return failures;
  }
  if (expectedRuntime === "demo-ready") {
    requireCheck(result?.runtime?.fallback === "legacy", "demo mode did not activate legacy fallback");
    requireCheck(result?.runtime?.serverRuntime !== "server-authoritative-ready", "demo mode was incorrectly marked server-authoritative-ready");
    requireCheck(result?.runtime?.sliceServerRuntime !== "server-authoritative-ready", "demo slice was incorrectly marked server-authoritative-ready");
  }
  requireCheck(Array.isArray(result?.missingHandlers) && result.missingHandlers.length === 0, `missing public handlers: ${(result?.missingHandlers || []).join(", ")}`);
  for (const actionName of [
    "openOwnDistrict",
    "openBuildingDetail",
    "collectProduction",
    "runBuildingAction",
    "craftItem",
    "openEnemyDistrict",
    "openSpyPanel",
    "startSpy",
    "openAttackPanel",
    "startAttack"
  ]) {
    requireCheck(Boolean(result?.actions?.[actionName]), `action failed: ${actionName}`);
  }

  requireCheck(result?.session?.mode === "free", "session is not in FREE mode");
  requireCheck(result?.session?.demoActive === false, "demo scenario is active");
  requireCheck(Boolean(result?.ui?.buildingDetailVisible), "building detail did not open");
  requireCheck(!textIncludes(result?.ui?.buildingDetailText, "COLLECT\nNení potřeba"), "building detail still shows unnecessary collect row");
  requireCheck(Boolean(result?.ui?.storageVisible), "storage popup did not open");
  requireCheck(textIncludes(result?.ui?.storageText, "Pistole"), "storage popup does not show weapon inventory");
  requireCheck(textIncludes(result?.ui?.storageText, "Chemicals"), "storage popup does not show pharmacy materials");
  requireCheck(textIncludes(result?.ui?.storageText, "Tech Core"), "storage popup does not show factory supplies");
  requireCheck(textIncludes(result?.ui?.topbarText, "Čisté peníze"), "topbar does not show clean cash label");
  requireCheck(textIncludes(result?.ui?.topbarText, "Špinavé peníze"), "topbar does not show dirty cash label");
  requireCheck(/^\$\d/.test(String(result?.ui?.cleanMoneyText || "")), "clean cash topbar value is missing");
  requireCheck(/^\$\d/.test(String(result?.ui?.dirtyMoneyText || "")), "dirty cash topbar value is missing");
  requireCheck(
    textIncludes(buildingFeedbackText, "cash")
      || textIncludes(buildingFeedbackText, "Heat")
      || textIncludes(buildingFeedbackText, "cooldown")
      || textIncludes(buildingFeedbackText, "Potvrdit akci")
      || textIncludes(buildingFeedbackText, "Budova zatím")
      || textIncludes(buildingFeedbackText, "Není nic hotového")
      || textIncludes(buildingFeedbackText, "District"),
    "building action result did not reach the visible action status surface"
  );
  requireCheck(Boolean(result?.missions?.spyStarted), "spy mission did not start");
  requireCheck(
    textIncludes(spyStatusText, "Špeh") && textIncludes(spyStatusText, enemyDistrictId) && textIncludes(spyStatusText, "Report dorazí"),
    "spy async status did not render"
  );
  requireCheck(String(result?.missions?.spyTargetDistrictId || "").includes(enemyDistrictId), "spy mission target district is missing");
  requireCheck(Boolean(result?.missions?.spyResolveAt), "spy mission cooldown/return time is missing");
  requireCheck(Boolean(result?.missions?.attackStarted), "attack order did not start");
  requireCheck(
    textIncludes(attackStatusText, "zahájí útok") && textIncludes(attackStatusText, enemyDistrictId) && textIncludes(attackStatusText, "cooldown"),
    "attack async status did not render"
  );
  requireCheck(String(result?.missions?.attackTargetDistrictId || "").includes(enemyDistrictId), "attack order target district is missing");
  requireCheck(Boolean(result?.missions?.attackResolveAt), "attack order cooldown/resolve time is missing");
  requireCheck(!textIncludes(result?.modals?.attackReport, "HEAT GAINED\n+0"), "attack report still shows misleading heat +0 fallback");
  requireCheck(result?.ui?.gangStarsPoliceThreat === "true", "gang stars did not mark police threat");
  requireCheck(Boolean(result?.ui?.gangStarsPoliceThreatClass), "gang stars threat class missing");
  requireCheck(result?.ui?.policeFeedRisk === "extreme", "police feed did not reflect forced extreme heat");
  requireCheck(Boolean(result?.ui?.wantedPopupVisible), "wanted heat popup did not open");
  for (const [label, metrics] of [
    ["rise", result?.ui?.wantedRiseListMetrics || {}],
    ["fall", result?.ui?.wantedFallListMetrics || {}]
  ]) {
    requireCheck(Boolean(metrics.exists), `wanted ${label} list is missing`);
    requireCheck(String(metrics.overflowY || "").includes("scroll") || String(metrics.overflowY || "").includes("auto"), `wanted ${label} list is not scrollable`);
    requireCheck(Boolean(metrics.scrollbarNeeded), `wanted ${label} list does not overflow into a scrollbar`);
    requireCheck(String(metrics.firstReasonWhiteSpace || "") === "normal", `wanted ${label} reason text is not allowed to wrap`);
    requireCheck(String(metrics.firstReasonTextOverflow || "") !== "ellipsis", `wanted ${label} reason text is ellipsized`);
    requireCheck(Number(metrics.firstReasonScrollHeight || 0) <= Number(metrics.firstReasonClientHeight || 0) + 1, `wanted ${label} reason text is clipped`);
  }
  const wantedPoliceToggleBackground = String(result?.ui?.wantedPoliceToggleMetrics?.backgroundImage || "");
  const wantedPoliceWindowBackground = String(result?.ui?.wantedPoliceWindowMetrics?.backgroundColor || "");
  const wantedPoliceWindowAlpha = Number((wantedPoliceWindowBackground.match(/rgba?\([^,]+,[^,]+,[^,]+,\s*([0-9.]+)\)/) || [])[1] || 1);
  requireCheck(Number(result?.ui?.wantedPoliceToggleMetrics?.width || 0) <= 20, "wanted police ? button is too wide");
  requireCheck(Number(result?.ui?.wantedPoliceToggleMetrics?.height || 0) <= 20, "wanted police ? button is too tall");
  requireCheck(wantedPoliceToggleBackground.includes("linear-gradient") || wantedPoliceToggleBackground.includes("conic-gradient"), "wanted police ? button is missing blue/red neon gradient");
  requireCheck(Boolean(result?.ui?.wantedPoliceWindowMetrics?.visible), "wanted police window did not open from ? button");
  requireCheck(Boolean(result?.ui?.wantedPoliceWindowMetrics?.opensBelowToggle), "wanted police window is not anchored below the ? button");
  requireCheck(Boolean(result?.ui?.wantedPoliceWindowMetrics?.startsNearToggle), "wanted police window is not horizontally anchored near the ? button");
  requireCheck(Boolean(result?.ui?.wantedPoliceWindowMetrics?.topMostAtCenter), "wanted police window is behind the heat popup");
  requireCheck(wantedPoliceWindowAlpha < 0.5, "wanted police window is not transparent enough");
  requireCheck(Number(result?.ui?.wantedPoliceWindowMetrics?.closeTopOffset ?? 99) <= 10, "wanted police window close button is not in the top-right corner");
  requireCheck(Number(result?.ui?.wantedPoliceWindowMetrics?.closeRightOffset ?? 99) <= 10, "wanted police window close button is not in the top-right corner");
  const onboardingTotalCount = Number(result?.ui?.onboardingTotalCount || 0);
  const expectedOnboardingDoneCount = onboardingTotalCount > 0 ? Math.max(1, onboardingTotalCount - 1) : 5;
  requireCheck(
    Number(result?.ui?.onboardingDoneCount || 0) >= expectedOnboardingDoneCount,
    "free loop checklist did not complete"
  );
  requireCheck(Array.isArray(result?.console) && result.console.length === 0, "browser console has warnings/errors");

  return failures;
}

async function run() {
  return runWithPlaywright();

  const browserPath = findBrowserPath();
  if (!browserPath) {
    throw new Error("Chrome/Edge executable not found.");
  }

  const profileDir = await mkdtemp(join(tmpdir(), "empire-free-session-ux-"));
  const browser = spawn(browserPath, [
    "--headless=new",
    "--remote-debugging-pipe",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--no-first-run",
    "--no-default-browser-check",
    `--user-data-dir=${profileDir}`,
    "about:blank"
  ], {
    stdio: ["ignore", "ignore", "pipe", "pipe", "pipe"],
    windowsHide: true
  });

  const stderr = [];
  browser.stderr?.setEncoding?.("utf8");
  browser.stderr?.on?.("data", (chunk) => {
    stderr.push(String(chunk).trim());
  });

  const cdp = new CdpPipe(browser);
  const cleanup = async () => {
    if (!browser.killed) {
      browser.kill();
      await Promise.race([
        once(browser, "exit").catch(() => {}),
        delay(1500)
      ]);
    }
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        await rm(profileDir, { recursive: true, force: true });
        return;
      } catch (error) {
        if (!["EBUSY", "ENOTEMPTY", "EPERM"].includes(error?.code) || attempt === 3) {
          return;
        }
        await delay(250);
      }
    }
  };

  const hardTimeout = setTimeout(() => {
    browser.kill();
  }, timeoutMs + 10000);

  try {
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    await cdp.send("Page.enable", {}, sessionId);
    await cdp.send("Runtime.enable", {}, sessionId);
    await cdp.send("Network.enable", {}, sessionId);
    await cdp.send("Log.enable", {}, sessionId).catch(() => {});
    await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: seedExpression }, sessionId);

    const pageMessages = [];
    const failedRequests = [];
    const apiResponses = [];
    const requestUrls = new Map();
    cdp.waiters.push({
      method: "Runtime.consoleAPICalled",
      sessionId,
      predicate: (message) => {
        pageMessages.push({
          type: message.params?.type || "",
          text: (message.params?.args || []).map((arg) => arg.value || arg.description || "").join(" ").slice(0, 500)
        });
        return false;
      },
      resolve: () => {},
      reject: () => {},
      timer: setTimeout(() => {}, timeoutMs)
    });
    cdp.waiters.push({
      method: "Network.responseReceived",
      sessionId,
      predicate: (message) => {
        const response = message.params?.response;
        const responseUrl = String(response?.url || "");
        if (responseUrl.includes("/api/")) {
          apiResponses.push({
            url: responseUrl,
            status: response?.status || 0,
            mimeType: response?.mimeType || ""
          });
        }
        return false;
      },
      resolve: () => {},
      reject: () => {},
      timer: setTimeout(() => {}, timeoutMs)
    });
    cdp.waiters.push({
      method: "Network.requestWillBeSent",
      sessionId,
      predicate: (message) => {
        const requestId = message.params?.requestId;
        const requestUrl = message.params?.request?.url;
        if (requestId && requestUrl) {
          requestUrls.set(requestId, requestUrl);
        }
        return false;
      },
      resolve: () => {},
      reject: () => {},
      timer: setTimeout(() => {}, timeoutMs)
    });
    cdp.waiters.push({
      method: "Network.loadingFailed",
      sessionId,
      predicate: (message) => {
        const requestId = message.params?.requestId || "";
        failedRequests.push({
          requestId,
          url: requestUrls.get(requestId) || "",
          errorText: message.params?.errorText || "",
          type: message.params?.type || ""
        });
        return false;
      },
      resolve: () => {},
      reject: () => {},
      timer: setTimeout(() => {}, timeoutMs)
    });

    await navigate(cdp, sessionId, url);
    const seed = await evaluate(cdp, sessionId, sessionSnapshotExpression, 30000);
    const currentUrl = await evaluate(cdp, sessionId, "location.href", 10000);
    if (!isExpectedGameUrl(url, currentUrl)) {
      throw createDiagnosticError(
        "Game page redirected before the seeded session reached the auth guard.",
        await collectRuntimeDiagnostics(cdp, sessionId, { pageMessages, failedRequests, apiResponses, seed })
      );
    }
    const ready = await waitForRuntime(cdp, sessionId, 30000);
    if (!ready) {
      throw createDiagnosticError(
        "Game runtime did not reach ready state.",
        await collectRuntimeDiagnostics(cdp, sessionId, { pageMessages, failedRequests, apiResponses, seed })
      );
    }

    const result = await evaluate(cdp, sessionId, passExpression, timeoutMs);
    result.seed = seed;
    result.runtimeReady = ready;
    result.api = {
      gameplaySliceLoad: apiResponses.find((entry) => entry.url.includes("/api/gameplay-slice/load")) || null,
      gameplaySliceSubmit: apiResponses.find((entry) => entry.url.includes("/api/gameplay-slice/submit")) || null,
      responses: apiResponses.slice(-10),
      failedRequests: failedRequests.slice(-10)
    };
    result.console = pageMessages
      .filter((entry) => ["error", "warning", "assert"].includes(entry.type))
      .filter((entry) => !(
        (expectedRuntime === "server-authoritative-error" || expectedRuntime === "demo-ready")
        && entry.type === "warning"
        && String(entry.text || "").includes("[gameplay-slice] Server-authoritative runtime failed")
      ))
      .slice(0, 20);
    result.browserStderr = stderr.filter(Boolean).slice(0, 5);
    result.validationFailures = validatePassResult(result);
    console.log(JSON.stringify(result, null, 2));
    if (result.validationFailures.length > 0) {
      throw new Error(`Free-session UX pass failed validation: ${result.validationFailures.join("; ")}`);
    }
  } finally {
    clearTimeout(hardTimeout);
    await cleanup();
  }
}

run().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
