import { getAuthoritySession } from "../model/authority-state.js";

const LEADERBOARD_POPUP_OPEN_SELECTOR = "[data-leaderboard-popup-open]";
const LEADERBOARD_POPUP_SELECTOR = "[data-leaderboard-popup]";
const LEADERBOARD_POPUP_CLOSE_SELECTOR = "[data-leaderboard-popup-close]";
const LEADERBOARD_TAB_SELECTOR = "[data-leaderboard-tab]";
const LEADERBOARD_SEARCH_SELECTOR = "[data-leaderboard-search]";
const LEADERBOARD_FILTER_SELECTOR = "[data-leaderboard-filter]";
const LEADERBOARD_LIST_SELECTOR = "[data-leaderboard-list]";
const LEADERBOARD_STATS_SELECTOR = "[data-leaderboard-stats]";
const LEADERBOARD_SERVER_BADGE_SELECTOR = "[data-leaderboard-server-badge]";
const LEADERBOARD_PHASE_SELECTOR = "[data-leaderboard-phase]";
const LEADERBOARD_MY_RANK_SELECTOR = "[data-leaderboard-my-rank]";
const LEADERBOARD_DETAIL_SELECTOR = "[data-leaderboard-detail]";
const LEADERBOARD_PLAYER_DETAIL_SELECTOR = "[data-leaderboard-player-detail]";
const LEADERBOARD_PLAYER_DETAIL_CLOSE_SELECTOR = "[data-leaderboard-player-detail-close]";
const LEADERBOARD_TOAST_SELECTOR = "[data-leaderboard-toast]";
const LEADERBOARD_TOAST_TITLE_SELECTOR = "[data-leaderboard-toast-title]";
const LEADERBOARD_TOAST_MESSAGE_SELECTOR = "[data-leaderboard-toast-message]";
const LEADERBOARD_TABLE_TITLE_SELECTOR = "[data-leaderboard-table-title]";
const LEADERBOARD_MODE_LABEL_SELECTOR = "[data-leaderboard-mode-label]";
const LEADERBOARD_COUNT_SELECTOR = "[data-leaderboard-count]";

const SELECTED_SERVER_STORAGE_KEY = "empirestreets.selectedServer";
const PLAYER_STATE_STORAGE_KEY = "empirestreets.playerState";
const DEFAULT_SERVER_ID = "war-eu-01";

const SERVER_LABELS = Object.freeze({
  "war-eu-01": { label: "WAR-01", mode: "war" },
  "war-eu-02": { label: "WAR-02", mode: "war" },
  "war-eu-03": { label: "WAR-03", mode: "war" },
  "free-eu-01": { label: "FREE-01", mode: "free" },
  "free-eu-02": { label: "FREE-02", mode: "free" },
  "free-eu-03": { label: "FREE-03", mode: "free" }
});

const TAB_CONFIG = Object.freeze({
  overall: {
    label: "CELKOVĚ",
    title: "Empire Score",
    copy: "Tady se ukazuje, kdo skutečně vlastní město.",
    empty: "Žádný boss neodpovídá aktuálním filtrům."
  },
  influence: {
    label: "VLIV",
    title: "Influence Control",
    copy: "Vliv ukazuje, kdo tahá za kontakty, strach a loajalitu ulic.",
    empty: "Žádný vlivový cíl neodpovídá filtrům."
  },
  districts: {
    label: "DISTRIKTY",
    title: "District Control",
    copy: "Kontrola districtů rozhoduje, kdo drží mapu pod krkem.",
    empty: "Žádné district skóre neodpovídá filtrům."
  },
  money: {
    label: "PENÍZE",
    title: "Cash Pressure",
    copy: "Čisté a špinavé peníze ukazují, kdo dokáže válku financovat.",
    empty: "Žádná ekonomická stopa neodpovídá filtrům."
  },
  wanted: {
    label: "WANTED",
    title: "PUBLIC ENEMY LIST",
    copy: "Public Enemy List ukazuje bosse, kterým už policie dýchá na záda.",
    empty: "Nikdo v hledáčku policie neodpovídá filtrům."
  },
  attacks: {
    label: "ÚTOKY",
    title: "Attack Index",
    copy: "Útoky, robbery a zabité jednotky ukazují, kdo na serveru tlačí násilím.",
    empty: "Žádný agresor neodpovídá filtrům."
  },
  alliance: {
    label: "ALIANCE",
    title: "Alliance Dominance",
    copy: "Aliance ukazují, které pakty mají město rozebrané na části.",
    empty: "Žádná aliance neodpovídá filtrům."
  }
});

export const leaderboardState = {
  activeTab: "overall",
  selectedPlayerId: null,
  selectedServerId: null,
  searchQuery: "",
  modeFilter: "current"
};

