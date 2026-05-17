import {
  getAuthoritySession,
  updateStoredPreviewSession
} from "./model/authority-state.js";
import { STORAGE_KEYS } from "../config.js";

export const SERVER_CATALOG = Object.freeze([
  {
    id: "war-eu-01",
    name: "Vortex City WAR-01",
    mode: "war",
    region: "EU Central",
    players: 64,
    capacity: 150,
    startLabel: "Live server",
    badge: "DOPORUČENO",
    status: "ONLINE",
    activity: "HIGH",
    riskPercent: 78,
    description: "Tvrdý válečný shard s rychlou expanzí, hustší konkurencí a tlakem na obranu districtů."
  },
  {
    id: "war-eu-02",
    name: "Black Harbor WAR-02",
    mode: "war",
    region: "EU Central",
    players: 41,
    capacity: 150,
    startLabel: "Start za 12 min",
    badge: "",
    status: "ONLINE",
    activity: "MEDIUM",
    riskPercent: 54,
    description: "Čerstvě otevřená instance, vhodná pro nový náběh a rychlé obsazení startovní pozice."
  },
  {
    id: "war-eu-03",
    name: "Red Sector WAR-03",
    mode: "war",
    region: "EU Central",
    players: 0,
    capacity: 150,
    startLabel: "Offline",
    badge: "",
    status: "POZASTAVEN",
    activity: "LOW",
    offline: true,
    riskPercent: 69,
    description: "Server je dočasně pozastavený a není dostupný pro vstup."
  },
  {
    id: "war-eu-04",
    name: "Iron Gate WAR-04",
    mode: "war",
    region: "EU Central",
    players: 0,
    capacity: 150,
    startLabel: "Připravujeme",
    badge: "",
    status: "PŘIPRAVUJEME",
    activity: "LOW",
    locked: true,
    riskPercent: 18,
    description: "Připravujeme spuštění serveru. Sleduj oznámení."
  },
  {
    id: "war-eu-05",
    name: "Kingmaker WAR-05",
    mode: "war",
    region: "EU Central",
    players: 5,
    capacity: 150,
    startLabel: "Premium required",
    badge: "PREMIUM",
    status: "LOCKED",
    activity: "LOW",
    locked: true,
    riskPercent: 34,
    description: "Nový válečný shard pro elitní gangy."
  },
  {
    id: "free-eu-01",
    name: "Neon Docks FREE-01",
    mode: "free",
    region: "EU Central",
    players: 17,
    capacity: 20,
    startLabel: "Končí za 01h 18m",
    badge: "NEJLEPŠÍ START",
    status: "ONLINE",
    activity: "MEDIUM",
    riskPercent: 42,
    description: "Rychlá válka o město. Ideální pro první vstup do Empire Streets."
  },
  {
    id: "free-eu-02",
    name: "Lowtown Riot FREE-02",
    mode: "free",
    region: "EU Central",
    players: 20,
    capacity: 20,
    startLabel: "Končí za 00h 47m",
    badge: "",
    status: "FULL",
    activity: "HIGH",
    full: true,
    riskPercent: 81,
    description: "Krátká session plná chaosu. Server je momentálně plný."
  },
  {
    id: "free-eu-03",
    name: "Rain Market FREE-03",
    mode: "free",
    region: "EU Central",
    players: 12,
    capacity: 20,
    startLabel: "Končí za 01h 42m",
    badge: "",
    status: "ONLINE",
    activity: "LOW",
    riskPercent: 28,
    description: "Vyvážená ekonomika, rychlý start, nízký heat."
  }
]);

export const ENTRY_FLOW_TARGETS = Object.freeze({
  login: "login",
  lobby: "lobby",
  faction: "faction",
  game: "game"
});

// Entry-flow state is stored inside STORAGE_KEYS.session -> registration.
// Existing fields stay intact for runtime compatibility; active*/selected*
// fields make the single-server contract explicit without adding a new key.
export const SERVER_REGISTRATION_STATUS = Object.freeze({
  selected: "server_selected",
  factionLocked: "faction_locked"
});

