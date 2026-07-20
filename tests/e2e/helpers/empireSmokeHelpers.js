import net from "node:net";
import { expect } from "@playwright/test";

export const SESSION_STORAGE_KEY = "empireStreets.session.v1";

const DISTRICT_CANVAS_WIDTH = 1600;
const DISTRICT_CANVAS_HEIGHT = 980;
const DEFAULT_TEST_AVATAR = "../img/avatars/Mafia/2854d1df-0f7c-4fe4-aa85-7a70dfe299db.jpg";
const CANONICAL_FREE_SERVER_ID = "instance:free:eu-central:public-1";
const ONBOARDING_STORAGE_PREFIX = "empire:onboarding:demo-v1";
const ONBOARDING_VERSION = "demo-v1-clean";

const BENIGN_CONSOLE_ERROR_PATTERNS = [
  /favicon\.ico/i,
  /Failed to load resource: the server responded with a status of 404 \(Not Found\)/i
];

const PAGE_MONITOR_KEY = "__empireStreetsE2eMonitor";
const RESERVE_TIMEOUT_MS = Number(process.env.PLAYWRIGHT_E2E_RESERVE_TIMEOUT_MS || 180_000);

async function installE2eStabilityScript(page) {
  await page.addInitScript(() => {
    window.EmpireConfigOverrides = Object.freeze({
      ...(window.EmpireConfigOverrides || {}),
      localDemoEnabled: true
    });
    const install = () => {
      if (document.getElementById("empire-e2e-stability-style")) {
        return;
      }
      const style = document.createElement("style");
      style.id = "empire-e2e-stability-style";
      style.textContent = `
        *, *::before, *::after {
          animation-delay: 0s !important;
          animation-duration: 0.001s !important;
          scroll-behavior: auto !important;
          transition-delay: 0s !important;
          transition-duration: 0.001s !important;
        }
        [data-elimination-countdown-warning],
        [data-elimination-countdown-warning] * {
          pointer-events: none !important;
        }
      `;
      document.head?.appendChild(style);
    };

    if (document.head) {
      install();
    } else {
      document.addEventListener("DOMContentLoaded", install, { once: true });
    }
  });
}

export function createRuntimeErrorMonitor(page) {
  const errors = [];
  const failedRequests = [];
  const gameplaySliceLoadResponses = [];
  const gameplayApiResponses = [];

  page.on("console", (message) => {
    if (message.type() !== "error") {
      return;
    }

    const text = message.text();
    if (BENIGN_CONSOLE_ERROR_PATTERNS.some((pattern) => pattern.test(text))) {
      return;
    }

    errors.push(`console.error: ${text}`);
  });

  page.on("pageerror", (error) => {
    errors.push(`pageerror: ${error?.stack || error?.message || String(error)}`);
  });

  page.on("requestfailed", (request) => {
    const url = sanitizeRequestUrl(request.url());
    if (/\/favicon\.ico$/iu.test(url)) {
      return;
    }
    failedRequests.push(`${request.method()} ${url}: ${request.failure()?.errorText || "failed"}`);
  });

  page.on("response", (response) => {
    const url = sanitizeRequestUrl(response.url());
    const shouldCapture = url.includes("/api/gameplay-slice/load")
      || url.includes("/api/gameplay-slice/submit")
      || url.includes("/api/matchmaking/reserve")
      || url.endsWith("/api/servers");
    if (!shouldCapture) {
      return;
    }
    const summary = `${response.request().method()} ${url}: ${response.status()}`;
    if (url.includes("/api/gameplay-slice/load")) {
      gameplaySliceLoadResponses.push(summary);
    }
    void response.text().then((body) => {
      gameplayApiResponses.push(`${summary} ${sanitizeDiagnosticBody(body)}`);
      if (gameplayApiResponses.length > 20) {
        gameplayApiResponses.shift();
      }
    }).catch(() => {
      gameplayApiResponses.push(`${summary} <body unavailable>`);
    });
  });

  const monitor = {
    errors,
    failedRequests,
    gameplaySliceLoadResponses,
    gameplayApiResponses,
    async assertNoRuntimeErrors() {
      if (errors.length) {
        expect(errors, await formatE2eDiagnostics(page, monitor)).toEqual([]);
      }
      expect(errors).toEqual([]);
    }
  };

  page[PAGE_MONITOR_KEY] = monitor;
  return monitor;
}

