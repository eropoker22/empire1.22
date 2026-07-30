import { randomBytes } from "node:crypto";
import { expect } from "@playwright/test";
import { createDistrictGeometry } from "../../../page-assets/js/app/district-geometry.js";
import {
  dismissBlockingGameOverlays,
  dismissOnboardingGuide
} from "./empireSmokeHelpers.js";

const canvasWidth = 1600;
const canvasHeight = 980;
const geometry = createDistrictGeometry(canvasWidth, canvasHeight, 0, 48, 0);
const DEMO_GAMEPLAY_STORAGE_PATTERNS = Object.freeze([
  /^empireStreets\.session(?:\.|$)/u,
  /^empireStreets\.production(?:\.|$)/u,
  /^empireStreets\.factory(?:\.|$)/u,
  /^empire:production(?:[:.]|$)/u,
  /^empire:factory(?:[:.]|$)/u
]);

function createIdentity(prefix = "Parity") {
  const suffix = randomBytes(6).toString("hex");
  return {
    username: `${prefix}${suffix}`,
    gangName: `${prefix} Crew ${suffix}`,
    password: randomBytes(24).toString("base64url"),
    networkIdentifier: `2001:db8::${randomBytes(8).toString("hex")}`
  };
}

async function registerAccount(page, identity) {
  await page.setExtraHTTPHeaders({
    "x-forwarded-for": identity.networkIdentifier
  });
  await page.goto("/pages/login.html");
  await expect(page.locator("#register-username")).toBeEnabled({ timeout: 30_000 });
  await page.locator("[data-login-registration-open]").click();
  await expect(page.locator("[data-login-registration-overlay]")).toBeVisible();
  await page.locator("#register-username").fill(identity.username);
  await page.locator("#register-gang").fill(identity.gangName);
  await page.locator("#register-birth-date").fill("1990-01-01");
  await page.locator("#register-password").fill(identity.password);
  await page.locator("#register-password-confirmation").fill(identity.password);
  await page.locator("#register-terms").check();
  await page.getByTestId("register-form").getByRole("button", { name: "ZALOŽIT GANG" }).click();
  await expect(page).toHaveURL(/\/pages\/lobby\.html/u, { timeout: 30_000 });
  await expect(page.locator("[data-live-gang-user]")).toHaveText(identity.username, { timeout: 30_000 });
}

async function openServer(page, serverInstanceId) {
  const spawnResponseObserver = observeSpawnDistrictResponse(page, serverInstanceId);
  try {
    const opened = await page.locator("[data-open-live-server]").evaluateAll((buttons, expectedId) => {
      const button = buttons.find((candidate) => candidate.dataset.openLiveServer === expectedId);
      if (!(button instanceof HTMLButtonElement) || button.disabled) return false;
      button.click();
      return true;
    }, serverInstanceId);
    expect(opened, `Server ${serverInstanceId} must be available in the live lobby`).toBe(true);
    await expect(page.getByTestId("server-detail-modal")).toHaveAttribute("aria-hidden", "false");
    const spawnResponse = await spawnResponseObserver.response;
    expect(spawnResponse, "Opening a live server must load authoritative spawn districts").toBeTruthy();
    return readSpawnDistrictResponse(spawnResponse);
  } finally {
    spawnResponseObserver.dispose();
  }
}

