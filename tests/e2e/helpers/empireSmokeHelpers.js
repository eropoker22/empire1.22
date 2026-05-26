import { expect } from "@playwright/test";

export const SESSION_STORAGE_KEY = "empireStreets.session.v1";

const DISTRICT_CANVAS_WIDTH = 1600;
const DISTRICT_CANVAS_HEIGHT = 980;
const DEFAULT_TEST_AVATAR = "../img/avatars/Mafia/2854d1df-0f7c-4fe4-aa85-7a70dfe299db.jpg";
const CANONICAL_WAR_SERVER_ID = "instance:war:eu-central:public-1";

const BENIGN_CONSOLE_ERROR_PATTERNS = [
  /favicon\.ico/i,
  /Failed to load resource: the server responded with a status of 404 \(Not Found\)/i
];

async function installE2eStabilityScript(page) {
  await page.addInitScript(() => {
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

  return {
    errors,
    async assertNoRuntimeErrors() {
      expect(errors).toEqual([]);
    }
  };
}

export async function assertNoRuntimeErrors(monitor) {
  await monitor.assertNoRuntimeErrors();
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
      activeServerId: CANONICAL_WAR_SERVER_ID,
      activeServerInstanceId: CANONICAL_WAR_SERVER_ID,
      activeServerName: "Vortex City WAR-01",
      activeServerMode: "war",
      activeServerRegion: "EU Central",
      activeServerStatus: "ONLINE",
      serverId: CANONICAL_WAR_SERVER_ID,
      serverInstanceId: CANONICAL_WAR_SERVER_ID,
      serverLabel: "Vortex City WAR-01",
      serverMode: "war",
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
  await installE2eStabilityScript(page);
  await page.addInitScript(({ key, value }) => {
    const flags = new Set(String(window.name || "").split("|").filter(Boolean));
    if (flags.has("empire-e2e-session-seeded")) {
      return;
    }
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem(key, JSON.stringify(value));
    flags.add("empire-e2e-session-seeded");
    window.name = Array.from(flags).join("|");
  }, {
    key: SESSION_STORAGE_KEY,
    value: session
  });
  return session;
}

export async function openLoginPage(page) {
  await page.goto("/pages/login.html", { waitUntil: "commit" });
  await expect(page.getByTestId("login-page")).toBeVisible();
  await expect(page).toHaveTitle(/Přihlášení/);
}

export async function openLobbyPage(page, options = {}) {
  await seedE2eSession(page, {
    registration: {
      serverId: undefined,
      serverLabel: undefined,
      serverMode: "war",
      serverRegion: undefined,
      activeServerId: undefined,
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
  await page.goto("/pages/lobby.html?mode=war");
  await expect(page.getByTestId("lobby-page")).toBeVisible();
  await expect(page.getByTestId("server-list")).toBeVisible();
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
  await page.goto("/pages/faction.html");
  await expect(page.getByTestId("faction-page")).toBeVisible();
  await expect(page.locator("[data-gang-color]").first()).toBeVisible();
}

export async function openGamePage(page, options = {}) {
  await seedE2eSession(page, options);
  await page.goto("/pages/game.html");
  await waitForMapReady(page);
}

export async function waitForMapReady(page) {
  await expect(page.getByTestId("game-page")).toBeVisible();
  await expect(page.getByTestId("district-canvas")).toBeVisible();
  await dismissOnboardingGuide(page);
  await page.waitForFunction(() => (
    typeof window.empireStreetsDistrictState?.getDistrictById === "function"
    && Boolean(window.empireStreetsDistrictState.getDistrictById(27))
  ));
}

export async function dismissOnboardingGuide(page) {
  const panel = page.locator("[data-onboarding-panel]");
  if (await panel.isVisible({ timeout: 1000 }).catch(() => false)) {
    const dismissButton = page.getByRole("button", { name: /Už nezobrazovat|Přeskočit/ }).first();
    if (await dismissButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await dismissButton.click({ force: true });
      await expect(panel).toBeHidden({ timeout: 5000 });
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
  for (const testId of [
    "attack-setup-modal",
    "robbery-setup-modal",
    "defense-setup-modal",
    "spy-confirm-modal"
  ]) {
    await expect(page.getByTestId(testId)).toBeHidden();
  }
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