export async function assertNoRuntimeErrors(monitor) {
  await monitor.assertNoRuntimeErrors();
}

export async function attachE2eDiagnostics(page, testInfo) {
  if (testInfo.status === testInfo.expectedStatus) {
    return;
  }
  const diagnostics = await collectE2eDiagnostics(page, page[PAGE_MONITOR_KEY]);
  const body = JSON.stringify(diagnostics, null, 2);
  await testInfo.attach("e2e-diagnostics", {
    body,
    contentType: "application/json"
  });
  console.error(`[e2e diagnostics]\n${body}`);
}

async function formatE2eDiagnostics(page, monitor) {
  return JSON.stringify(await collectE2eDiagnostics(page, monitor), null, 2);
}

async function collectE2eDiagnostics(page, monitor = null) {
  const baseURL = process.env.PLAYWRIGHT_E2E_BASE_URL || "http://127.0.0.1:4174";
  const portState = await probeBaseUrlPort(baseURL);
  const pageState = await page.evaluate(() => ({
    currentUrl: window.location.href,
    runtimeMarker: document.body?.dataset?.gameplayRuntime || "",
    gameplaySliceClientExists: Boolean(document.querySelector("[data-gameplay-slice-client]")),
    gameplaySliceClientVisible: Boolean(document.querySelector("[data-gameplay-slice-client]:not([hidden])")),
    gameplaySliceMarker: document.querySelector("[data-gameplay-slice-client]")?.dataset?.gameplayRuntime || "",
    legacyRuntimeInit: document.querySelector("#game-root")?.dataset?.runtimeInit || "",
    selectedDistrictId: window.empireStreetsDistrictState?.getSelectedDistrict?.()?.id ?? null,
    district27Exists: Boolean(window.empireStreetsDistrictState?.getDistrictById?.(27)),
    anyDistrictExists: Boolean(window.empireStreetsDistrictState?.getAllDistricts?.()?.length),
    sessionKeys: Object.keys(window.localStorage || {})
      .filter((key) => /empire|server|session|faction/iu.test(key))
      .map((key) => key.replace(/token|secret|ticket/giu, "<redacted>"))
  })).catch((error) => ({
    currentUrl: page.url(),
    pageStateError: error?.message || String(error)
  }));

  return {
    webServerCommand: process.env.PLAYWRIGHT_E2E_WEB_SERVER_COMMAND || "",
    targetUrl: process.env.PLAYWRIGHT_E2E_HEALTH_URL || baseURL,
    baseURL,
    portState,
    pageState,
    consoleErrors: monitor?.errors || [],
    failedRequests: monitor?.failedRequests || [],
    gameplaySliceLoadResponses: monitor?.gameplaySliceLoadResponses || [],
    gameplayApiResponses: monitor?.gameplayApiResponses || []
  };
}

function sanitizeRequestUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return `${url.origin}${url.pathname}`;
  } catch {
    return String(rawUrl || "").split("?")[0];
  }
}

function sanitizeDiagnosticBody(body) {
  return String(body || "")
    .replace(/"snapshotToken"\s*:\s*"[^"]+"/giu, '"snapshotToken":"<redacted>"')
    .replace(/"sessionToken"\s*:\s*"[^"]+"/giu, '"sessionToken":"<redacted>"')
    .replace(/"joinTicket"\s*:\s*"[^"]+"/giu, '"joinTicket":"<redacted>"')
    .slice(0, 1200);
}

function probeBaseUrlPort(baseURL) {
  return new Promise((resolve) => {
    let parsed;
    try {
      parsed = new URL(baseURL);
    } catch (error) {
      resolve({ open: false, error: error?.message || String(error) });
      return;
    }
    const socket = net.connect({
      host: parsed.hostname,
      port: Number(parsed.port || (parsed.protocol === "https:" ? 443 : 80))
    });
    const done = (result) => {
      socket.destroy();
      resolve({
        host: parsed.hostname,
        port: Number(parsed.port || (parsed.protocol === "https:" ? 443 : 80)),
        ...result
      });
    };
    socket.setTimeout(1000);
    socket.once("connect", () => done({ open: true }));
    socket.once("timeout", () => done({ open: false, error: "timeout" }));
    socket.once("error", (error) => done({ open: false, error: error?.message || String(error) }));
  });
}

