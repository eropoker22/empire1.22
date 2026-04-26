import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveLobbyStep, saveLoginStep } from "../../page-assets/js/app/auth-flow.js";
import { createDefaultPreviewSession } from "../../page-assets/js/app/model/authority-state.js";

const SESSION_STORAGE_KEY = "empireStreets.session.v1";

const createLocalStorage = () => {
  const store = new Map();

  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear()
  };
};

const readStoredSession = () => JSON.parse(window.localStorage.getItem(SESSION_STORAGE_KEY));

describe("page auth flow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-26T10:00:00.000Z"));
    globalThis.window = { localStorage: createLocalStorage() };
  });

  afterEach(() => {
    vi.useRealTimers();
    delete globalThis.window;
  });

  it("starts a clean login draft without stale lobby or faction fields", () => {
    window.localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        ...createDefaultPreviewSession(),
        registration: {
          identity: "Old Boss",
          password: "old",
          serverId: "war-eu-01",
          startDistrictId: 12,
          factionId: "hackeri",
          gangColor: "#3b82f6",
          avatar: "old.png",
          lockedAt: "2026-04-25T12:00:00.000Z"
        }
      })
    );

    const session = saveLoginStep({
      identity: "New Boss",
      password: "secret",
      isGuest: false,
      gangName: "New Crew",
      mode: "free"
    });

    expect(session.registration).toMatchObject({
      identity: "New Boss",
      password: "secret",
      gangName: "New Crew",
      serverMode: "free",
      isGuest: false,
      loginKind: "account",
      lastLoginAt: "2026-04-26T10:00:00.000Z"
    });
    expect(session.registration.serverId).toBeUndefined();
    expect(session.registration.startDistrictId).toBeUndefined();
    expect(session.registration.factionId).toBeUndefined();
    expect(session.registration.gangColor).toBeUndefined();
    expect(session.registration.avatar).toBeUndefined();
    expect(session.registration.lockedAt).toBeUndefined();
  });

  it("locks lobby selection while clearing stale faction choices", () => {
    saveLoginStep({
      identity: "Lobby Boss",
      password: "secret",
      isGuest: false,
      gangName: "Lobby Crew",
      mode: "war"
    });
    window.localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        ...readStoredSession(),
        registration: {
          ...readStoredSession().registration,
          factionId: "korporat",
          gangColor: "#06b6d4",
          avatar: "stale.png",
          lockedAt: "2026-04-25T12:00:00.000Z"
        }
      })
    );

    const session = saveLobbyStep({ serverId: "war-eu-01", districtId: 27 });

    expect(session.registration).toMatchObject({
      identity: "Lobby Boss",
      password: "secret",
      gangName: "Lobby Crew",
      isGuest: false,
      loginKind: "account",
      serverId: "war-eu-01",
      serverMode: "war",
      startDistrictId: 27,
      lobbyLockedAt: "2026-04-26T10:00:00.000Z"
    });
    expect(session.registration.factionId).toBeUndefined();
    expect(session.registration.gangColor).toBeUndefined();
    expect(session.registration.avatar).toBeUndefined();
    expect(session.registration.lockedAt).toBeUndefined();
    expect(session.world.ownedDistrictIds).toEqual([27]);
  });
});
