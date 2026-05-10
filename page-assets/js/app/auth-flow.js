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
    players: 22,
    capacity: 150,
    startLabel: "Live server",
    badge: "",
    status: "VYSOKÁ",
    activity: "HIGH",
    riskPercent: 69,
    description: "Vyvážený server s aktivní komunitou a častými bitvami."
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