export async function clearStorageOnBoot(page) {
  await installE2eStabilityScript(page);
  await page.addInitScript(() => {
    const flags = new Set(String(window.name || "").split("|").filter(Boolean));
    if (flags.has("empire-e2e-storage-cleared")) {
      return;
    }
    window.localStorage.clear();
    window.sessionStorage.clear();
    flags.add("empire-e2e-storage-cleared");
    window.name = Array.from(flags).join("|");
  });
}

export function createE2eSession(overrides = {}) {
  return {
    registration: {
      identity: "E2E Boss",
      gangName: "Smoke Crew",
      isGuest: true,
      loginKind: "guest",
      lastLoginAt: "2026-05-13T10:00:00.000Z",
      activeServerId: CANONICAL_FREE_SERVER_ID,
      activeServerInstanceId: CANONICAL_FREE_SERVER_ID,
      activeServerName: "Neon Docks FREE-01",
      activeServerMode: "free",
      activeServerRegion: "EU Central",
      activeServerStatus: "ONLINE",
      serverId: CANONICAL_FREE_SERVER_ID,
      serverInstanceId: CANONICAL_FREE_SERVER_ID,
      serverLabel: "Neon Docks FREE-01",
      serverMode: "free",
      serverRegion: "EU Central",
      preferredStartDistrictId: 27,
      startDistrictId: 27,
      lobbyLockedAt: "2026-05-13T10:00:00.000Z",
      serverRegistrationStatus: "faction_locked",
      factionId: "mafian",
      selectedFaction: "mafian",
      structure: "mafián",
      selectedStructure: "mafián",
      factionLocked: true,
      hasCompletedServerEntry: true,
      gangColor: "#ef4444",
      avatar: DEFAULT_TEST_AVATAR,
      lockedAt: "2026-05-13T10:00:00.000Z",
      ...(overrides.registration || {})
    },
    world: {
      ownedDistrictIds: [27],
      destroyedDistrictIds: [],
      districtDefenseById: {},
      districtDefenseLoadoutById: {},
      districtDefenseResidentsById: {},
      districtTrapById: {},
      districtGossipById: {},
      districtPoliceActionById: {},
      ...(overrides.world || {})
    },
    ...(overrides.session || {})
  };
}

export async function seedE2eSession(page, overrides = {}) {
  const session = createE2eSession(overrides);
  await attachE2eJoinTicket(page, session);
  await installE2eStabilityScript(page);
  await page.addInitScript(({ key, onboardingPrefix, onboardingVersion, skipOnboarding, value }) => {
    const flags = new Set(String(window.name || "").split("|").filter(Boolean));
    if (flags.has("empire-e2e-session-seeded")) {
      return;
    }
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem(key, JSON.stringify(value));
    if (skipOnboarding) {
      const registration = value?.registration || {};
      const playerId = String(registration.playerId || registration.identity || registration.gangName || "dev-player").trim() || "dev-player";
      const onboardingKey = `${onboardingPrefix}:${encodeURIComponent("dev-only")}:${encodeURIComponent(playerId)}`;
      window.localStorage.setItem(onboardingKey, JSON.stringify({
        completed: true,
        skipped: true,
        currentStepId: "completed",
        dismissedAt: new Date().toISOString(),
        version: onboardingVersion
      }));
    }
    flags.add("empire-e2e-session-seeded");
    window.name = Array.from(flags).join("|");
  }, {
    key: SESSION_STORAGE_KEY,
    onboardingPrefix: ONBOARDING_STORAGE_PREFIX,
    onboardingVersion: ONBOARDING_VERSION,
    skipOnboarding: overrides.skipOnboarding !== false,
    value: session
  });
  return session;
}