const MOCK_PLAYERS = Object.freeze([
  {
    id: "guest-5470",
    name: "Host-5470",
    gangName: "Ghost Crew",
    faction: "Mafia",
    alliance: "Black Sun Pact",
    districts: 8,
    cleanMoney: 82000,
    dirtyMoney: 116000,
    influence: 590,
    wanted: 260,
    successfulAttacks: 18,
    successfulDefenses: 11,
    robberies: 16,
    unitsKilled: 430,
    unitsLost: 215,
    buildingsOwned: 21,
    lastRank: 14,
    currentRank: 12,
    lastActiveMinutes: 4,
    isCurrentPlayer: true,
    serverId: "war-eu-01",
    serverLabel: "WAR-01",
    mode: "war"
  },
  {
    id: "raven",
    name: "Raven",
    gangName: "Northline Syndicate",
    faction: "Mafia",
    alliance: "Black Sun Pact",
    districts: 18,
    cleanMoney: 245000,
    dirtyMoney: 388000,
    influence: 1320,
    wanted: 420,
    successfulAttacks: 42,
    successfulDefenses: 27,
    robberies: 31,
    unitsKilled: 1280,
    unitsLost: 410,
    buildingsOwned: 49,
    lastRank: 6,
    currentRank: 5,
    lastActiveMinutes: 7,
    serverId: "war-eu-01",
    serverLabel: "WAR-01",
    mode: "war"
  },
  {
    id: "hex",
    name: "Hex",
    gangName: "Hex-91 Block",
    faction: "Hackeři",
    alliance: "Chrome Choir",
    districts: 15,
    cleanMoney: 198000,
    dirtyMoney: 260000,
    influence: 1105,
    wanted: 610,
    successfulAttacks: 37,
    successfulDefenses: 19,
    robberies: 42,
    unitsKilled: 990,
    unitsLost: 360,
    buildingsOwned: 41,
    lastRank: 4,
    currentRank: 7,
    lastActiveMinutes: 36,
    serverId: "war-eu-01",
    serverLabel: "WAR-01",
    mode: "war"
  },
  {
    id: "nyx",
    name: "Nyx",
    gangName: "Velvet Knives",
    faction: "Tajná organizace",
    alliance: "Velvet Accord",
    districts: 13,
    cleanMoney: 224000,
    dirtyMoney: 141000,
    influence: 1460,
    wanted: 180,
    successfulAttacks: 24,
    successfulDefenses: 33,
    robberies: 15,
    unitsKilled: 650,
    unitsLost: 160,
    buildingsOwned: 37,
    lastRank: 5,
    currentRank: 4,
    lastActiveMinutes: 12,
    serverId: "war-eu-01",
    serverLabel: "WAR-01",
    mode: "war"
  },
  {
    id: "viper",
    name: "Viper",
    gangName: "Acid Runners",
    faction: "Kartel",
    alliance: "Black Sun Pact",
    districts: 11,
    cleanMoney: 88000,
    dirtyMoney: 310000,
    influence: 840,
    wanted: 735,
    successfulAttacks: 49,
    successfulDefenses: 12,
    robberies: 55,
    unitsKilled: 1510,
    unitsLost: 670,
    buildingsOwned: 30,
    lastRank: 9,
    currentRank: 6,
    lastActiveMinutes: 2,
    serverId: "war-eu-01",
    serverLabel: "WAR-01",
    mode: "war"
  },
  {
    id: "iron-saint",
    name: "Iron Saint",
    gangName: "Iron Chapel",
    faction: "Soukromá armáda",
    alliance: "Iron Parish",
    districts: 20,
    cleanMoney: 192000,
    dirtyMoney: 225000,
    influence: 1190,
    wanted: 540,
    successfulAttacks: 34,
    successfulDefenses: 48,
    robberies: 12,
    unitsKilled: 1430,
    unitsLost: 510,
    buildingsOwned: 58,
    lastRank: 2,
    currentRank: 2,
    lastActiveMinutes: 18,
    serverId: "war-eu-01",
    serverLabel: "WAR-01",
    mode: "war"
  },
  {
    id: "black-lotus",
    name: "Black Lotus",
    gangName: "Lotus Exchange",
    faction: "Korporace",
    alliance: "Velvet Accord",
    districts: 12,
    cleanMoney: 420000,
    dirtyMoney: 102000,
    influence: 1040,
    wanted: 72,
    successfulAttacks: 15,
    successfulDefenses: 21,
    robberies: 8,
    unitsKilled: 420,
    unitsLost: 120,
    buildingsOwned: 44,
    lastRank: 8,
    currentRank: 8,
    lastActiveMinutes: 9,
    serverId: "war-eu-01",
    serverLabel: "WAR-01",
    mode: "war"
  },
  {
    id: "neon-butcher",
    name: "Neon Butcher",
    gangName: "Meatlight Crew",
    faction: "Motogang",
    alliance: "Chrome Choir",
    districts: 10,
    cleanMoney: 72000,
    dirtyMoney: 232000,
    influence: 760,
    wanted: 880,
    successfulAttacks: 61,
    successfulDefenses: 8,
    robberies: 38,
    unitsKilled: 1770,
    unitsLost: 920,
    buildingsOwned: 26,
    lastRank: 13,
    currentRank: 9,
    lastActiveMinutes: 3,
    serverId: "war-eu-02",
    serverLabel: "WAR-02",
    mode: "war"
  },
  {
    id: "ghost-dealer",
    name: "Ghost Dealer",
    gangName: "Quiet Market",
    faction: "Kartel",
    alliance: "Ghost Market",
    districts: 7,
    cleanMoney: 336000,
    dirtyMoney: 92000,
    influence: 690,
    wanted: 58,
    successfulAttacks: 9,
    successfulDefenses: 16,
    robberies: 22,
    unitsKilled: 310,
    unitsLost: 90,
    buildingsOwned: 23,
    lastRank: 15,
    currentRank: 13,
    lastActiveMinutes: 14,
    serverId: "free-eu-01",
    serverLabel: "FREE-01",
    mode: "free"
  },
  {
    id: "chrome-wolf",
    name: "Chrome Wolf",
    gangName: "Wolf Grid",
    faction: "Hackeři",
    alliance: "Chrome Choir",
    districts: 14,
    cleanMoney: 154000,
    dirtyMoney: 187000,
    influence: 920,
    wanted: 310,
    successfulAttacks: 28,
    successfulDefenses: 29,
    robberies: 27,
    unitsKilled: 890,
    unitsLost: 330,
    buildingsOwned: 35,
    lastRank: 7,
    currentRank: 10,
    lastActiveMinutes: 22,
    serverId: "free-eu-01",
    serverLabel: "FREE-01",
    mode: "free"
  },
  {
    id: "silent-crown",
    name: "Silent Crown",
    gangName: "Crown Silence",
    faction: "Tajná organizace",
    alliance: "Velvet Accord",
    districts: 17,
    cleanMoney: 285000,
    dirtyMoney: 142000,
    influence: 1675,
    wanted: 94,
    successfulAttacks: 20,
    successfulDefenses: 44,
    robberies: 10,
    unitsKilled: 610,
    unitsLost: 130,
    buildingsOwned: 52,
    lastRank: 1,
    currentRank: 1,
    lastActiveMinutes: 1,
    serverId: "war-eu-02",
    serverLabel: "WAR-02",
    mode: "war"
  },
  {
    id: "blood-maven",
    name: "Blood Maven",
    gangName: "Red Ledger",
    faction: "Mafia",
    alliance: "Iron Parish",
    districts: 16,
    cleanMoney: 122000,
    dirtyMoney: 410000,
    influence: 990,
    wanted: 970,
    successfulAttacks: 58,
    successfulDefenses: 18,
    robberies: 46,
    unitsKilled: 1860,
    unitsLost: 780,
    buildingsOwned: 40,
    lastRank: 3,
    currentRank: 3,
    lastActiveMinutes: 5,
    serverId: "war-eu-01",
    serverLabel: "WAR-01",
    mode: "war"
  },
  {
    id: "district-rat",
    name: "District Rat",
    gangName: "Sewer Kings",
    faction: "Kult",
    alliance: "Ghost Market",
    districts: 9,
    cleanMoney: 68000,
    dirtyMoney: 174000,
    influence: 520,
    wanted: 240,
    successfulAttacks: 16,
    successfulDefenses: 25,
    robberies: 33,
    unitsKilled: 580,
    unitsLost: 210,
    buildingsOwned: 24,
    lastRank: 16,
    currentRank: 15,
    lastActiveMinutes: 48,
    serverId: "free-eu-02",
    serverLabel: "FREE-02",
    mode: "free"
  },
  {
    id: "velvet-snake",
    name: "Velvet Snake",
    gangName: "Snake Room",
    faction: "Tajná organizace",
    alliance: "Velvet Accord",
    districts: 6,
    cleanMoney: 205000,
    dirtyMoney: 77000,
    influence: 1130,
    wanted: 130,
    successfulAttacks: 11,
    successfulDefenses: 18,
    robberies: 9,
    unitsKilled: 260,
    unitsLost: 80,
    buildingsOwned: 19,
    lastRank: 10,
    currentRank: 14,
    lastActiveMinutes: 19,
    serverId: "free-eu-01",
    serverLabel: "FREE-01",
    mode: "free"
  },
  {
    id: "zero-prophet",
    name: "Zero Prophet",
    gangName: "Afterglow Circuit",
    faction: "Hackeři",
    alliance: "Chrome Choir",
    districts: 12,
    cleanMoney: 175000,
    dirtyMoney: 98000,
    influence: 1250,
    wanted: 205,
    successfulAttacks: 23,
    successfulDefenses: 21,
    robberies: 14,
    unitsKilled: 640,
    unitsLost: 190,
    buildingsOwned: 29,
    lastRank: 11,
    currentRank: 11,
    lastActiveMinutes: 8,
    serverId: "free-eu-02",
    serverLabel: "FREE-02",
    mode: "free"
  },
  {
    id: "kader-crew",
    name: "Kadeř Crew",
    gangName: "Razorshop Saints",
    faction: "Motogang",
    alliance: "Black Sun Pact",
    districts: 5,
    cleanMoney: 112000,
    dirtyMoney: 128000,
    influence: 460,
    wanted: 340,
    successfulAttacks: 19,
    successfulDefenses: 9,
    robberies: 29,
    unitsKilled: 480,
    unitsLost: 260,
    buildingsOwned: 17,
    lastRank: 17,
    currentRank: 16,
    lastActiveMinutes: 11,
    serverId: "free-eu-01",
    serverLabel: "FREE-01",
    mode: "free"
  },
  {
    id: "switch-runner",
    name: "Switch Runner",
    gangName: "Switch Yard",
    faction: "Korporace",
    alliance: "Ghost Market",
    districts: 4,
    cleanMoney: 262000,
    dirtyMoney: 54000,
    influence: 610,
    wanted: 88,
    successfulAttacks: 7,
    successfulDefenses: 13,
    robberies: 18,
    unitsKilled: 210,
    unitsLost: 60,
    buildingsOwned: 16,
    lastRank: 18,
    currentRank: 18,
    lastActiveMinutes: 6,
    serverId: "free-eu-03",
    serverLabel: "FREE-03",
    mode: "free"
  },
  {
    id: "vale-syndicate",
    name: "Vale Syndicate",
    gangName: "Vale Syndicate",
    faction: "Korporace",
    alliance: "Velvet Accord",
    districts: 13,
    cleanMoney: 310000,
    dirtyMoney: 176000,
    influence: 1015,
    wanted: 390,
    successfulAttacks: 25,
    successfulDefenses: 32,
    robberies: 19,
    unitsKilled: 720,
    unitsLost: 260,
    buildingsOwned: 43,
    lastRank: 12,
    currentRank: 10,
    lastActiveMinutes: 28,
    serverId: "war-eu-02",
    serverLabel: "WAR-02",
    mode: "war"
  },
  {
    id: "night-vulture",
    name: "Night Vulture",
    gangName: "Night Vultures",
    faction: "Mafia",
    alliance: "Black Sun Pact",
    districts: 19,
    cleanMoney: 238000,
    dirtyMoney: 330000,
    influence: 1210,
    wanted: 680,
    successfulAttacks: 45,
    successfulDefenses: 26,
    robberies: 36,
    unitsKilled: 1390,
    unitsLost: 540,
    buildingsOwned: 55,
    lastRank: 6,
    currentRank: 4,
    lastActiveMinutes: 10,
    serverId: "war-eu-03",
    serverLabel: "WAR-03",
    mode: "war"
  },
  {
    id: "rust-bishop",
    name: "Rust Bishop",
    gangName: "Rusted Parish",
    faction: "Kult",
    alliance: "Iron Parish",
    districts: 7,
    cleanMoney: 94000,
    dirtyMoney: 149000,
    influence: 705,
    wanted: 455,
    successfulAttacks: 21,
    successfulDefenses: 22,
    robberies: 17,
    unitsKilled: 560,
    unitsLost: 230,
    buildingsOwned: 20,
    lastRank: 19,
    currentRank: 17,
    lastActiveMinutes: 16,
    serverId: "free-eu-02",
    serverLabel: "FREE-02",
    mode: "free"
  }
]);

