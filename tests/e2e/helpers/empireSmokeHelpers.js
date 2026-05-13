import { expect } from "@playwright/test";

export const SESSION_STORAGE_KEY = "empireStreets.session.v1";

const DISTRICT_CANVAS_WIDTH = 1600;
const DISTRICT_CANVAS_HEIGHT = 980;
const DEFAULT_TEST_AVATAR = "../img/avatars/Mafia/2854d1df-0f7c-4fe4-aa85-7a70dfe299db.jpg";

const BENIGN_CONSOLE_ERROR_PATTERNS = [
  /favicon\.ico/i
];

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
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
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
      serverId: "war-eu-01",
      serverLabel: "Vortex City WAR-01",
      serverMode: "war",
      serverRegion: "EU Central",
      startDistrictId: 27,
      lobbyLockedAt: "2026-05-13T10:00:00.000Z",
      factionId: "mafian",
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
  await page.addInitScript(({ key, value }) => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem(key, JSON.stringify(value));
  }, {
    key: SESSION_STORAGE_KEY,
    value: session
  });
  return session;
}

export async function openLoginPage(page) {
  await page.goto("/pages/login.html");
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
      startDistrictId: undefined,
      lobbyLockedAt: undefined,
      factionId: undefined,
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
      gangColor: undefined,
      avatar: undefined,
      lockedAt: undefined
    }
  });
  await page.goto("/pages/faction.html");
  await expect(page.getByTestId("faction-page")).toBeVisible();
}

export async function openGamePage(page, options = {}) {
  await seedE2eSession(page, options);
  await page.goto("/pages/game.html");
  await waitForMapReady(page);
}

export async function waitForMapReady(page) {
  await expect(page.getByTestId("game-page")).toBeVisible();
  await expect(page.getByTestId("district-canvas")).toBeVisible();
  await page.waitForFunction(() => (
    typeof window.empireStreetsDistrictState?.getDistrictById === "function"
    && Boolean(window.empireStreetsDistrictState.getDistrictById(27))
  ));
}

async function getDistrictCanvasPosition(page, districtId) {
  const district = await page.evaluate((id) => {
    const entry = window.empireStreetsDistrictState?.getDistrictById?.(id);
    return entry ? { id: entry.id, centerX: entry.centerX, centerY: entry.centerY } : null;
  }, districtId);

  expect(district, `District ${districtId} should exist in runtime geometry`).toBeTruthy();

  const canvas = page.getByTestId("district-canvas");
  const box = await canvas.boundingBox();
  expect(box, "District canvas should have a bounding box").toBeTruthy();

  return {
    x: (district.centerX / DISTRICT_CANVAS_WIDTH) * box.width,
    y: (district.centerY / DISTRICT_CANVAS_HEIGHT) * box.height
  };
}

export async function clickDistrictById(page, districtId) {
  const position = await getDistrictCanvasPosition(page, districtId);
  await page.getByTestId("district-canvas").click({ position });
  await expect(page.getByTestId("district-popup")).toBeVisible();
  await expect(page.locator("[data-district-popup-title]")).toContainText(`District ${districtId}`);
}

export async function openDistrictPopup(page, options = {}) {
  const districtId = Number(options.districtId || 27);
  await clickDistrictById(page, districtId);
  await expect(page.getByTestId("district-popup-card")).toBeVisible();
  await expect(page.getByTestId("district-actions")).toBeVisible();
  return districtId;
}

export async function closeDistrictPopup(page, method = "escape") {
  if (method === "button") {
    await page.getByLabel("Zavřít district okno").click();
  } else if (method === "backdrop") {
    await page.getByTestId("district-popup-backdrop").click({ position: { x: 8, y: 8 } });
  } else {
    await page.keyboard.press("Escape");
  }

  await expect(page.getByTestId("district-popup")).toBeHidden();
}

export async function findDistrictWithAction(page, actionId) {
  const action = page.getByTestId(`district-action-${actionId}`);

  for (let districtId = 1; districtId <= 161; districtId += 1) {
    await clickDistrictById(page, districtId);

    if (await action.count()) {
      const firstAction = action.first();
      if (await firstAction.isVisible() && await firstAction.isEnabled()) {
        return districtId;
      }
    }

    await closeDistrictPopup(page);
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
  const box = await map.boundingBox();
  expect(box, "Server detail map should be rendered").toBeTruthy();

  await map.click({
    position: {
      x: Math.max(12, box.width * 0.08),
      y: Math.max(12, box.height * 0.5)
    }
  });
  await expect(page.getByTestId("confirm-server-district")).toBeEnabled();
  await page.getByTestId("confirm-server-district").click();
  await expect(page.getByTestId("server-detail-modal")).toBeHidden();
}
