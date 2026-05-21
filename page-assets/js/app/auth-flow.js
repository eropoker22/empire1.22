import {
  getAuthoritySession,
  updateStoredPreviewSession
} from "./model/authority-state.js";
import { STORAGE_KEYS } from "../config.js";
import {
  publicServerInstanceIdMigrationMap,
  publicServerRegistry,
  resolvePublicServerInstanceId
} from "../../../packages/game-config/src/public/public-server-registry.js";

const createMapSummary = (mapComposition) => {
  const composition = mapComposition && typeof mapComposition === "object" ? mapComposition : {};
  const downtownDistricts = Number(composition.downtown || 0) || 0;
  const commercialDistricts = Number(composition.commercial || 0) || 0;
  const industrialDistricts = Number(composition.industrial || 0) || 0;
  const residentialDistricts = Number(composition.residential || 0) || 0;
  const parkDistricts = Number(composition.park || 0) || 0;

  return {
    totalDistricts: downtownDistricts + commercialDistricts + industrialDistricts + residentialDistricts + parkDistricts,
    downtownDistricts,
    commercialDistricts,
    industrialDistricts,
    residentialDistricts,
    parkDistricts
  };
};

const createFallbackServerFromRegistry = (serverEntry) => {
  const locked = serverEntry.joinPolicy !== "open";
  const players = 0;
  const capacity = Math.max(1, Number(serverEntry.capacity || 1) || 1);

  return Object.freeze({
    id: serverEntry.serverInstanceId,
    serverInstanceId: serverEntry.serverInstanceId,
    name: serverEntry.displayName,
    mode: serverEntry.mode,
    region: serverEntry.region,
    players,
    capacity,
    startLabel: locked ? "Uzavřeno" : "Spawn confirmed by server",
    badge: serverEntry.mode === "war" ? "WAR" : "FREE",
    status: locked ? "LOCKED" : "ONLINE",
    activity: "LOW",
    locked,
    riskPercent: Math.round((players / capacity) * 100),
    description: `Public ${String(serverEntry.mode).toUpperCase()} instance from canonical server registry.`,
    map: createMapSummary(serverEntry.mapComposition)
  });
};

export const SERVER_CATALOG = Object.freeze(
  publicServerRegistry
    .filter((serverEntry) => serverEntry.isPublic)
    .map(createFallbackServerFromRegistry)
);

export const SERVER_ID_MIGRATION_MAP = publicServerInstanceIdMigrationMap;

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

function normalizeServerId(value) {
  return resolvePublicServerInstanceId(normalizeText(value));
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
  const normalizedServerId = normalizeServerId(serverId);
  return SERVER_CATALOG.find((server) => server.id === normalizedServerId) || null;
}

export function getActiveServerRegistration(registration = getRegistrationDraft()) {
  const serverId = normalizeServerId(registration?.activeServerId || registration?.serverId);
  const serverInstanceId = normalizeServerId(
    registration?.activeServerInstanceId || registration?.serverInstanceId || serverId
  );
  if (!serverId) {
    return null;
  }

  const server = getSelectedServer(serverId);
  const preferredStartDistrictId = normalizeDistrictId(
    registration?.preferredStartDistrictId || registration?.startDistrictId
  );
  return {
    serverId,
    serverInstanceId,
    serverName: normalizeText(registration?.activeServerName || registration?.serverLabel || server?.name || serverId),
    serverMode: normalizeMode(registration?.activeServerMode || registration?.serverMode || server?.mode) || "war",
    serverRegion: normalizeText(registration?.activeServerRegion || registration?.serverRegion || server?.region),
    serverStatus: normalizeText(registration?.activeServerStatus || server?.status || "ONLINE"),
    preferredStartDistrictId,
    startDistrictId: preferredStartDistrictId,
    assignedHomeDistrictId: normalizeText(registration?.assignedHomeDistrictId),
    lastServerConfirmedDistrictId: normalizeText(
      registration?.lastServerConfirmedDistrictId || registration?.assignedHomeDistrictId
    )
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

function createServerRegistrationFields(server) {
  const serverInstanceId = normalizeServerId(server.serverInstanceId || server.id);
  const serverId = normalizeServerId(server.id || server.serverInstanceId);
  return {
    activeServerId: serverId || serverInstanceId,
    activeServerInstanceId: serverInstanceId || serverId,
    activeServerName: server.name,
    activeServerMode: server.mode,
    activeServerRegion: server.region,
    activeServerStatus: server.status || "ONLINE",
    // Compatibility-only alias. New flows should read activeServerInstanceId.
    serverId: serverId || serverInstanceId,
    serverInstanceId: serverInstanceId || serverId,
    serverLabel: server.name,
    serverMode: server.mode,
    serverRegion: server.region
  };
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
  return Boolean(
    hasActiveServerRegistration(registration)
      && normalizeDistrictId(registration?.preferredStartDistrictId || registration?.startDistrictId)
  );
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
        ...(activeServer?.serverId ? createServerRegistrationFields({
          id: activeServer.serverId,
          serverInstanceId: activeServer.serverInstanceId,
          name: activeServer.serverName,
          mode: activeServer.serverMode,
          region: activeServer.serverRegion,
          status: activeServer.serverStatus
        }) : {}),
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
  const preferredStartDistrictId = normalizeDistrictId(districtId);

  if (!server || preferredStartDistrictId <= 0) {
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
      ...createServerRegistrationFields(server),
      preferredStartDistrictId,
      // Compatibility-only alias for legacy static runtime and old saved sessions.
      // Server-authoritative gameplay treats this as a lobby preference, never as a spawn claim.
      startDistrictId: preferredStartDistrictId,
      lobbyLockedAt: new Date().toISOString(),
      serverRegistrationStatus: SERVER_REGISTRATION_STATUS.selected,
      factionLocked: false,
      hasCompletedServerEntry: false
    },
    world: {
      ...(session.world || {}),
      ownedDistrictIds: []
    }
  }));
}

export function getOrCreateGuestIdentity() {
  const currentIdentity = String(getRegistrationDraft()?.identity || "").trim();
  return currentIdentity || createGuestIdentity();
}