const leaderboardContext = {
  root: null,
  popup: null,
  card: null,
  tabs: [],
  filters: [],
  searchInput: null,
  listElement: null,
  statsElement: null,
  serverBadgeElement: null,
  phaseElement: null,
  myRankElement: null,
  detailElement: null,
  playerDetailShell: null,
  playerDetailCard: null,
  playerDetailCloseElements: [],
  toastElement: null,
  toastTitleElement: null,
  toastMessageElement: null,
  tableTitleElement: null,
  modeLabelElement: null,
  countElement: null,
  previousActiveElement: null,
  toastTimer: 0,
  bound: false
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function readStorageJson(key) {
  try {
    const storage = globalThis.window?.localStorage || globalThis.localStorage || null;
    const rawValue = storage?.getItem(key);
    return rawValue ? JSON.parse(rawValue) : null;
  } catch (error) {
    console.warn(`Leaderboard storage read failed for ${key}.`, error);
    return null;
  }
}

function normalizeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : fallback;
}

function normalizeText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function getServerMeta(serverId = "") {
  const normalizedServerId = normalizeText(serverId, DEFAULT_SERVER_ID).toLowerCase();
  const meta = SERVER_LABELS[normalizedServerId] || null;
  const inferredMode = normalizedServerId.includes("free") ? "free" : "war";
  return {
    serverId: normalizedServerId,
    serverLabel: meta?.label || normalizedServerId.toUpperCase(),
    mode: meta?.mode || inferredMode
  };
}

function getSelectedServerStorage() {
  const selectedServer = readStorageJson(SELECTED_SERVER_STORAGE_KEY);
  return selectedServer && typeof selectedServer === "object" ? selectedServer : null;
}

function getPlayerStateStorage() {
  const playerState = readStorageJson(PLAYER_STATE_STORAGE_KEY);
  return playerState && typeof playerState === "object" ? playerState : null;
}

function getCurrentServerScope(session = getAuthoritySession()) {
  const selectedServer = getSelectedServerStorage();
  const registration = session.registration || {};
  const serverId = normalizeText(
    registration.serverId || selectedServer?.serverId,
    DEFAULT_SERVER_ID
  );
  const serverMeta = getServerMeta(serverId);

  return {
    ...serverMeta,
    serverLabel: normalizeText(registration.serverLabel, serverMeta.serverLabel)
  };
}

