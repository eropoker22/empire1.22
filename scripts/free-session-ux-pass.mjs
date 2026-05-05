import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function findBrowserPath() {
  return BROWSER_CANDIDATES.find((candidate) => existsSync(candidate)) || null;
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
    const ready = await evaluate(cdp, sessionId, `Boolean(window.EmpireRuntime && window.empireStreetsDistrictState && document.querySelector("#game-root")?.dataset?.runtimeInit === "ready")`, 10000);
    if (ready) {
      return true;
    }
    await delay(250);
  }
  return false;
}

const seedExpression = String.raw`
(async () => {
  const auth = await import("/page-assets/js/app/auth-flow.js");
  const authority = await import("/page-assets/js/app/model/authority-state.js");
  const now = new Date().toISOString();
  localStorage.clear();
  localStorage.setItem("empire:active_guest_mode", "free");
  localStorage.setItem("empire:active_mode", "free");
  localStorage.setItem("empireStreets.freeSessionOnboarding.v1", JSON.stringify({
    completedStepIds: [],
    hidden: false,
    minimized: false
  }));

  auth.saveLoginStep({
    identity: "Manual UX Boss",
    gangName: "Manual UX Crew",
    isGuest: true,
    mode: "free"
  });
  auth.saveLobbyStep({ serverId: "free-eu-01", districtId: 27 });

  const base = authority.createDefaultPreviewSession("mafian");
  const stored = JSON.parse(localStorage.getItem("empireStreets.session.v1") || "{}");
  const session = {
    ...base,
    ...stored,
    registration: {
      ...(stored.registration || {}),
      identity: "Manual UX Boss",
      gangName: "Manual UX Crew",
      isGuest: true,
      loginKind: "guest",
      serverId: "free-eu-01",
      serverLabel: "Neon Docks FREE-01",
      serverMode: "free",
      serverRegion: "EU Central",
      startDistrictId: 27,
      factionId: "mafian",
      gangColor: "#67e8f9",
      lastLoginAt: now,
      lobbyLockedAt: now,
      lockedAt: now
    },
    world: {
      ...base.world,
      ...(stored.world || {}),
      ownedDistrictIds: [27],
      phaseState: {
        ...base.world.phaseState,
        ...(stored.world?.phaseState || {}),
        gamePhase: "live",
        mapPhase: "night"
      },
      districtDefenseById: {
        ...(base.world.districtDefenseById || {}),
        28: 15,
        29: 20
      }
    },
    inventory: {
      ...base.inventory,
      weapons: {
        ...base.inventory.weapons,
        "baseball-bat": Math.max(6, Number(base.inventory.weapons?.["baseball-bat"] || 0)),
        pistol: Math.max(4, Number(base.inventory.weapons?.pistol || 0))
      },
      materials: {
        ...base.inventory.materials,
        chemicals: Math.max(8, Number(base.inventory.materials?.chemicals || 0)),
        biomass: Math.max(8, Number(base.inventory.materials?.biomass || 0))
      },
      factorySupplies: {
        ...base.inventory.factorySupplies,
        metalParts: Math.max(20, Number(base.inventory.factorySupplies?.metalParts || 0)),
        techCore: Math.max(8, Number(base.inventory.factorySupplies?.techCore || 0))
      }
    },
    economy: {
      ...base.economy,
      cleanMoney: Math.max(5000, Number(base.economy.cleanMoney || 0)),
      dirtyMoney: Math.max(2500, Number(base.economy.dirtyMoney || 0))
    },
    gang: {
      ...base.gang,
      members: Math.max(24, Number(base.gang.members || 0)),
      heat: Math.max(35, Number(base.gang.heat || 0)),
      influence: Math.max(25, Number(base.gang.influence || 0))
    }
  };
  localStorage.setItem("empireStreets.session.v1", JSON.stringify(session));
  localStorage.setItem("empireStreets.session.free.free-eu-01.v1", JSON.stringify(session));
  return {
    mode: session.registration.serverMode,
    serverId: session.registration.serverId,
    startDistrictId: session.registration.startDistrictId,
    ownedDistrictIds: session.world.ownedDistrictIds
  };
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
      events.push({
        name,
        detailKind: event?.detail?.kind || event?.detail?.type || "",
        detailKeys: Object.keys(event?.detail || {}).slice(0, 10)
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
    events,
    errors: []
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
    policeFeedVisible: Boolean(document.querySelector("[data-police-feed]")),
    policeFeedText: safeText("[data-police-feed]", 350),
    gangStarsText: safeText("[data-gang-stars]", 120),
    storageButtonVisible: Boolean(document.querySelector("[data-storage-popup-open]")),
    wantedPopupExists: Boolean(document.querySelector("[data-wanted-popup]"))
  };

  result.actions.openOwnDistrict = Boolean(window.openDistrict?.(ownDistrictId));
  await wait(350);
  const buildingButton = document.querySelector("[data-district-building-name]");
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
  await wait(350);
  const storageButton = document.querySelector("[data-storage-popup-open]");
  storageButton?.click?.();
  await wait(250);
  result.ui.storageVisible = Boolean(document.querySelector("[data-storage-popup]:not([hidden])"));
  result.ui.storageText = safeText("[data-storage-popup]", 350);
  result.actions.craftItem = Boolean(window.craftItem?.());
  await wait(350);
  result.ui.topbarText = safeText(".game-topbar, #game-topbar, header", 350);

  result.actions.openEnemyDistrict = Boolean(window.openDistrict?.(enemyDistrictId));
  await wait(350);
  result.selected.enemyPopupText = safeText("#district-popup, [data-district-popup]", 450);
  result.actions.openSpyPanel = Boolean(window.openSpyPanel?.(enemyDistrictId));
  await wait(250);
  result.actions.startSpy = Boolean(window.startSpy?.(enemyDistrictId));
  await wait(result.actions.startSpy ? 21000 : 800);
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
  await wait(result.actions.startAttack ? 21500 : 800);
  result.modals.attackReport = visibleModalText("#attack-result-modal", 700);
  result.modals.policeAction = visibleModalText("#police-action-result-modal", 450);

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
  result.ui.onboardingTextAfterLoop = safeText("[data-free-onboarding-panel]", 500);
  result.ui.onboardingDoneCount = document.querySelectorAll("[data-free-onboarding-panel] .free-onboarding-panel__step.is-done").length;

  const finalState = window.EmpireRuntime?.hydrateInitialState?.(root) || {};
  result.session.finalHeat = finalState.gang?.heat ?? null;
  result.session.finalOwnedDistrictIds = Array.from(finalState.world?.ownedDistrictIds || []).map(Number).filter(Boolean);
  result.session.finalAttackOrders = Array.from(finalState.missions?.attackOrders || []).length;
  result.session.finalSpyMissions = Array.from(finalState.missions?.spy?.missions || []).length;
  result.events = events;
  return result;
})()
`;

async function run() {
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
    await cdp.send("Log.enable", {}, sessionId).catch(() => {});

    const pageMessages = [];
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

    await navigate(cdp, sessionId, url);
    const seed = await evaluate(cdp, sessionId, seedExpression, 30000);
    const reloadEvent = cdp.waitForEvent("Page.loadEventFired", { sessionId, timeout: 30000 });
    await cdp.send("Page.reload", {}, sessionId);
    await reloadEvent;
    const ready = await waitForRuntime(cdp, sessionId, 30000);
    if (!ready) {
      throw new Error("Game runtime did not reach ready state.");
    }

    const result = await evaluate(cdp, sessionId, passExpression, timeoutMs);
    result.seed = seed;
    result.console = pageMessages.filter((entry) => ["error", "warning", "assert"].includes(entry.type)).slice(0, 20);
    result.browserStderr = stderr.filter(Boolean).slice(0, 5);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    clearTimeout(hardTimeout);
    await cleanup();
  }
}

run().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