async function selectSpawnDistrict(page, serverInstanceId, initialDistricts, preferredDistrictIds) {
  const candidates = (Array.isArray(preferredDistrictIds)
    ? preferredDistrictIds
    : [preferredDistrictIds]).filter(Boolean).map(String);
  let districts = initialDistricts;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const availableOptions = candidates.length
      ? candidates
        .map((districtId) => districts.find((district) => (
          district.available && district.districtId === districtId
        )))
        .filter(Boolean)
      : districts.filter((district) => district.available);
    expect(
      availableOptions.length,
      candidates.length
        ? `One of the requested spawn districts must be available: ${candidates.join(", ")}`
        : "At least one canonical spawn district must be available"
    ).toBeGreaterThan(0);
    const canvas = page.getByTestId("server-detail-map");
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    let selection = null;
    for (const option of availableOptions) {
      const renderedDistrict = geometry.districts.find(
        (district) => `district:${district.id}` === option.districtId
      );
      if (!renderedDistrict) continue;
      const point = {
        x: box.x + (renderedDistrict.centerX / canvasWidth) * box.width,
        y: box.y + (renderedDistrict.centerY / canvasHeight) * box.height
      };
      const centerHitsCanvas = await page.evaluate(({ x, y }) => (
        document.elementFromPoint(x, y)?.matches?.("[data-server-detail-map]") === true
      ), point);
      if (centerHitsCanvas) {
        selection = { option, point };
        break;
      }
    }
    expect(selection, "An available spawn district must have a clickable map center").toBeTruthy();
    const { option, point } = selection;
    await page.mouse.click(point.x, point.y);
    await expect(page.getByTestId("confirm-server-district")).toBeEnabled();
    const confirmResponsePromise = page.waitForResponse((response) => (
      response.url().includes("/api/lobby/spawn-confirm")
      && response.request().method() === "POST"
    ));
    const refreshedDistrictsObserver = observeSpawnDistrictResponse(page, serverInstanceId);
    try {
      await page.getByTestId("confirm-server-district").click();
      const confirmResponse = await confirmResponsePromise;
      if (confirmResponse.ok()) {
        return option.districtId;
      }
      const confirmPayload = await confirmResponse.json();
      const errorCode = confirmPayload?.errors?.[0]?.code || "";
      expect(
        ["SPAWN_ALREADY_RESERVED", "SPAWN_SELECTION_STALE", "SERVER_FULL"],
        `Unexpected spawn confirmation error: ${errorCode || confirmResponse.status()}`
      ).toContain(errorCode);
      const refreshedDistrictsResponse = await refreshedDistrictsObserver.response;
      expect(refreshedDistrictsResponse, "Spawn conflict must trigger an authoritative refresh").toBeTruthy();
      districts = await readSpawnDistrictResponse(refreshedDistrictsResponse);
    } finally {
      refreshedDistrictsObserver.dispose();
    }
  }
  throw new Error("Spawn selection remained stale after three authoritative refreshes.");
}

const observeSpawnDistrictResponse = (page, serverInstanceId) => {
  const pathname = `/api/lobby/servers/${encodeURIComponent(serverInstanceId)}/spawn-districts`;
  let resolveResponse;
  let settled = false;
  let timeoutHandle = null;
  const response = new Promise((resolve) => {
    resolveResponse = resolve;
  });
  const finish = (value) => {
    if (settled) return;
    settled = true;
    if (timeoutHandle !== null) clearTimeout(timeoutHandle);
    page.off("response", handleResponse);
    resolveResponse(value);
  };
  const handleResponse = (candidate) => {
    if (
      candidate.url().includes(pathname)
      && candidate.request().method() === "GET"
    ) {
      finish(candidate);
    }
  };
  page.on("response", handleResponse);
  timeoutHandle = setTimeout(() => finish(null), 30_000);
  return {
    response,
    dispose: () => finish(null)
  };
};

const readSpawnDistrictResponse = async (response) => {
  const payload = await response.json();
  expect(response.ok()).toBe(true);
  expect(payload?.accepted).toBe(true);
  return payload.data.districts;
};

async function completeFactionSelection(page) {
  await expect(page).toHaveURL(/\/pages\/faction\.html\?membership=/u, { timeout: 30_000 });
  await expect(page.locator("[data-live-color]").first()).toBeVisible({ timeout: 30_000 });
  await page.locator('[data-faction-id="mafian"]').click();
  await page.locator("[data-live-color]").first().click();
  await page.locator("[data-live-avatar]").first().click();
  await page.getByTestId("continue-to-game").click();
}

export async function waitForLiveGame(page) {
  await expect(page).toHaveURL(/\/pages\/game\.html/u, { timeout: 120_000 });
  await expect(page.locator("html")).toHaveAttribute(
    "data-runtime-mode",
    "server-authoritative",
    { timeout: 60_000 }
  );
  await expect(page.locator("#game-root")).toHaveAttribute(
    "data-runtime-init",
    "ready",
    { timeout: 60_000 }
  );
  await expect.poll(
    () => page.evaluate(() => {
      const readModel = window.EmpireGameplaySliceClient?.getCurrentReadModel?.()
        || window.empireStreetsGameplaySliceReadModel
        || null;
      return Boolean(
        readModel?.server?.serverInstanceId
        && readModel?.player?.playerId
        && readModel?.player?.instanceId
        && readModel?.district?.districtId
      );
    }),
    {
      message: "Authoritative gameplay slice must be loaded before hosted UI interaction",
      timeout: 60_000
    }
  ).toBe(true);
  await dismissBlockingGameOverlays(page);
  await dismissOnboardingGuide(page);
  await page.evaluate(() => {
    window.__EMPIRE_DEMO_GAMEPLAY_STORAGE_WRITES__ = [];
  });
}

