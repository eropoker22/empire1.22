import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FACTION_CATALOG } from "../../packages/game-config/src/legacy-page/faction-config.js";
import { saveLobbyStep, saveLoginStep } from "../../page-assets/js/app/auth-flow.js";
import {
  createDefaultPreviewSession,
  updateStoredPreviewSession
} from "../../page-assets/js/app/model/authority-state.js";

const SESSION_STORAGE_KEY = "empireStreets.session.v1";
const root = process.cwd();

const page = (name) => readFileSync(resolve(root, "pages", name), "utf8");

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

const lockFactionStep = ({ factionId, avatar, gangColor }) => {
  const currentRegistration = readSession().registration;
  const baseSession = createDefaultPreviewSession(factionId);

  return updateStoredPreviewSession(() => ({
    ...baseSession,
    registration: {
      ...currentRegistration,
      factionId,
      factionLabel: FACTION_CATALOG[factionId].name,
      avatar,
      gangColor,
      lockedAt: new Date().toISOString()
    },
    world: {
      ...baseSession.world,
      ownedDistrictIds: [Number(currentRegistration.startDistrictId)]
    }
  }));
};

describe("page onboarding smoke", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-26T11:00:00.000Z"));
    globalThis.window = { localStorage: createLocalStorage() };
  });

  afterEach(() => {
    vi.useRealTimers();
    delete globalThis.window;
  });

  it("keeps the login to game page contract wired", () => {
    expect(page("login.html")).toContain('id="login-form"');
    expect(page("login.html")).toContain('id="register-form"');
    expect(page("login.html")).toContain('id="guest-btn"');
    expect(page("login.html")).toContain('src="../page-assets/js/login.js"');

    expect(page("lobby.html")).toContain('data-server-list');
    expect(page("lobby.html")).toContain('data-server-detail-map');
    expect(page("lobby.html")).toContain('data-server-detail-continue');
    expect(page("lobby.html")).toContain('src="../page-assets/js/lobby.js"');

    expect(page("faction.html")).toContain('id="structure-grid"');
    expect(page("faction.html")).toContain('id="gang-color-grid"');
    expect(page("faction.html")).toContain('id="avatar-grid"');
    expect(page("faction.html")).toContain('id="go-game"');
    expect(page("faction.html")).toContain('src="../page-assets/js/faction.js"');

    expect(page("game.html")).toContain('id="game-root"');
    expect(page("game.html")).toContain('data-mount-role="map"');
    expect(page("game.html")).toContain('src="../page-assets/js/app.js"');
    expect(page("game.html")).toContain('src="../page-assets/js/app/game-admin-slice-launcher.js"');
  });

  it("walks a clean registration draft through lobby and faction lock", () => {
    saveLoginStep({
      identity: "Smoke Boss",
      password: "secret",
      isGuest: false,
      gangName: "Smoke Crew",
      mode: "war"
    });

    expect(readSession().registration).toMatchObject({
      identity: "Smoke Boss",
      gangName: "Smoke Crew",
      serverMode: "war"
    });
    expect(readSession().registration.serverId).toBeUndefined();
    expect(readSession().registration.factionId).toBeUndefined();

    saveLobbyStep({ serverId: "war-eu-01", districtId: 27 });

    expect(readSession().registration).toMatchObject({
      identity: "Smoke Boss",
      gangName: "Smoke Crew",
      serverId: "war-eu-01",
      serverMode: "war",
      startDistrictId: 27
    });
    expect(readSession().registration.factionId).toBeUndefined();

    const session = lockFactionStep({
      factionId: "hackeri",
      avatar: "../img/avatars/Hacker/grok_image_1773620608055.jpg",
      gangColor: "#3b82f6"
    });

    expect(session.registration).toMatchObject({
      identity: "Smoke Boss",
      serverId: "war-eu-01",
      startDistrictId: 27,
      factionId: "hackeri",
      gangColor: "#3b82f6",
      lockedAt: "2026-04-26T11:00:00.000Z"
    });
    expect(session.world.ownedDistrictIds).toEqual([27]);
  });
});