function formatCityMinutes(minutes) {
  const normalized = normalizeNumber(minutes, 0) % (24 * 60);
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function getServerPhaseLabel(session = getAuthoritySession()) {
  const phaseState = session.world?.phaseState || {};
  const gamePhase = normalizeText(phaseState.gamePhase, "live").toUpperCase();
  const mapPhase = normalizeText(phaseState.mapPhase, "night").toUpperCase();
  const time = formatCityMinutes(phaseState.cityMinutes ?? (22 * 60 + 14));
  return `${gamePhase} / ${mapPhase} ${time}`;
}

function countOwnedBuildings(session) {
  const buildings = session.production?.buildings;
  if (!buildings || typeof buildings !== "object") {
    return 0;
  }

  return Object.values(buildings)
    .filter((building) => building && typeof building === "object" && normalizeNumber(building.level, 0) > 0)
    .length;
}

function countResolvedOrders(orders) {
  if (!Array.isArray(orders)) {
    return 0;
  }

  return orders.filter((order) => order && typeof order === "object").length;
}

function createCurrentPlayerFromSources() {
  const fallback = MOCK_PLAYERS.find((player) => player.isCurrentPlayer) || MOCK_PLAYERS[0];
  const session = getAuthoritySession();
  const registration = session.registration || null;
  const playerState = getPlayerStateStorage();

  if (!registration && !playerState) {
    return { ...fallback };
  }

  const serverScope = getCurrentServerScope(session);
  const ownedDistricts = Array.isArray(session.world?.ownedDistrictIds)
    ? session.world.ownedDistrictIds.length
    : null;

  return {
    ...fallback,
    id: normalizeText(playerState?.id, fallback.id),
    name: normalizeText(registration?.identity || playerState?.name, fallback.name),
    gangName: normalizeText(registration?.gangName || playerState?.gangName, fallback.gangName),
    faction: normalizeText(registration?.factionLabel || registration?.factionId || playerState?.faction, fallback.faction),
    alliance: normalizeText(playerState?.alliance || playerState?.allianceName, fallback.alliance),
    districts: normalizeNumber(playerState?.districts ?? ownedDistricts, fallback.districts),
    cleanMoney: normalizeNumber(playerState?.cleanMoney ?? session.economy?.cleanMoney, fallback.cleanMoney),
    dirtyMoney: normalizeNumber(playerState?.dirtyMoney ?? session.economy?.dirtyMoney, fallback.dirtyMoney),
    influence: normalizeNumber(playerState?.influence ?? session.gang?.influence, fallback.influence),
    wanted: normalizeNumber(playerState?.wanted ?? session.gang?.heat, fallback.wanted),
    successfulAttacks: normalizeNumber(playerState?.successfulAttacks, countResolvedOrders(session.missions?.attackOrders) || fallback.successfulAttacks),
    successfulDefenses: normalizeNumber(playerState?.successfulDefenses, fallback.successfulDefenses),
    robberies: normalizeNumber(playerState?.robberies, countResolvedOrders(session.missions?.robberyOrders) || fallback.robberies),
    unitsKilled: normalizeNumber(playerState?.unitsKilled, fallback.unitsKilled),
    unitsLost: normalizeNumber(playerState?.unitsLost, fallback.unitsLost),
    buildingsOwned: normalizeNumber(playerState?.buildingsOwned, countOwnedBuildings(session) || fallback.buildingsOwned),
    lastRank: normalizeNumber(playerState?.lastRank, fallback.lastRank),
    currentRank: normalizeNumber(playerState?.currentRank, fallback.currentRank),
    lastActiveMinutes: normalizeNumber(playerState?.lastActiveMinutes, 2),
    isCurrentPlayer: true,
    serverId: serverScope.serverId,
    serverLabel: serverScope.serverLabel,
    mode: serverScope.mode
  };
}

export function getCurrentPlayerId() {
  return createCurrentPlayerFromSources().id;
}

export function calculateEmpireScore(player) {
  const districts = normalizeNumber(player?.districts);
  const influence = normalizeNumber(player?.influence);
  const cleanMoney = normalizeNumber(player?.cleanMoney);
  const dirtyMoney = normalizeNumber(player?.dirtyMoney);
  const buildingsOwned = normalizeNumber(player?.buildingsOwned);
  const successfulAttacks = normalizeNumber(player?.successfulAttacks);
  const successfulDefenses = normalizeNumber(player?.successfulDefenses);
  const robberies = normalizeNumber(player?.robberies);
  const unitsKilled = normalizeNumber(player?.unitsKilled);
  const unitsLost = normalizeNumber(player?.unitsLost);
  const wanted = normalizeNumber(player?.wanted);

  return Math.round(
    (districts * 2500)
    + (influence * 1.2)
    + (cleanMoney * 0.015)
    + (dirtyMoney * 0.01)
    + (buildingsOwned * 350)
    + (successfulAttacks * 420)
    + (successfulDefenses * 260)
    + (robberies * 180)
    + (unitsKilled * 12)
    - (unitsLost * 6)
    - (Math.max(0, wanted - 500) * 3)
  );
}

export function getLeaderboardPlayers() {
  const currentPlayer = createCurrentPlayerFromSources();
  const players = MOCK_PLAYERS
    .filter((player) => !player.isCurrentPlayer && player.id !== currentPlayer.id)
    .map((player) => ({ ...player, isCurrentPlayer: false }));

  return [currentPlayer, ...players].map((player) => ({
    ...player,
    empireScore: calculateEmpireScore(player)
  }));
}

function playerMatchesSearch(player, query) {
  if (!query) {
    return true;
  }

  const haystack = [
    player.name,
    player.gangName,
    player.faction,
    player.alliance,
    player.serverLabel
  ].join(" ").toLowerCase();
  return haystack.includes(query);
}

function getCurrentAlliance(players) {
  return players.find((player) => player.isCurrentPlayer)?.alliance || "";
}

function filterPlayers(players, options = {}) {
  const modeFilter = options.modeFilter || leaderboardState.modeFilter;
  const query = options.includeSearch === false
    ? ""
    : normalizeText(leaderboardState.searchQuery).toLowerCase();
  const selectedServerId = leaderboardState.selectedServerId || getCurrentServerScope().serverId;
  const currentAlliance = getCurrentAlliance(players);

  return players.filter((player) => {
    if (!playerMatchesSearch(player, query)) {
      return false;
    }

    if (modeFilter === "current") {
      return player.serverId === selectedServerId;
    }

    if (modeFilter === "free" || modeFilter === "war") {
      return player.mode === modeFilter;
    }

    if (modeFilter === "alliance") {
      return Boolean(currentAlliance) && player.alliance === currentAlliance;
    }

    if (modeFilter === "active") {
      return normalizeNumber(player.lastActiveMinutes, 999) <= 20;
    }

    return true;
  });
}

function getAttackIndex(player) {
  return normalizeNumber(player.successfulAttacks)
    + normalizeNumber(player.robberies)
    + normalizeNumber(player.unitsKilled);
}

function sortPlayers(players, tab) {
  const sorters = {
    overall: (player) => player.empireScore,
    influence: (player) => normalizeNumber(player.influence),
    districts: (player) => normalizeNumber(player.districts),
    money: (player) => normalizeNumber(player.cleanMoney) + normalizeNumber(player.dirtyMoney),
    wanted: (player) => normalizeNumber(player.wanted),
    attacks: getAttackIndex
  };
  const scoreForTab = sorters[tab] || sorters.overall;

  return [...players].sort((left, right) => (
    scoreForTab(right) - scoreForTab(left)
    || right.empireScore - left.empireScore
    || normalizeText(left.name).localeCompare(normalizeText(right.name), "cs")
  ));
}

function rankPlayers(players) {
  return players.map((player, index) => ({
    ...player,
    currentRank: index + 1
  }));
}

export function getSortedLeaderboard(tab = leaderboardState.activeTab) {
  const players = filterPlayers(getLeaderboardPlayers());
  return rankPlayers(sortPlayers(players, tab === "alliance" ? "overall" : tab));
}

export function getAllianceLeaderboard(players = getLeaderboardPlayers()) {
  const alliances = new Map();

  for (const player of players) {
    const allianceName = normalizeText(player.alliance, "Bez aliance");
    const current = alliances.get(allianceName) || {
      alliance: allianceName,
      members: 0,
      totalEmpireScore: 0,
      totalDistricts: 0,
      totalInfluence: 0,
      totalWanted: 0,
      totalActivity: 0,
      topPlayer: null
    };

    current.members += 1;
    current.totalEmpireScore += calculateEmpireScore(player);
    current.totalDistricts += normalizeNumber(player.districts);
    current.totalInfluence += normalizeNumber(player.influence);
    current.totalWanted += normalizeNumber(player.wanted);
    current.totalActivity += normalizeNumber(player.lastActiveMinutes);
    current.topPlayer = !current.topPlayer || calculateEmpireScore(player) > calculateEmpireScore(current.topPlayer)
      ? player
      : current.topPlayer;

    alliances.set(allianceName, current);
  }

  return Array.from(alliances.values())
    .map((alliance) => ({
      ...alliance,
      averageActivity: alliance.members ? Math.round(alliance.totalActivity / alliance.members) : 0
    }))
    .sort((left, right) => right.totalEmpireScore - left.totalEmpireScore || right.totalInfluence - left.totalInfluence)
    .map((alliance, index) => ({
      ...alliance,
      rank: index + 1
    }));
}

function getVisibleAllianceLeaderboard() {
  const players = filterPlayers(getLeaderboardPlayers());
  const query = normalizeText(leaderboardState.searchQuery).toLowerCase();
  const alliances = getAllianceLeaderboard(players);

  if (!query) {
    return alliances;
  }

  return alliances.filter((alliance) => {
    const haystack = [
      alliance.alliance,
      alliance.topPlayer?.name,
      alliance.topPlayer?.gangName
    ].join(" ").toLowerCase();
    return haystack.includes(query);
  });
}

function formatNumber(value) {
  return normalizeNumber(value).toLocaleString("cs-CZ");
}

function formatMoney(value) {
  return `$${formatNumber(value)}`;
}

function formatActivity(minutes) {
  const safeMinutes = normalizeNumber(minutes);
  if (safeMinutes <= 1) {
    return "právě teď";
  }
  if (safeMinutes < 60) {
    return `před ${safeMinutes} min`;
  }
  return `před ${Math.floor(safeMinutes / 60)} h`;
}

function getTrendHtml(player) {
  const currentRank = normalizeNumber(player.currentRank);
  const lastRank = normalizeNumber(player.lastRank, currentRank);
  const delta = lastRank - currentRank;

  if (delta > 0) {
    return `<span class="leaderboard-trend leaderboard-trend--up">▲ +${formatNumber(delta)}</span>`;
  }

  if (delta < 0) {
    return `<span class="leaderboard-trend leaderboard-trend--down">▼ -${formatNumber(Math.abs(delta))}</span>`;
  }

  return '<span class="leaderboard-trend leaderboard-trend--flat">●</span>';
}

function getWantedClass(wanted) {
  const value = normalizeNumber(wanted);
  if (value <= 100) return "leaderboard-wanted--low";
  if (value <= 300) return "leaderboard-wanted--medium";
  if (value <= 600) return "leaderboard-wanted--high";
  return "leaderboard-wanted--critical";
}

function getRankClass(rank) {
  if (rank === 1) return "is-rank-1";
  if (rank === 2) return "is-rank-2";
  if (rank === 3) return "is-rank-3";
  return "";
}

function getPlayerStatusText(player) {
  if (normalizeNumber(player.wanted) >= 600) {
    return "Policie ho má na radaru.";
  }

  if (normalizeNumber(player.districts) >= 16) {
    return "Kontroluje velkou část města.";
  }

  if ((normalizeNumber(player.successfulAttacks) + normalizeNumber(player.robberies)) >= 60) {
    return "Agresivní hráč. Nečekej klid.";
  }

  if (normalizeNumber(player.wanted) <= 100 && calculateEmpireScore(player) >= 52000) {
    return "Tichý boss. Nebezpečný, protože nepřitahuje pozornost.";
  }

  return "Drží stabilní pozici, ale město se může otočit během jedné noci.";
}

function createStat(label, value) {
  return `
    <span class="leaderboard-popup-stat">
      <small>${escapeHtml(label)}</small>
      <strong>${escapeHtml(value)}</strong>
    </span>
  `;
}

function getRankSummary(players) {
  const totalEmpireScore = players.reduce((sum, player) => sum + calculateEmpireScore(player), 0);
  const totalWanted = players.reduce((sum, player) => sum + normalizeNumber(player.wanted), 0);
  const activePlayers = players.filter((player) => normalizeNumber(player.lastActiveMinutes, 999) <= 20).length;

  return {
    totalPlayers: players.length,
    totalEmpireScore,
    totalWanted,
    activePlayers
  };
}

function renderStats(players, alliances = []) {
  if (!leaderboardContext.statsElement) {
    return;
  }

  if (leaderboardState.activeTab === "alliance") {
    const topAlliance = alliances[0];
    leaderboardContext.statsElement.innerHTML = [
      createStat("Aliance", formatNumber(alliances.length)),
      createStat("Top pakt", topAlliance?.alliance || "-"),
      createStat("District tlak", formatNumber(alliances.reduce((sum, alliance) => sum + alliance.totalDistricts, 0))),
      createStat("Wanted pressure", formatNumber(alliances.reduce((sum, alliance) => sum + alliance.totalWanted, 0)))
    ].join("");
    return;
  }

  const summary = getRankSummary(players);
  leaderboardContext.statsElement.innerHTML = [
    createStat("Hráči ve výpisu", formatNumber(summary.totalPlayers)),
    createStat("Online / aktivní", formatNumber(summary.activePlayers)),
    createStat("Empire tlak", formatNumber(summary.totalEmpireScore)),
    createStat("Police heat", formatNumber(summary.totalWanted))
  ].join("");
}

function renderPlayerRow(player) {
  const rank = normalizeNumber(player.currentRank);
  const wantedClass = getWantedClass(player.wanted);
  const rankClass = getRankClass(rank);
  const score = formatNumber(player.empireScore);
  const selectedClass = leaderboardState.selectedPlayerId === player.id ? " is-selected" : "";
  const currentClass = player.isCurrentPlayer ? " is-current" : "";

  return `
    <article class="leaderboard-table-row${currentClass}${selectedClass}" data-leaderboard-player-id="${escapeHtml(player.id)}" tabindex="0">
      <span class="leaderboard-rank-cell ${rankClass}">#${formatNumber(rank)}</span>
      ${getTrendHtml(player)}
      <span class="leaderboard-player-cell">
        <strong>${escapeHtml(player.isCurrentPlayer ? `${player.name} (ty)` : player.name)}</strong>
        <span class="leaderboard-player-score-mobile" aria-label="Skóre ${score}">${escapeHtml(score)}</span>
        <span class="leaderboard-player-gang">${escapeHtml(player.gangName)}</span>
      </span>
      <span class="leaderboard-cell-muted">${escapeHtml(player.faction)}</span>
      <span class="leaderboard-cell-muted">${escapeHtml(player.alliance)}</span>
      <span class="leaderboard-number-cell">${formatNumber(player.districts)}</span>
      <span class="leaderboard-number-cell">${formatNumber(player.influence)}</span>
      <span><span class="leaderboard-wanted ${wantedClass}">${formatNumber(player.wanted)}</span></span>
      <span class="leaderboard-score-cell">${formatNumber(player.empireScore)}</span>
      <span class="leaderboard-actions">
        <button type="button" class="button leaderboard-row-action" data-leaderboard-action="view" data-player-id="${escapeHtml(player.id)}" aria-label="Detail hráče ${escapeHtml(player.name)}">Detail</button>
        <button type="button" class="button leaderboard-row-action" data-leaderboard-action="target" data-player-id="${escapeHtml(player.id)}">Cíl</button>
        <button type="button" class="button leaderboard-row-action" data-leaderboard-action="bounty" data-player-id="${escapeHtml(player.id)}">Bounty</button>
      </span>
    </article>
  `;
}

function renderPlayerTable(players) {
  if (!players.length) {
    return `<div class="leaderboard-detail-empty">${escapeHtml(TAB_CONFIG[leaderboardState.activeTab]?.empty || TAB_CONFIG.overall.empty)}</div>`;
  }

  return `
    <div class="leaderboard-table-head" aria-hidden="true">
      <span>Rank</span>
      <span>Trend</span>
      <span>Hráč / Gang</span>
      <span>Frakce</span>
      <span>Aliance</span>
      <span>Distrikty</span>
      <span>Vliv</span>
      <span>Wanted</span>
      <span>Empire Score</span>
      <span>Akce</span>
    </div>
    ${players.map(renderPlayerRow).join("")}
  `;
}

function renderAllianceRow(alliance) {
  const rankClass = getRankClass(alliance.rank);
  const wantedClass = getWantedClass(alliance.totalWanted / Math.max(1, alliance.members));

  return `
    <article class="leaderboard-table-row leaderboard-alliance-row" data-leaderboard-alliance="${escapeHtml(alliance.alliance)}">
      <span class="leaderboard-rank-cell ${rankClass}">#${formatNumber(alliance.rank)}</span>
      <span class="leaderboard-player-cell">
        <strong>${escapeHtml(alliance.alliance)}</strong>
        <span>avg aktivita ${formatNumber(alliance.averageActivity)} min</span>
      </span>
      <span class="leaderboard-number-cell">${formatNumber(alliance.members)}</span>
      <span class="leaderboard-number-cell">${formatNumber(alliance.totalDistricts)}</span>
      <span class="leaderboard-number-cell">${formatNumber(alliance.totalInfluence)}</span>
      <span class="leaderboard-score-cell">${formatNumber(alliance.totalEmpireScore)}</span>
      <span class="leaderboard-cell-muted">${escapeHtml(alliance.topPlayer?.name || "-")}</span>
      <span><span class="leaderboard-wanted ${wantedClass}">${formatNumber(alliance.totalWanted)}</span></span>
      <span class="leaderboard-actions">
        <button type="button" class="button leaderboard-row-action" data-leaderboard-action="view-alliance" data-alliance="${escapeHtml(alliance.alliance)}">Profil</button>
        <button type="button" class="button leaderboard-row-action" data-leaderboard-action="target-alliance" data-alliance="${escapeHtml(alliance.alliance)}">Cíl</button>
      </span>
    </article>
  `;
}

function renderAllianceTable(alliances) {
  if (!alliances.length) {
    return `<div class="leaderboard-detail-empty">${escapeHtml(TAB_CONFIG.alliance.empty)}</div>`;
  }

  return `
    <div class="leaderboard-table-head leaderboard-alliance-row" aria-hidden="true">
      <span>Rank</span>
      <span>Aliance</span>
      <span>Členové</span>
      <span>Distrikty</span>
      <span>Celkový vliv</span>
      <span>Total Empire Score</span>
      <span>Top hráč</span>
      <span>Wanted pressure</span>
      <span>Akce</span>
    </div>
    ${alliances.map(renderAllianceRow).join("")}
  `;
}

function getCurrentServerRankedPlayers() {
  const players = getLeaderboardPlayers();
  const selectedServerId = leaderboardState.selectedServerId || getCurrentServerScope().serverId;
  return rankPlayers(sortPlayers(players.filter((player) => player.serverId === selectedServerId), "overall"));
}

export function renderMyRankPanel() {
  const mount = leaderboardContext.myRankElement;
  if (!mount) {
    return;
  }

  const rankedPlayers = getCurrentServerRankedPlayers();
  const currentPlayer = rankedPlayers.find((player) => player.isCurrentPlayer);

  if (!currentPlayer) {
    mount.innerHTML = `
      <span class="leaderboard-panel-label">TVŮJ RANK</span>
      <p>Mimo výpis.</p>
    `;
    return;
  }

  mount.innerHTML = `
    <span class="leaderboard-panel-label">TVŮJ RANK</span>
    <div class="leaderboard-my-rank__hero">
      <strong>#${formatNumber(currentPlayer.currentRank)}</strong>
    </div>
    <button type="button" class="button leaderboard-my-rank__detail" data-leaderboard-action="view" data-player-id="${escapeHtml(currentPlayer.id)}" aria-label="Detail tvého hráče">Detail hráče</button>
  `;
}

export function renderPlayerDetail(playerId) {
  const mount = leaderboardContext.detailElement;
  if (!mount) {
    return;
  }

  const player = getLeaderboardPlayers().find((entry) => entry.id === playerId);
  if (!player) {
    mount.innerHTML = `
      <div class="leaderboard-detail-empty">
        <span>Vyber hráče.</span>
      </div>
    `;
    return;
  }

  const ranked = rankPlayers(sortPlayers(filterPlayers(getLeaderboardPlayers(), { includeSearch: false }), "overall"));
  const rankedPlayer = ranked.find((entry) => entry.id === player.id) || player;
  const score = calculateEmpireScore(player);

  const stats = [
    ["Rank", `#${rankedPlayer.currentRank}`],
    ["Empire Score", formatNumber(score)],
    ["Distrikty", formatNumber(player.districts)],
    ["Vliv", formatNumber(player.influence)],
    ["Clean", formatMoney(player.cleanMoney)],
    ["Dirty", formatMoney(player.dirtyMoney)],
    ["Wanted", formatNumber(player.wanted)],
    ["Útoky", formatNumber(player.successfulAttacks)],
    ["Obrany", formatNumber(player.successfulDefenses)],
    ["Robbery", formatNumber(player.robberies)],
    ["Kills", formatNumber(player.unitsKilled)],
    ["Ztráty", formatNumber(player.unitsLost)],
    ["Budovy", formatNumber(player.buildingsOwned)],
    ["Aktivita", formatActivity(player.lastActiveMinutes)]
  ];

  mount.innerHTML = `
    <span class="leaderboard-panel-label">DETAIL HRÁČE</span>
    <div class="leaderboard-detail-identity">
      <strong>${escapeHtml(player.name)}</strong>
      <span>${escapeHtml(player.gangName)} · ${escapeHtml(player.faction)} · ${escapeHtml(player.alliance)}</span>
    </div>
    <div class="leaderboard-detail-grid">
      ${stats.map(([label, value]) => `
        <span class="leaderboard-detail-stat">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
        </span>
      `).join("")}
    </div>
    <div class="leaderboard-detail-actions">
      <button type="button" class="button leaderboard-detail-action" data-leaderboard-action="profile" data-player-id="${escapeHtml(player.id)}">Profil</button>
      <button type="button" class="button leaderboard-detail-action" data-leaderboard-action="target" data-player-id="${escapeHtml(player.id)}">Cíl</button>
      <button type="button" class="button leaderboard-detail-action" data-leaderboard-action="bounty" data-player-id="${escapeHtml(player.id)}">Bounty</button>
      <button type="button" class="button leaderboard-detail-action" data-leaderboard-action="message" data-player-id="${escapeHtml(player.id)}">Zpráva</button>
    </div>
  `;
}

function renderHeader() {
  const session = getAuthoritySession();
  const serverScope = getCurrentServerScope(session);
  leaderboardState.selectedServerId = leaderboardState.selectedServerId || serverScope.serverId;

  if (leaderboardContext.serverBadgeElement) {
    leaderboardContext.serverBadgeElement.textContent = `Server: ${serverScope.serverLabel}`;
  }

  if (leaderboardContext.phaseElement) {
    leaderboardContext.phaseElement.textContent = getServerPhaseLabel(session);
  }
}

function renderControls() {
  for (const tab of leaderboardContext.tabs) {
    const isActive = tab.dataset.leaderboardTab === leaderboardState.activeTab;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", isActive ? "true" : "false");
  }

  for (const filter of leaderboardContext.filters) {
    const isActive = filter.dataset.leaderboardFilter === leaderboardState.modeFilter;
    filter.classList.toggle("is-active", isActive);
    filter.setAttribute("aria-pressed", isActive ? "true" : "false");
  }

  if (leaderboardContext.searchInput && leaderboardContext.searchInput.value !== leaderboardState.searchQuery) {
    leaderboardContext.searchInput.value = leaderboardState.searchQuery;
  }
}

export function renderLeaderboard() {
  const config = TAB_CONFIG[leaderboardState.activeTab] || TAB_CONFIG.overall;
  const players = getSortedLeaderboard(leaderboardState.activeTab);
  const alliances = leaderboardState.activeTab === "alliance" ? getVisibleAllianceLeaderboard() : [];

  renderHeader();
  renderControls();
  renderMyRankPanel();
  renderStats(players, alliances);

  if (leaderboardContext.tableTitleElement) {
    leaderboardContext.tableTitleElement.textContent = config.title;
  }

  if (leaderboardContext.modeLabelElement) {
    leaderboardContext.modeLabelElement.textContent = config.label;
  }

  if (leaderboardContext.countElement) {
    leaderboardContext.countElement.textContent = leaderboardState.activeTab === "alliance"
      ? `${formatNumber(alliances.length)} aliancí`
      : `${formatNumber(players.length)} hráčů`;
  }

  if (leaderboardContext.listElement) {
    leaderboardContext.listElement.innerHTML = leaderboardState.activeTab === "alliance"
      ? renderAllianceTable(alliances)
      : renderPlayerTable(players);
  }

  if (!leaderboardState.selectedPlayerId) {
    leaderboardState.selectedPlayerId = getCurrentPlayerId();
  }
  renderPlayerDetail(leaderboardState.selectedPlayerId);
}

function getActionMessage(action) {
  const actionLabels = {
    view: "Zobrazení profilu bude napojeno později.",
    target: "Označení cíle bude napojeno později.",
    bounty: "Bounty systém bude napojen později.",
    profile: "Profil hráče bude napojen později.",
    message: "Zprávy budou napojeny později.",
    "view-alliance": "Detail aliance bude napojen později.",
    "target-alliance": "Aliance target bude napojen později."
  };

  return actionLabels[action] || "Funkce bude napojena později.";
}

function openPlayerDetail(playerId) {
  if (!leaderboardContext.playerDetailShell || !playerId) {
    return;
  }

  leaderboardState.selectedPlayerId = playerId;
  renderLeaderboard();
  renderPlayerDetail(playerId);
  leaderboardContext.playerDetailShell.hidden = false;
  window.setTimeout(() => leaderboardContext.playerDetailCard?.focus(), 0);
}

function closePlayerDetail() {
  if (!leaderboardContext.playerDetailShell) {
    return;
  }

  leaderboardContext.playerDetailShell.hidden = true;
}

export function showLeaderboardToast(message = "Funkce bude napojena později.", type = "info") {
  const toast = leaderboardContext.toastElement;
  if (!toast) {
    return;
  }

  window.clearTimeout(leaderboardContext.toastTimer);
  toast.dataset.type = type;

  if (leaderboardContext.toastTitleElement) {
    leaderboardContext.toastTitleElement.textContent = type === "warning" ? "WARNING" : "TERMINAL";
  }

  if (leaderboardContext.toastMessageElement) {
    leaderboardContext.toastMessageElement.textContent = message;
  }

  toast.hidden = false;
  leaderboardContext.toastTimer = window.setTimeout(() => {
    toast.hidden = true;
  }, 2600);
}

function setScrollLock(locked) {
  document.documentElement.classList.toggle("game-modal-scroll-locked", locked);
  document.body?.classList.toggle("game-modal-scroll-locked", locked);
}

export function openLeaderboard() {
  const popup = leaderboardContext.popup;
  if (!popup) {
    return;
  }

  const serverScope = getCurrentServerScope();
  leaderboardState.selectedServerId = serverScope.serverId;
  leaderboardState.selectedPlayerId = leaderboardState.selectedPlayerId || getCurrentPlayerId();
  leaderboardContext.previousActiveElement = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;

  renderLeaderboard();
  popup.hidden = false;
  setScrollLock(true);
  window.setTimeout(() => leaderboardContext.card?.focus(), 0);
}

export function closeLeaderboard() {
  const popup = leaderboardContext.popup;
  if (!popup) {
    return;
  }

  closePlayerDetail();
  popup.hidden = true;
  setScrollLock(false);
  leaderboardContext.previousActiveElement?.focus?.();
}

function handleListClick(event) {
  const target = typeof Element !== "undefined" && event.target instanceof Element ? event.target : event.target?.parentElement;
  const actionButton = target?.closest("[data-leaderboard-action]");
  if (actionButton) {
    event.stopPropagation();
    if (actionButton.dataset.leaderboardAction === "view") {
      openPlayerDetail(actionButton.dataset.playerId);
      return;
    }

    showLeaderboardToast(getActionMessage(actionButton.dataset.leaderboardAction), "info");
    return;
  }

  const playerRow = target?.closest("[data-leaderboard-player-id]");
  if (!playerRow) {
    return;
  }

  leaderboardState.selectedPlayerId = playerRow.dataset.leaderboardPlayerId;
  renderLeaderboard();
}

function handleListKeydown(event) {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  const target = typeof Element !== "undefined" && event.target instanceof Element ? event.target : event.target?.parentElement;
  const playerRow = target?.closest("[data-leaderboard-player-id]");
  if (!playerRow) {
    return;
  }

  event.preventDefault();
  leaderboardState.selectedPlayerId = playerRow.dataset.leaderboardPlayerId;
  renderLeaderboard();
}

function handleDetailClick(event) {
  const target = typeof Element !== "undefined" && event.target instanceof Element ? event.target : event.target?.parentElement;
  const actionButton = target?.closest("[data-leaderboard-action]");
  if (actionButton) {
    showLeaderboardToast(getActionMessage(actionButton.dataset.leaderboardAction), "info");
  }
}

function handleMyRankClick(event) {
  const target = typeof Element !== "undefined" && event.target instanceof Element ? event.target : event.target?.parentElement;
  const actionButton = target?.closest("[data-leaderboard-action]");
  if (!actionButton) {
    return;
  }

  if (actionButton.dataset.leaderboardAction === "view") {
    openPlayerDetail(actionButton.dataset.playerId);
    return;
  }

  showLeaderboardToast(getActionMessage(actionButton.dataset.leaderboardAction), "info");
}

function bindEvents(openButton, closeElements) {
  openButton.addEventListener("click", openLeaderboard);

  for (const closeElement of closeElements) {
    closeElement.addEventListener("click", closeLeaderboard);
  }

  for (const closeElement of leaderboardContext.playerDetailCloseElements) {
    closeElement.addEventListener("click", closePlayerDetail);
  }

  for (const tab of leaderboardContext.tabs) {
    tab.addEventListener("click", () => {
      const nextTab = tab.dataset.leaderboardTab;
      if (!TAB_CONFIG[nextTab]) {
        return;
      }

      leaderboardState.activeTab = nextTab;
      renderLeaderboard();
    });
  }

  for (const filter of leaderboardContext.filters) {
    filter.addEventListener("click", () => {
      leaderboardState.modeFilter = filter.dataset.leaderboardFilter || "current";
      renderLeaderboard();
    });
  }

  leaderboardContext.searchInput?.addEventListener("input", () => {
    leaderboardState.searchQuery = leaderboardContext.searchInput.value.trim();
    renderLeaderboard();
  });

  leaderboardContext.listElement?.addEventListener("click", handleListClick);
  leaderboardContext.listElement?.addEventListener("keydown", handleListKeydown);
  leaderboardContext.myRankElement?.addEventListener("click", handleMyRankClick);
  leaderboardContext.detailElement?.addEventListener("click", handleDetailClick);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && leaderboardContext.popup && !leaderboardContext.popup.hidden) {
      if (leaderboardContext.playerDetailShell && !leaderboardContext.playerDetailShell.hidden) {
        closePlayerDetail();
        return;
      }

      closeLeaderboard();
    }
  });
}