export async function installHostedUiParityInstrumentation(page) {
  const diagnostics = {
    consoleErrors: [],
    pageErrors: [],
    submitRequests: []
  };
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const location = message.location();
    const text = message.text();
    const pathname = (() => {
      try {
        return new URL(location.url).pathname;
      } catch {
        return "";
      }
    })();
    if (shouldIgnoreHostedConsoleError({ pathname, text })) return;
    diagnostics.consoleErrors.push({
      columnNumber: location.columnNumber,
      lineNumber: location.lineNumber,
      text,
      url: location.url
    });
  });
  page.on("pageerror", (error) => diagnostics.pageErrors.push(error.message));
  page.on("request", (request) => {
    if (!request.url().includes("/api/gameplay-slice/submit")) return;
    try {
      diagnostics.submitRequests.push(request.postDataJSON());
    } catch {
      diagnostics.submitRequests.push({ unreadable: true });
    }
  });
  await page.addInitScript(({ storagePatterns }) => {
    window.__EMPIRE_E2E__ = true;
    window.__EMPIRE_DEMO_GAMEPLAY_STORAGE_WRITES__ = [];
    const originalSetItem = Storage.prototype.setItem;
    const originalRemoveItem = Storage.prototype.removeItem;
    const matchesDemoGameplayKey = (key) => storagePatterns.some((source) => (
      new RegExp(source, "u").test(String(key || ""))
    ));
    Storage.prototype.setItem = function setItem(key, value) {
      if (matchesDemoGameplayKey(key)) {
        window.__EMPIRE_DEMO_GAMEPLAY_STORAGE_WRITES__.push({
          operation: "setItem",
          key: String(key)
        });
      }
      return originalSetItem.call(this, key, value);
    };
    Storage.prototype.removeItem = function removeItem(key) {
      if (matchesDemoGameplayKey(key)) {
        window.__EMPIRE_DEMO_GAMEPLAY_STORAGE_WRITES__.push({
          operation: "removeItem",
          key: String(key)
        });
      }
      return originalRemoveItem.call(this, key);
    };
  }, {
    storagePatterns: DEMO_GAMEPLAY_STORAGE_PATTERNS.map((pattern) => pattern.source)
  });
  return diagnostics;
}

export function shouldIgnoreHostedConsoleError({ pathname = "", text = "" } = {}) {
  return pathname === "/api/account/session"
    && /status of 401 \(Unauthorized\)/u.test(text)
    || pathname === "/api/lobby/spawn-confirm"
      && /status of 409 \(Conflict\)/u.test(text);
}

export async function expectHostedUiParityClean(page, diagnostics) {
  const storageWrites = await page.evaluate(() => (
    window.__EMPIRE_DEMO_GAMEPLAY_STORAGE_WRITES__ || []
  ));
  expect(storageWrites, "Server-authoritative UI must not write demo gameplay storage").toEqual([]);
  expect(diagnostics.consoleErrors, "Hosted parity flow must not log console errors").toEqual([]);
  expect(diagnostics.pageErrors, "Hosted parity flow must not raise page errors").toEqual([]);
}

export async function registerAndEnterHostedUiParityGame(page, {
  serverInstanceId,
  spawnDistrictId,
  spawnDistrictIds,
  identityPrefix = "Parity"
} = {}) {
  expect(serverInstanceId, "EMPIRE_UI_PARITY_SERVER_ID is required").toBeTruthy();
  const requestedSpawnDistrictIds = spawnDistrictIds || [spawnDistrictId].filter(Boolean);
  const diagnostics = await installHostedUiParityInstrumentation(page);
  const identity = createIdentity(identityPrefix);
  await registerAccount(page, identity);
  const districts = await openServer(page, serverInstanceId);
  const selectedSpawnDistrictId = await selectSpawnDistrict(
    page,
    serverInstanceId,
    districts,
    requestedSpawnDistrictIds
  );
  await completeFactionSelection(page);
  await waitForLiveGame(page);
  return {
    diagnostics,
    identity,
    serverInstanceId,
    spawnDistrictId: selectedSpawnDistrictId
  };
}