function createGuestIdentity() {
  const suffix = Math.floor(1000 + (Math.random() * 9000));
  return `Host-${suffix}`;
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeMode(mode) {
  const normalized = normalizeText(mode).toLowerCase();
  return normalized === "free" || normalized === "war" ? normalized : "";
}

function normalizeDistrictId(districtId) {
  return Number.parseInt(String(districtId || ""), 10) || 0;
}

export function getRegistrationDraft() {
  return getAuthoritySession().registration || null;
}

export function getSelectedServer(serverId) {
  return SERVER_CATALOG.find((server) => server.id === serverId) || null;
}

export function getActiveServerRegistration(registration = getRegistrationDraft()) {
  const serverId = normalizeText(registration?.activeServerId || registration?.serverId);
  const serverInstanceId = normalizeText(registration?.activeServerInstanceId || registration?.serverInstanceId || serverId);
  if (!serverId) {
    return null;
  }

  const server = getSelectedServer(serverId);
  return {
    serverId,
    serverInstanceId,
    serverName: normalizeText(registration?.activeServerName || registration?.serverLabel || server?.name || serverId),
    serverMode: normalizeMode(registration?.activeServerMode || registration?.serverMode || server?.mode) || "war",
    serverRegion: normalizeText(registration?.activeServerRegion || registration?.serverRegion || server?.region),
    serverStatus: normalizeText(registration?.activeServerStatus || server?.status || "ONLINE"),
    startDistrictId: normalizeDistrictId(registration?.startDistrictId)
  };
}

export function hasActiveServerRegistration(registration = getRegistrationDraft()) {
  return Boolean(getActiveServerRegistration(registration)?.serverId);
}

export function getLockedFactionRegistration(registration = getRegistrationDraft()) {
  const factionId = normalizeText(registration?.selectedFaction || registration?.factionId);
  const selectedStructure = normalizeText(
    registration?.selectedStructure
      || registration?.structure
      || registration?.structureId
      || factionId
  );
  const isLocked = Boolean(
    registration?.factionLocked
      || registration?.hasCompletedServerEntry
      || registration?.lockedAt
  );

  if (!factionId || !selectedStructure || !isLocked) {
    return null;
  }

  return {
    factionId,
    selectedStructure,
    factionLabel: normalizeText(registration?.factionLabel || factionId),
    lockedAt: normalizeText(registration?.lockedAt)
  };
}

export function hasLockedFaction(registration = getRegistrationDraft()) {
  return Boolean(getLockedFactionRegistration(registration));
}

export function getEntryFlowTarget(registration = getRegistrationDraft()) {
  if (!normalizeText(registration?.identity)) {
    return ENTRY_FLOW_TARGETS.login;
  }

  if (!hasActiveServerRegistration(registration)) {
    return ENTRY_FLOW_TARGETS.lobby;
  }

  if (!hasLockedFaction(registration)) {
    return ENTRY_FLOW_TARGETS.faction;
  }

  return ENTRY_FLOW_TARGETS.game;
}

export function ensureIdentity() {
  const registration = getRegistrationDraft();
  return Boolean(normalizeText(registration?.identity));
}

export function ensureLobbySelection() {
  const registration = getRegistrationDraft();
  return Boolean(hasActiveServerRegistration(registration) && normalizeDistrictId(registration?.startDistrictId));
}

export function clearAuthSession() {
  window.localStorage.removeItem(STORAGE_KEYS.token);
  window.localStorage.removeItem(STORAGE_KEYS.structure);

  return updateStoredPreviewSession((session) => ({
    ...session,
    registration: null,
    world: {
      ...session.world,
      ownedDistrictIds: []
    }
  }));
}

export function saveLoginStep({ identity, isGuest = false, gangName = "", mode = "" }) {
  const normalizedIdentity = normalizeText(identity) || createGuestIdentity();
  const normalizedGangName = normalizeText(gangName);
  const normalizedMode = normalizeMode(mode);

  return updateStoredPreviewSession((session) => {
    const activeServer = getActiveServerRegistration(session.registration);

    return {
      ...session,
      registration: {
        ...(session.registration || {}),
        identity: normalizedIdentity,
        ...(normalizedGangName ? { gangName: normalizedGangName } : {}),
        ...(activeServer
          ? { serverMode: activeServer.serverMode }
          : normalizedMode
            ? { serverMode: normalizedMode }
            : {}),
        isGuest,
        loginKind: isGuest ? "guest" : "account",
        lastLoginAt: new Date().toISOString()
      }
    };
  });
}

export function saveLobbyStep({ serverId, districtId, server: selectedServer = null }) {
  const server = selectedServer || getSelectedServer(serverId);
  const normalizedDistrictId = normalizeDistrictId(districtId);

  if (!server || normalizedDistrictId <= 0) {
    return null;
  }

  return updateStoredPreviewSession((session) => ({
    ...session,
    registration: {
      identity: session.registration?.identity,
      ...(session.registration?.gangName ? { gangName: session.registration.gangName } : {}),
      isGuest: Boolean(session.registration?.isGuest),
      loginKind: session.registration?.loginKind || (session.registration?.isGuest ? "guest" : "account"),
      ...(session.registration?.lastLoginAt ? { lastLoginAt: session.registration.lastLoginAt } : {}),
      activeServerId: server.id,
      activeServerInstanceId: normalizeText(server.serverInstanceId || server.id),
      activeServerName: server.name,
      activeServerMode: server.mode,
      activeServerRegion: server.region,
      activeServerStatus: server.status || "ONLINE",
      serverId: server.id,
      serverInstanceId: normalizeText(server.serverInstanceId || server.id),
      serverLabel: server.name,
      serverMode: server.mode,
      serverRegion: server.region,
      startDistrictId: normalizedDistrictId,
      lobbyLockedAt: new Date().toISOString(),
      serverRegistrationStatus: SERVER_REGISTRATION_STATUS.selected,
      factionLocked: false,
      hasCompletedServerEntry: false
    }
  }));
}

export function getOrCreateGuestIdentity() {
  const currentIdentity = String(getRegistrationDraft()?.identity || "").trim();
  return currentIdentity || createGuestIdentity();
}
