import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ENTRY_FLOW_TARGETS,
  SERVER_CATALOG,
  getActiveServerRegistration,
  getEntryFlowTarget,
  hasLockedFaction,
  saveLobbyStep,
  saveLoginStep
} from "../../page-assets/js/app/auth-flow.js";
import { createDefaultPreviewSession } from "../../page-assets/js/app/model/authority-state.js";

const SESSION_STORAGE_KEY = "empireStreets.session.v1";
const CANONICAL_WAR_SERVER_ID = "instance:war:eu-central:public-1";
const CANONICAL_FREE_SERVER_ID = "instance:free:eu-central:public-1";

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
          preferredStartDistrictId: 12,
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
      activeServerId: CANONICAL_WAR_SERVER_ID,
      activeServerInstanceId: CANONICAL_WAR_SERVER_ID,
      serverId: CANONICAL_WAR_SERVER_ID,
      serverInstanceId: CANONICAL_WAR_SERVER_ID,
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
          preferredStartDistrictId: 27,
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
      activeServerId: CANONICAL_FREE_SERVER_ID,
      activeServerInstanceId: CANONICAL_FREE_SERVER_ID,
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
      preferredStartDistrictId: 27
    })).toBe(ENTRY_FLOW_TARGETS.faction);
    expect(getEntryFlowTarget({
      identity: "Boss",
      activeServerId: "war-eu-01",
      preferredStartDistrictId: 27,
      selectedFaction: "hackeri",
      selectedStructure: "hackeři",
      factionLocked: true
    })).toBe(ENTRY_FLOW_TARGETS.game);
    expect(getActiveServerRegistration({ serverId: "war-eu-01" })).toMatchObject({
      serverId: CANONICAL_WAR_SERVER_ID,
      serverInstanceId: CANONICAL_WAR_SERVER_ID,
      serverName: "Vortex City WAR-01"
    });
    expect(hasLockedFaction({
      factionId: "hackeri",
      structure: "hackeři",
      lockedAt: "2026-04-26T10:00:00.000Z"
    })).toBe(true);
  });

  it("keeps free battle royale as the first public start option", () => {
    const session = saveLoginStep({
      identity: "Free Starter",
      isGuest: true,
      gangName: "Free Crew"
    });

    expect(session.registration).toMatchObject({
      identity: "Free Starter",
      gangName: "Free Crew",
      isGuest: true,
      loginKind: "guest"
    });
    expect(session.registration.serverMode).toBeUndefined();
    expect(SERVER_CATALOG[0]).toMatchObject({
      id: CANONICAL_FREE_SERVER_ID,
      mode: "free",
      capacity: 20,
      badge: "FREE Battle Royale",
      startLabel: "Začni zdarma"
    });
    expect(SERVER_CATALOG.find((server) => server.mode === "war")).toMatchObject({
      id: CANONICAL_WAR_SERVER_ID,
      badge: "WAR Mode"
    });
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
      activeServerId: CANONICAL_WAR_SERVER_ID,
      activeServerInstanceId: CANONICAL_WAR_SERVER_ID,
      activeServerName: "Vortex City WAR-01",
      activeServerMode: "war",
      activeServerRegion: "EU Central",
      activeServerStatus: "ONLINE",
      serverId: CANONICAL_WAR_SERVER_ID,
      serverInstanceId: CANONICAL_WAR_SERVER_ID,
      serverMode: "war",
      preferredStartDistrictId: 27,
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
    expect(session.world.ownedDistrictIds).toEqual([]);
  });

  it("stores server summary IDs as a client selection cache only", () => {
    saveLoginStep({
      identity: "Summary Boss",
      isGuest: true,
      mode: "free"
    });

    const session = saveLobbyStep({
      serverId: "instance:free:eu-central:public-1",
      districtId: 31,
      server: {
        id: "instance:free:eu-central:public-1",
        serverInstanceId: "instance:free:eu-central:public-1",
        name: "Neon Docks FREE-01",
        mode: "free",
        region: "EU Central",
        status: "lobby"
      }
    });

    expect(session.registration).toMatchObject({
      activeServerId: "instance:free:eu-central:public-1",
      activeServerInstanceId: "instance:free:eu-central:public-1",
      serverInstanceId: "instance:free:eu-central:public-1",
      serverMode: "free",
      preferredStartDistrictId: 31,
      startDistrictId: 31
    });
    expect(session.world.ownedDistrictIds).toEqual([]);
  });

  it("migrates legacy selected server objects to canonical serverInstanceId fields", () => {
    saveLoginStep({
      identity: "Legacy Summary Boss",
      isGuest: true,
      mode: "war"
    });

    const session = saveLobbyStep({
      serverId: "war-eu-01",
      districtId: 32,
      server: {
        id: "war-eu-01",
        serverInstanceId: "war-eu-01",
        name: "Legacy WAR",
        mode: "war",
        region: "EU Central",
        status: "ONLINE"
      }
    });

    expect(session.registration).toMatchObject({
      activeServerId: CANONICAL_WAR_SERVER_ID,
      activeServerInstanceId: CANONICAL_WAR_SERVER_ID,
      serverId: CANONICAL_WAR_SERVER_ID,
      serverInstanceId: CANONICAL_WAR_SERVER_ID,
      preferredStartDistrictId: 32
    });
  });
});