export function bindLeaderboardPopup(root) {
  const openButton = root.querySelector(LEADERBOARD_POPUP_OPEN_SELECTOR);
  const popup = root.querySelector(LEADERBOARD_POPUP_SELECTOR);
  const closeElements = Array.from(root.querySelectorAll(LEADERBOARD_POPUP_CLOSE_SELECTOR));

  if (!openButton || !popup || closeElements.length === 0) {
    return;
  }

  leaderboardContext.root = root;
  leaderboardContext.popup = popup;
  leaderboardContext.card = popup.querySelector(".leaderboard-popup-card");
  leaderboardContext.tabs = Array.from(popup.querySelectorAll(LEADERBOARD_TAB_SELECTOR));
  leaderboardContext.filters = Array.from(popup.querySelectorAll(LEADERBOARD_FILTER_SELECTOR));
  leaderboardContext.searchInput = popup.querySelector(LEADERBOARD_SEARCH_SELECTOR);
  leaderboardContext.listElement = popup.querySelector(LEADERBOARD_LIST_SELECTOR);
  leaderboardContext.statsElement = popup.querySelector(LEADERBOARD_STATS_SELECTOR);
  leaderboardContext.serverBadgeElement = popup.querySelector(LEADERBOARD_SERVER_BADGE_SELECTOR);
  leaderboardContext.phaseElement = popup.querySelector(LEADERBOARD_PHASE_SELECTOR);
  leaderboardContext.myRankElement = popup.querySelector(LEADERBOARD_MY_RANK_SELECTOR);
  leaderboardContext.detailElement = popup.querySelector(LEADERBOARD_DETAIL_SELECTOR);
  leaderboardContext.playerDetailShell = popup.querySelector(LEADERBOARD_PLAYER_DETAIL_SELECTOR);
  leaderboardContext.playerDetailCard = popup.querySelector(".leaderboard-player-detail-card");
  leaderboardContext.playerDetailCloseElements = Array.from(popup.querySelectorAll(LEADERBOARD_PLAYER_DETAIL_CLOSE_SELECTOR));
  leaderboardContext.toastElement = popup.querySelector(LEADERBOARD_TOAST_SELECTOR);
  leaderboardContext.toastTitleElement = popup.querySelector(LEADERBOARD_TOAST_TITLE_SELECTOR);
  leaderboardContext.toastMessageElement = popup.querySelector(LEADERBOARD_TOAST_MESSAGE_SELECTOR);
  leaderboardContext.tableTitleElement = popup.querySelector(LEADERBOARD_TABLE_TITLE_SELECTOR);
  leaderboardContext.modeLabelElement = popup.querySelector(LEADERBOARD_MODE_LABEL_SELECTOR);
  leaderboardContext.countElement = popup.querySelector(LEADERBOARD_COUNT_SELECTOR);

  if (!leaderboardContext.bound) {
    bindEvents(openButton, closeElements);
    leaderboardContext.bound = true;
  }

  window.empireStreetsLeaderboard = {
    getLeaderboardPlayers,
    getCurrentPlayerId,
    calculateEmpireScore,
    getSortedLeaderboard,
    getAllianceLeaderboard,
    renderLeaderboard,
    renderPlayerDetail,
    renderMyRankPanel,
    openLeaderboard,
    closeLeaderboard,
    showLeaderboardToast
  };

  renderLeaderboard();
}