async function attachE2eJoinTicket(page, session) {
  const registration = session?.registration || {};
  const selectedServerId = registration.activeServerId || registration.serverId;
  const serverInstanceId = registration.activeServerInstanceId || registration.serverInstanceId || selectedServerId;
  const accountId = registration.accountId || registration.identity || registration.gangName;
  if (!selectedServerId || !serverInstanceId || !accountId || registration.joinTicket) {
    return;
  }

  const response = await page.request.post("/api/matchmaking/reserve", {
    data: {
      playerId: accountId,
      accountId,
      mode: registration.activeServerMode || registration.serverMode || "free",
      preferredRegion: registration.activeServerRegion || registration.serverRegion || "EU Central",
      preferredServerInstanceId: serverInstanceId,
      factionId: registration.factionId || registration.selectedFaction || null
    },
    timeout: RESERVE_TIMEOUT_MS
  });
  const body = await response.json().catch(() => null);
  if (!response.ok() || !body?.accepted || !body?.reservation?.joinTicket) {
    throw new Error(`Unable to seed E2E gameplay join ticket: HTTP ${response.status()} ${JSON.stringify(body)}`);
  }
  registration.joinTicket = body.reservation.joinTicket;
  registration.activeServerId = body.reservation.serverInstanceId || registration.activeServerId || registration.serverId;
  registration.activeServerInstanceId = body.reservation.serverInstanceId || registration.activeServerInstanceId || registration.serverInstanceId;
  registration.serverId = registration.activeServerId;
  registration.serverInstanceId = registration.activeServerInstanceId;
  registration.activeServerName = body.reservation.displayName || registration.activeServerName;
  registration.serverLabel = registration.activeServerName || registration.serverLabel;
  registration.activeServerMode = body.reservation.mode || registration.activeServerMode || registration.serverMode;
  registration.serverMode = registration.activeServerMode;
  registration.activeServerRegion = body.reservation.region || registration.activeServerRegion || registration.serverRegion;
  registration.serverRegion = registration.activeServerRegion;
}

export async function openLoginPage(page) {
  await page.goto("/pages/login.html", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("login-page")).toBeVisible();
  await expect(page).toHaveTitle(/Empire Streets \| Ovládni město/);
}

export async function openLobbyPage(page, options = {}) {
  await seedE2eSession(page, {
    registration: {
      serverId: undefined,
      serverInstanceId: undefined,
      serverLabel: undefined,
      serverMode: "free",
      serverRegion: undefined,
      activeServerId: undefined,
      activeServerInstanceId: undefined,
      activeServerName: undefined,
      activeServerMode: undefined,
      activeServerRegion: undefined,
      activeServerStatus: undefined,
      preferredStartDistrictId: undefined,
      startDistrictId: undefined,
      lobbyLockedAt: undefined,
      serverRegistrationStatus: undefined,
      factionId: undefined,
      selectedFaction: undefined,
      structure: undefined,
      selectedStructure: undefined,
      factionLocked: undefined,
      hasCompletedServerEntry: undefined,
      gangColor: undefined,
      avatar: undefined,
      lockedAt: undefined,
      ...(options.registration || {})
    },
    world: {
      ownedDistrictIds: [],
      ...(options.world || {})
    }
  });
  await page.goto("/pages/lobby.html?mode=free", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("lobby-page")).toBeVisible();
  await expect(page.getByTestId("server-list")).toBeVisible();
}

export async function resolveJoinableFreeServerId(page) {
  await expect(page.getByTestId("server-list")).toBeVisible();

  const serverIdHandle = await page.waitForFunction(() => {
    const cards = Array.from(document.querySelectorAll("[data-server-card][data-server-mode='free']"));
    const normalize = (value) => String(value || "");
    const isJoinable = (element) => !element.classList.contains("is-locked")
      && !element.classList.contains("is-full")
      && !element.classList.contains("is-offline");

    const recommended = cards.find((element) =>
      normalize(element.getAttribute("data-recommended-server")) === "true" && isJoinable(element)
    );
    if (recommended) {
      return normalize(recommended.getAttribute("data-server-card"));
    }

    const fallback = cards.find((element) => isJoinable(element));
    return fallback ? normalize(fallback.getAttribute("data-server-card")) : "";
  });
  const serverId = await serverIdHandle.jsonValue();

  expect(serverId, "A joinable Free server should exist in the lobby.").toBeTruthy();
  return serverId;
}

