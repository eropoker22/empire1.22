import {
  getAuthoritySession,
  updateStoredPreviewSession
} from "./model/authority-state.js";

export const SERVER_CATALOG = Object.freeze([
  {
    id: "war-eu-01",
    name: "Vortex City WAR-01",
    mode: "war",
    region: "EU Central",
    players: 64,
    capacity: 150,
    startLabel: "Live server",
    badge: "HOT",
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
    badge: "QUEUE",
    description: "Čerstvě otevíraná instance, vhodná pro nový náběh a rychlé obsazení startovní pozice."
  },
  {
    id: "free-eu-01",
    name: "Neon Drift FREE-01",
    mode: "free",
    region: "EU Central",
    players: 8,
    capacity: 20,
    startLabel: "Volný vstup",
    badge: "FREE",
    description: "Volnější režim pro test buildů, economy loopu a klidnější rozjezdy gangu."
  },
  {
    id: "free-eu-02",
    name: "Afterglow FREE-02",
    mode: "free",
    region: "EU West",
    players: 14,
    capacity: 20,
    startLabel: "Live server",
    badge: "ACTIVE",
    description: "Rozjetý free shard s vyšší ekonomikou a otevřeným onboardingem pro nové hráče."
  }
]);

function createGuestIdentity() {
  const suffix = Math.floor(1000 + (Math.random() * 9000));
  return `Host-${suffix}`;
}

export function getRegistrationDraft() {
  return getAuthoritySession().registration || null;
}

export function getSelectedServer(serverId) {
  return SERVER_CATALOG.find((server) => server.id === serverId) || null;
}

export function ensureIdentity() {
  const registration = getRegistrationDraft();
  return Boolean(String(registration?.identity || "").trim());
}

export function ensureLobbySelection() {
  const registration = getRegistrationDraft();
  return Boolean(registration?.serverId && registration?.startDistrictId);
}

export function saveLoginStep({ identity, isGuest = false, gangName = "", mode = "" }) {
  const normalizedIdentity = String(identity || "").trim() || createGuestIdentity();
  const normalizedGangName = String(gangName || "").trim();
  const normalizedMode = String(mode || "").trim().toLowerCase();

  return updateStoredPreviewSession((session) => ({
    ...session,
    registration: {
      identity: normalizedIdentity,
      ...(normalizedGangName ? { gangName: normalizedGangName } : {}),
      ...(normalizedMode ? { serverMode: normalizedMode } : {}),
      isGuest,
      loginKind: isGuest ? "guest" : "account",
      lastLoginAt: new Date().toISOString()
    }
  }));
}

export function saveLobbyStep({ serverId, districtId }) {
  const server = getSelectedServer(serverId);
  const normalizedDistrictId = Number.parseInt(String(districtId || ""), 10) || 0;

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
      serverId: server.id,
      serverLabel: server.name,
      serverMode: server.mode,
      serverRegion: server.region,
      startDistrictId: normalizedDistrictId,
      lobbyLockedAt: new Date().toISOString()
    },
    world: {
      ...session.world,
      ownedDistrictIds: [normalizedDistrictId]
    }
  }));
}

export function getOrCreateGuestIdentity() {
  const currentIdentity = String(getRegistrationDraft()?.identity || "").trim();
  return currentIdentity || createGuestIdentity();
}
