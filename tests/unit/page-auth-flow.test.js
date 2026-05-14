import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ENTRY_FLOW_TARGETS,
  getActiveServerRegistration,
  getEntryFlowTarget,
  hasLockedFaction,
  saveLobbyStep,
  saveLoginStep
} from "../../page-assets/js/app/auth-flow.js";
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

  it("keeps an existing single-server entry when the player logs in again", () => {
    window.localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        ...createDefaultPreviewSession(),
        registration: {
          identity: "Old Boss",
          password: "old",
          activeServerId: "war-eu-01",
          activeServerName: "Vortex City WAR-01",
          activeServerMode: "war",
          activeServerRegion: "EU Central",
          activeServerStatus: "ONLINE",
          serverId: "war-eu-01",
          serverLabel: "Vortex City WAR-01",
          serverMode: "war",
          startDistrictId: 12,
          factionId: "hackeri",
          selectedFaction: "hackeri",
          structure: "hackeři",
          selectedStructure: "hackeři",
          factionLocked: true,
          hasCompletedServerEntry: true,
          serverRegistrationStatus: "faction_locked",
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
      gangName: "New Crew",
      serverMode: "war",
      isGuest: false,
      loginKind: "account",
      lastLoginAt: "2026-04-26T10:00:00.000Z",
      activeServerId: "war-eu-01",
      serverId: "war-eu-01",
      factionId: "hackeri",
      selectedFaction: "hackeri",
      selectedStructure: "hackeři",
      factionLocked: true,
      hasCompletedServerEntry: true
    });
    expect(session.registration.password).toBeUndefined();
  });

  it("keeps an existing single-server entry when the player continues as guest again", () => {
    window.localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        ...createDefaultPreviewSession(),
        registration: {
          identity: "Guest Boss",
          activeServerId: "free-eu-01",
          activeServerName: "Neon Docks FREE-01",
          activeServerMode: "free",
          activeServerRegion: "EU Central",
          activeServerStatus: "ONLINE",
          serverId: "free-eu-01",
          serverLabel: "Neon Docks FREE-01",
          serverMode: "free",
          startDistrictId: 27,
          factionId: "mafian",
          selectedFaction: "mafian",
          structure: "mafián",
          selectedStructure: "mafián",
          factionLocked: true,
          hasCompletedServerEntry: true,
          serverRegistrationStatus: "faction_locked",
          gangColor: "#ef4444",
          avatar: "avatar.png",
          lockedAt: "2026-04-25T12:00:00.000Z"
        }
      })
    );

    const session = saveLoginStep({
      identity: "Guest Boss",
      isGuest: true,
      gangName: "Guest Crew",
      mode: "war"
    });

    expect(session.registration).toMatchObject({
      identity: "Guest Boss",
      gangName: "Guest Crew",
      isGuest: true,
      loginKind: "guest",
      serverMode: "free",
      activeServerId: "free-eu-01",
      selectedFaction: "mafian",
      selectedStructure: "mafián",
      factionLocked: true,
      hasCompletedServerEntry: true
    });
  });

  it("resolves entry targets for server and faction edge cases", () => {
    expect(getEntryFlowTarget(null)).toBe(ENTRY_FLOW_TARGETS.login);
    expect(getEntryFlowTarget({ identity: "Boss" })).toBe(ENTRY_FLOW_TARGETS.lobby);
    expect(getEntryFlowTarget({
      identity: "Boss",
      activeServerId: "war-eu-01",
      startDistrictId: 27
    })).toBe(ENTRY_FLOW_TARGETS.faction);
    expect(getEntryFlowTarget({
      identity: "Boss",
      activeServerId: "war-eu-01",
      startDistrictId: 27,
      selectedFaction: "hackeri",
      selectedStructure: "hackeři",
      factionLocked: true
    })).toBe(ENTRY_FLOW_TARGETS.game);
    expect(getActiveServerRegistration({ serverId: "war-eu-01" })).toMatchObject({
      serverId: "war-eu-01",
      serverName: "Vortex City WAR-01"
    });
    expect(hasLockedFaction({
      factionId: "hackeri",
      structure: "hackeři",
      lockedAt: "2026-04-26T10:00:00.000Z"
    })).toBe(true);
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
      gangName: "Lobby Crew",
      isGuest: false,
      loginKind: "account",
      activeServerId: "war-eu-01",
      activeServerName: "Vortex City WAR-01",
      activeServerMode: "war",
      activeServerRegion: "EU Central",
      activeServerStatus: "ONLINE",
      serverId: "war-eu-01",
      serverMode: "war",
      startDistrictId: 27,
      lobbyLockedAt: "2026-04-26T10:00:00.000Z",
      serverRegistrationStatus: "server_selected",
      factionLocked: false,
      hasCompletedServerEntry: false
    });
    expect(session.registration.factionId).toBeUndefined();
    expect(session.registration.gangColor).toBeUndefined();
    expect(session.registration.avatar).toBeUndefined();
    expect(session.registration.lockedAt).toBeUndefined();
    expect(session.registration.password).toBeUndefined();
    expect(session.world.ownedDistrictIds).toEqual([27]);
  });
});