export async function openFactionPage(page) {
  await seedE2eSession(page, {
    registration: {
      factionId: undefined,
      selectedFaction: undefined,
      structure: undefined,
      selectedStructure: undefined,
      factionLocked: undefined,
      hasCompletedServerEntry: undefined,
      serverRegistrationStatus: "server_selected",
      gangColor: undefined,
      avatar: undefined,
      lockedAt: undefined
    }
  });
  await page.goto("/pages/faction.html", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("faction-page")).toBeVisible();
  await expect(page.locator("[data-gang-color]").first()).toBeVisible();
}

export async function openGamePage(page, options = {}) {
  await seedE2eSession(page, options);
  await page.goto("/pages/game.html", { waitUntil: "domcontentloaded" });
  await waitForMapReady(page);
  await completeSpawnSelectionIfVisible(page);
  await dismissBlockingGameOverlays(page);
}

export async function completeSpawnSelectionIfVisible(page) {
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
  for (let index = 0; index < count; index += 1) {
    const candidate = availableButtons.nth(index);
    if (await candidate.isEnabled().catch(() => false)) {
      await candidate.click();
      await expect(spawnPanel).toBeHidden({ timeout: 10_000 });
      const submitResponse = await submitResponsePromise;
      expect(submitResponse.ok()).toBe(true);
      const submitPayload = await submitResponse.json();
      expect(submitPayload).toMatchObject({
        accepted: true,
        readModel: expect.any(Object)
      });
      return submitPayload;
    }
  }

  throw new Error("Spawn selection panel was visible, but no enabled spawn district button was available.");
}

export async function waitForMapReady(page) {
  await expect(page.getByTestId("game-page")).toBeVisible();
  await expect(page.getByTestId("district-canvas")).toBeVisible();
  await dismissOnboardingGuide(page);
  await dismissBlockingGameOverlays(page);
  await page.waitForFunction(() => (
    typeof window.empireStreetsDistrictState?.getDistrictById === "function"
    && (
      Boolean(window.empireStreetsDistrictState.getSelectedDistrict?.())
      || Boolean(window.empireStreetsDistrictState.getAllDistricts?.()?.length)
    )
  ));
}

export async function dismissOnboardingGuide(page) {
  const panel = page.locator("[data-onboarding-panel]");
  if (await panel.isVisible({ timeout: 1000 }).catch(() => false)) {
    const dismissButton = page.getByRole("button", { name: /Už nezobrazovat|Přeskočit/ }).first();
    if (await dismissButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await dismissButton.click({ force: true });
      await expect(panel).toBeHidden({ timeout: 1500 }).catch(async () => {
        await forceHideOnboardingGuide(page);
      });
      return;
    }
    await forceHideOnboardingGuide(page);
  }
}

async function forceHideOnboardingGuide(page) {
  await page.evaluate(({ prefix, version }) => {
    const session = JSON.parse(window.localStorage.getItem("empireStreets.session.v1") || "{}");
    const registration = session?.registration || {};
    const playerId = String(registration.playerId || registration.identity || registration.gangName || "dev-player").trim() || "dev-player";
    window.localStorage.setItem(`${prefix}:${encodeURIComponent("dev-only")}:${encodeURIComponent(playerId)}`, JSON.stringify({
      completed: true,
      skipped: true,
      currentStepId: "completed",
      dismissedAt: new Date().toISOString(),
      version
    }));
    const selectors = [
      "[data-onboarding-panel]",
      "[data-onboarding-highlight]",
      "[data-onboarding-highlight-label]"
    ];
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element instanceof HTMLElement) {
        element.hidden = true;
        element.style.display = "none";
        element.setAttribute("aria-hidden", "true");
      }
    }
  }, {
    prefix: ONBOARDING_STORAGE_PREFIX,
    version: ONBOARDING_VERSION
  });
}

