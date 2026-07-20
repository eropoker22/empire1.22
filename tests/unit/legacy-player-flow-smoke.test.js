import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FACTION_CATALOG } from "../../packages/game-config/src/legacy-page/faction-config.js";
import { createDistrictGeometry, getDistrictAtPoint } from "../../page-assets/js/app/district-geometry.js";
import { saveLobbyStep, saveLoginStep } from "../../page-assets/js/app/auth-flow.js";
import {
  createDefaultPreviewSession,
  updateStoredPreviewSession
} from "../../page-assets/js/app/model/authority-state.js";
import { STORAGE_KEYS } from "../../page-assets/js/config.js";

const root = process.cwd();
const SESSION_STORAGE_KEY = STORAGE_KEYS.session;
const CANONICAL_FREE_SERVER_ID = "instance:free:eu-central:public-1";

const read = (relativePath) => readFileSync(resolve(root, relativePath), "utf8");
const page = (name) => read(`pages/${name}`);

const createLocalStorage = () => {
  const store = new Map();

  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear()
  };
};

const readSession = () => JSON.parse(window.localStorage.getItem(SESSION_STORAGE_KEY));

function lockFactionStep({ factionId, avatar, gangColor }) {
  const currentRegistration = readSession().registration;
  const baseSession = createDefaultPreviewSession(factionId);

  return updateStoredPreviewSession(() => ({
    ...baseSession,
    registration: {
      ...currentRegistration,
      factionId,
      selectedFaction: factionId,
      factionLabel: FACTION_CATALOG[factionId].name,
      structure: FACTION_CATALOG[factionId].name,
      selectedStructure: FACTION_CATALOG[factionId].name,
      serverRegistrationStatus: "faction_locked",
      factionLocked: true,
      hasCompletedServerEntry: true,
      avatar,
      gangColor,
      lockedAt: new Date().toISOString()
    },
    world: {
      ...baseSession.world
    }
  }));
}

describe("legacy player flow smoke guard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-26T12:00:00.000Z"));
    globalThis.window = { localStorage: createLocalStorage() };
  });

  afterEach(() => {
    vi.useRealTimers();
    delete globalThis.window;
  });

  it("walks login, lobby, faction and keeps the game map click contract wired", () => {
    expect(page("login.html")).toContain('src="../page-assets/js/login-entry.js');
    expect(page("lobby.html")).toContain('src="../page-assets/js/lobby-entry.js');
    expect(page("faction.html")).toContain('src="../page-assets/js/faction-entry.js');

    saveLoginStep({
      identity: "Flow Boss",
      isGuest: false,
      gangName: "Flow Crew",
      mode: "free"
    });

    expect(readSession().registration).toMatchObject({
      identity: "Flow Boss",
      gangName: "Flow Crew",
      serverMode: "free",
      loginKind: "account"
    });

    saveLobbyStep({ serverId: "free-eu-01", districtId: 27 });
    expect(readSession().registration).toMatchObject({
      activeServerId: CANONICAL_FREE_SERVER_ID,
      activeServerInstanceId: CANONICAL_FREE_SERVER_ID,
      serverId: CANONICAL_FREE_SERVER_ID,
      serverInstanceId: CANONICAL_FREE_SERVER_ID,
      preferredStartDistrictId: 27,
      startDistrictId: 27,
      serverRegistrationStatus: "server_selected"
    });

    const lockedSession = lockFactionStep({
      factionId: "hackeri",
      avatar: "../img/avatars/Hacker/grok_image_1773620608055.jpg",
      gangColor: "#3b82f6"
    });

    expect(lockedSession.registration).toMatchObject({
      identity: "Flow Boss",
      factionId: "hackeri",
      selectedFaction: "hackeri",
      factionLabel: FACTION_CATALOG.hackeri.name,
      factionLocked: true,
      hasCompletedServerEntry: true,
      gangColor: "#3b82f6"
    });
    expect(lockedSession.world.ownedDistrictIds).toEqual([]);

    const gameHtml = page("game.html");
    const runtimeSource = read("page-assets/js/app/runtime.js");
    const geometry = createDistrictGeometry(1600, 980);
    const firstDistrict = geometry.districts[0];
    const clickedDistrict = getDistrictAtPoint(geometry, {
      x: firstDistrict.centerX,
      y: firstDistrict.centerY
    });

    expect(gameHtml).toContain('id="game-root"');
    expect(gameHtml).toContain("data-map-viewport");
    expect(gameHtml).toContain("data-district-canvas");
    expect(gameHtml).toContain("data-district-popup");
    expect(gameHtml).toMatch(/src="\.\.\/page-assets\/js\/app-entry\.js(?:\?[^"]*)?"/u);
    expect(clickedDistrict?.id).toBe(firstDistrict.id);
    expect(runtimeSource).toContain('viewport.addEventListener("click"');
    expect(runtimeSource).toContain("const district = getDistrictAtPoint(geometry, toCanvasPoint(event));");
    expect(runtimeSource).toContain("isOnboardingDistrictClickAllowed(district");
    expect(runtimeSource).toContain("interactionState.selectedDistrictId = district.id;");
    expect(runtimeSource).toContain("interactionState.selectedDistrictId = null;");
    expect(runtimeSource).toContain("openPopup(district);");
    expect(runtimeSource).toContain("closePopup();");
    expect(runtimeSource).toContain('document.dispatchEvent(new CustomEvent("empire:district-opened"');
  });
});