export async function dismissBlockingGameOverlays(page) {
  await page.waitForLoadState("domcontentloaded");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.waitForFunction(() => {
        const root = document.querySelector("#game-root");
        const milestoneModal = document.querySelector("[data-server-milestone-modal]");
        return root?.dataset?.runtimeInit === "ready"
          && milestoneModal?.dataset?.serverMilestoneBound === "true";
      }, undefined, { timeout: 5_000 }).catch(() => void 0);
      await page.waitForTimeout(75);
      await page.evaluate(() => {
        const warning = document.querySelector("[data-elimination-countdown-warning].is-visible");
        const closeButton = document.querySelector(
          "[data-elimination-countdown-warning].is-visible [data-elimination-countdown-warning-close]"
        );
        if (closeButton instanceof HTMLElement) {
          closeButton.click();
        }
        if (warning instanceof HTMLElement && warning.classList.contains("is-visible")) {
          warning.hidden = true;
          warning.classList.remove("is-visible");
          warning.style.pointerEvents = "none";
        }

        const milestoneModal = document.querySelector("[data-server-milestone-modal]");
        if (milestoneModal instanceof HTMLElement && !milestoneModal.hidden) {
          milestoneModal.querySelector("[data-server-milestone-confirm]")?.click();
        }
      });
      return;
    } catch (error) {
      if (!String(error?.message || error).includes("Execution context was destroyed") || attempt === 2) {
        throw error;
      }
      await page.waitForLoadState("domcontentloaded");
    }
  }
}

export async function expectDistrictCanvasPainted(page) {
  await page.waitForFunction(() => {
    const canvas = document.querySelector("[data-testid='district-canvas']");
    if (!(canvas instanceof HTMLCanvasElement) || canvas.width <= 0 || canvas.height <= 0) {
      return false;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return false;
    }

    const sampleSize = 20;
    const sampleX = Math.max(0, Math.floor((canvas.width - sampleSize) / 2));
    const sampleY = Math.max(0, Math.floor((canvas.height - sampleSize) / 2));
    let pixels;

    try {
      pixels = context.getImageData(sampleX, sampleY, sampleSize, sampleSize).data;
    } catch {
      return false;
    }

    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index] !== 0 || pixels[index + 1] !== 0 || pixels[index + 2] !== 0 || pixels[index + 3] !== 0) {
        return true;
      }
    }

    return false;
  });
}

async function getDistrictCanvasPosition(page, districtId) {
  const district = await page.evaluate((id) => {
    const entry = window.empireStreetsDistrictState?.getDistrictById?.(id);
    return entry ? { id: entry.id, centerX: entry.centerX, centerY: entry.centerY } : null;
  }, districtId);

  expect(district, `District ${districtId} should exist in runtime geometry`).toBeTruthy();

  const canvas = page.getByTestId("district-canvas");
  const box = await canvas.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height
    };
  });
  expect(box, "District canvas should have a bounding box").toBeTruthy();
  expect(box.width, "District canvas should have width").toBeGreaterThan(0);
  expect(box.height, "District canvas should have height").toBeGreaterThan(0);

  return {
    x: box.left + (district.centerX / DISTRICT_CANVAS_WIDTH) * box.width,
    y: box.top + (district.centerY / DISTRICT_CANVAS_HEIGHT) * box.height
  };
}

export async function clickDistrictById(page, districtId) {
  await dismissOnboardingGuide(page);
  await dismissBlockingGameOverlays(page);
  const openedViaApi = await page.evaluate((id) => Boolean(window.empireStreetsDistrictState?.openDistrict?.(id)), districtId);
  if (!openedViaApi) {
    const position = await getDistrictCanvasPosition(page, districtId);
    await page.mouse.click(position.x, position.y);
  }
  await expect(page.getByTestId("district-popup-card")).toBeVisible();
}

export async function openDistrictPopup(page, options = {}) {
  const districtId = Number(options.districtId || 27);
  await clickDistrictById(page, districtId);
  await expect(page.getByTestId("district-popup-card")).toBeVisible();
  await dismissBlockingGameOverlays(page);
  return districtId;
}

export async function closeDistrictPopup(page, method = "escape") {
  if (method === "button") {
    await page.evaluate(() => document.querySelector("[data-district-popup-close]")?.click());
  } else if (method === "backdrop") {
    await page.evaluate(() => document.querySelector("[data-testid='district-popup-backdrop']")?.click());
  } else {
    await page.evaluate(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
  }

  const isPopupHidden = async () => page.evaluate(() => {
    const popupElement = document.querySelector("[data-testid='district-popup']");
    if (!popupElement) {
      return true;
    }
    const style = window.getComputedStyle(popupElement);
    return popupElement.hasAttribute("hidden")
      || popupElement.getAttribute("aria-hidden") === "true"
      || style.display === "none"
      || style.visibility === "hidden";
  });

  if (!await isPopupHidden()) {
    await page.evaluate(() => document.querySelector("[data-district-popup-close]")?.click());
  }
  const hiddenAfterClose = await page.evaluate(() => {
    const popupElement = document.querySelector("[data-testid='district-popup']");
    const popupCard = document.querySelector("[data-testid='district-popup-card']");
    if (!popupElement) {
      return true;
    }
    const popupStyle = window.getComputedStyle(popupElement);
    const cardStyle = popupCard ? window.getComputedStyle(popupCard) : null;
    return popupElement.hasAttribute("hidden")
      || popupElement.getAttribute("aria-hidden") === "true"
      || popupStyle.display === "none"
      || popupStyle.visibility === "hidden"
      || !popupCard
      || cardStyle?.display === "none"
      || cardStyle?.visibility === "hidden"
      || cardStyle?.opacity === "0";
  });
  expect(hiddenAfterClose).toBe(true);
}

export async function findDistrictWithAction(page, actionId) {
  const action = page.getByTestId(`district-action-${actionId}`);
  const candidateDistrictIds = [
    27, 28, 26, 29, 40, 41, 42, 80, 81, 82, 120, 121, 122, 1, 2, 160, 161
  ];

  for (const districtId of candidateDistrictIds) {
    await clickDistrictById(page, districtId);

    if (await action.count().catch(() => 0)) {
      const firstAction = action.first();
      if (
        await firstAction.isVisible({ timeout: 500 }).catch(() => false)
        && await firstAction.isEnabled({ timeout: 500 }).catch(() => false)
      ) {
        return districtId;
      }
    }

  }

  throw new Error(`No district with enabled action ${actionId} was found.`);
}

export async function closeModal(page, modalTestId, method = "escape") {
  const modal = page.getByTestId(modalTestId);
  await expect(modal).toBeVisible();

  if (method === "escape") {
    await page.keyboard.press("Escape");
  } else {
    await modal.getByRole("button", { name: /Zavřít|Zrušit|Odmítnout/ }).first().click();
  }

  await expect(modal).toBeHidden();
}

export async function expectNoDistrictActionModals(page) {
  const visibleModalIds = await page.evaluate(() => [
    "attack-setup-modal",
    "robbery-setup-modal",
    "defense-setup-modal",
    "spy-confirm-modal"
  ].filter((testId) => {
    const element = document.querySelector(`[data-testid="${testId}"]`);
    if (!(element instanceof HTMLElement)) {
      return false;
    }
    const style = window.getComputedStyle(element);
    return !element.hidden
      && !element.classList.contains("hidden")
      && element.getAttribute("aria-hidden") !== "true"
      && style.display !== "none"
      && style.visibility !== "hidden"
      && style.opacity !== "0";
  }));

  expect(visibleModalIds).toEqual([]);
}

export async function selectLobbyDistrict(page) {
  await page.getByTestId("open-server-district-select").click();
  await expect(page.getByTestId("server-detail-modal")).toBeVisible();

  const map = page.getByTestId("server-detail-map");
  const box = await map.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height
    };
  });
  expect(box, "Server detail map should be rendered").toBeTruthy();

  const spawnPoints = [
    { x: 0.08, y: 0.52 },
    { x: 0.92, y: 0.52 },
    { x: 0.5, y: 0.92 },
    { x: 0.24, y: 0.92 },
    { x: 0.76, y: 0.92 }
  ];

  for (const point of spawnPoints) {
    await map.click({
      force: true,
      position: {
        x: Math.max(12, Math.min(box.width - 12, box.width * point.x)),
        y: Math.max(12, Math.min(box.height - 12, box.height * point.y))
      }
    });
    if (await page.getByTestId("confirm-server-district").isEnabled().catch(() => false)) {
      break;
    }
  }

  await expect(page.getByTestId("confirm-server-district")).toBeEnabled();
  await page.getByTestId("confirm-server-district").click();
  await expect(page.getByTestId("server-detail-modal")).toBeHidden();
}
