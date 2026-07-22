import { getAuthoritySession } from "../model/authority-state.js";
import { STORAGE_KEYS } from "../../config.js";
import { closeOverlay, openOverlay } from "../ui/legacyOverlayCoordinator.js";
import { GAMEPLAY_EXECUTION_MODES, getGameplayExecutionMode } from "../runtime/gameplayExecutionMode.js";

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

const SELECTED_SERVER_STORAGE_KEY = STORAGE_KEYS.selectedServer;
const PLAYER_STATE_STORAGE_KEY = "empirestreets.playerState";
const DEFAULT_SERVER_ID = "server";
const DEFAULT_CITY_MINUTES = 5 * 60 + 55;
const LIVE_SUPPORTED_TABS = new Set(["overall", "influence", "districts", "alliance"]);
const LIVE_UNAVAILABLE_COPY = "Leaderboard se právě nepodařilo načíst.";
const LIVE_EMPTY_COPY = "Na tomto serveru zatím nejsou aktivní hráči.";
const LIVE_PENDING_TAB_COPY = "Tato statistika se připravuje.";

let demoLeaderboardPlayers = [];
let calculateDemoScore = null;
let demoFixturePromise = null;

function focusWithoutScroll(element) {
  if (!(element instanceof HTMLElement) || typeof element.focus !== "function") {
    return false;
  }
  try {
    element.focus({ preventScroll: true });
  } catch {
    element.focus();
  }
  return true;
}

const TAB_CONFIG = Object.freeze({
  overall: {
    label: "CELKOVĚ",
    title: "Empire score",
    copy: "Tady se ukazuje, kdo skutečně vlastní město.",
    empty: "Žádný boss neodpovídá aktuálním filtrům."
  },
  influence: {
    label: "VLIV",
    title: "Kontrola vlivu",
    copy: "Vliv ukazuje, kdo tahá za kontakty, strach a loajalitu ulic.",
    empty: "Žádný vlivový cíl neodpovídá filtrům."
  },
  districts: {
    label: "DISTRIKTY",
    title: "Kontrola districtů",
    copy: "Kontrola districtů rozhoduje, kdo drží mapu pod krkem.",
    empty: "Žádné district skóre neodpovídá filtrům."
  },
  money: {
    label: "PENÍZE",
    title: "Finanční tlak",
    copy: "Čisté a špinavé peníze ukazují, kdo dokáže válku financovat.",
    empty: "Žádná ekonomická stopa neodpovídá filtrům."
  },
  wanted: {
    label: "WANTED",
    title: "Seznam hledaných",
    copy: "Seznam hledaných ukazuje bosse, kterým už policie dýchá na záda.",
    empty: "Nikdo v hledáčku policie neodpovídá filtrům."
  },
  attacks: {
    label: "ÚTOKY",
    title: "Index útoků",
    copy: "Útoky, robbery a zabité jednotky ukazují, kdo na serveru tlačí násilím.",
    empty: "Žádný agresor neodpovídá filtrům."
  },
  alliance: {
    label: "ALIANCE",
    title: "Síla aliancí",
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

function loadLocalDemoFixture() {
  if (getLeaderboardExecutionMode() !== GAMEPLAY_EXECUTION_MODES.localDemo) {
    return Promise.resolve(false);
  }
  if (!demoFixturePromise) {
    demoFixturePromise = import("../dev-fixtures/leaderboardDemoData.js")
      .then((fixture) => {
        demoLeaderboardPlayers = fixture.LEADERBOARD_DEMO_PLAYERS.map((player) => ({ ...player }));
        calculateDemoScore = fixture.calculateDemoEmpireScore;
        if (leaderboardContext.popup) renderLeaderboard();
        return true;
      })
      .catch((error) => {
        console.error("Local demo leaderboard fixture could not be loaded.", error);
        demoLeaderboardPlayers = [];
        calculateDemoScore = null;
        return false;
      });
  }
  return demoFixturePromise;
}

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

function getLeaderboardExecutionMode() {
  return getGameplayExecutionMode({ windowRef: globalThis.window });
}

function getServerLeaderboardView() {
  return globalThis.window?.empireStreetsGameplaySliceReadModel?.leaderboard || null;
}

function mapServerLeaderboardEntry(entry) {
  const slice = globalThis.window?.empireStreetsGameplaySliceReadModel || null;
  return {
    id: String(entry?.playerId || ""),
    name: String(entry?.name || entry?.playerId || "-"),
    gangName: String(entry?.name || entry?.playerId || "-"),
    faction: String(entry?.factionId || "-"),
    alliance: String(entry?.allianceTag || ""),
    districts: normalizeNumber(entry?.controlledDistricts),
    cleanMoney: null,
    dirtyMoney: null,
    influence: normalizeNumber(entry?.influence),
    wanted: null,
    successfulAttacks: null,
    successfulDefenses: null,
    robberies: null,
    unitsKilled: null,
    unitsLost: null,
    buildingsOwned: null,
    lastRank: entry?.movement === null ? normalizeNumber(entry?.rank) : Math.max(1, normalizeNumber(entry?.rank) + Number(entry?.movement || 0)),
    currentRank: normalizeNumber(entry?.rank),
    lastActiveMinutes: null,
    status: String(entry?.status || "active"),
    isCurrentPlayer: Boolean(entry?.isCurrentPlayer),
    serverId: String(slice?.server?.serverInstanceId || "server"),
    serverLabel: String(slice?.server?.serverInstanceId || "SERVER").toUpperCase(),
    mode: String(slice?.mode?.mode || "free"),
    empireScore: entry?.score === null || entry?.score === undefined
      ? null
      : Math.max(0, Number(entry.score))
  };
}

function getServerMeta(serverId = "") {
  const normalizedServerId = normalizeText(serverId, DEFAULT_SERVER_ID).toLowerCase();
  const inferredMode = normalizedServerId.includes("free")
    ? "free"
    : normalizedServerId.includes("war") ? "war" : "server";
  return {
    serverId: normalizedServerId,
    serverLabel: normalizedServerId.toUpperCase(),
    mode: inferredMode
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
  if (getLeaderboardExecutionMode() === GAMEPLAY_EXECUTION_MODES.serverAuthoritative) {
    const slice = globalThis.window?.empireStreetsGameplaySliceReadModel || null;
    const serverId = String(slice?.server?.serverInstanceId || "server");
    return {
      serverId,
      serverLabel: serverId.toUpperCase(),
      mode: String(slice?.mode?.mode || "free")
    };
  }
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
  const time = formatCityMinutes(phaseState.cityMinutes ?? DEFAULT_CITY_MINUTES);
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
  const fallback = demoLeaderboardPlayers.find((player) => player.isCurrentPlayer) || demoLeaderboardPlayers[0] || null;
  if (!fallback) return null;
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
  if (getLeaderboardExecutionMode() === GAMEPLAY_EXECUTION_MODES.serverAuthoritative) {
    return String(getServerLeaderboardView()?.currentPlayer?.playerId || "");
  }
  return createCurrentPlayerFromSources()?.id || "";
}

export function calculateEmpireScore(player) {
  if (getLeaderboardExecutionMode() === GAMEPLAY_EXECUTION_MODES.serverAuthoritative) {
    return player?.empireScore === null || player?.empireScore === undefined
      ? null
      : Math.max(0, Number(player.empireScore));
  }
  return typeof calculateDemoScore === "function" ? calculateDemoScore(player) : null;
}

export function getLeaderboardPlayers() {
  const executionMode = getLeaderboardExecutionMode();
  if (executionMode === GAMEPLAY_EXECUTION_MODES.serverAuthoritative) {
    const view = getServerLeaderboardView();
    if (!view) return [];
    const rows = [...(view.entries || [])];
    if (view.currentPlayer && !rows.some((entry) => entry.playerId === view.currentPlayer.playerId)) {
      rows.push(view.currentPlayer);
    }
    return rows.map(mapServerLeaderboardEntry);
  }
  if (executionMode !== GAMEPLAY_EXECUTION_MODES.localDemo) return [];
  const currentPlayer = createCurrentPlayerFromSources();
  if (!currentPlayer) return [];
  const players = demoLeaderboardPlayers
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
    overall: (player) => Number.isFinite(Number(player.empireScore)) ? Number(player.empireScore) : -1,
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
  if (getLeaderboardExecutionMode() === GAMEPLAY_EXECUTION_MODES.serverAuthoritative) {
    if (!LIVE_SUPPORTED_TABS.has(tab)) return [];
    if (tab === "overall") return [...players].sort((left, right) => left.currentRank - right.currentRank);
  }
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
    current.totalEmpireScore += calculateEmpireScore(player) ?? 0;
    current.totalDistricts += normalizeNumber(player.districts);
    current.totalInfluence += normalizeNumber(player.influence);
    current.totalWanted += player.wanted === null ? 0 : normalizeNumber(player.wanted);
    current.totalActivity += player.lastActiveMinutes === null ? 0 : normalizeNumber(player.lastActiveMinutes);
    current.topPlayer = !current.topPlayer || (calculateEmpireScore(player) ?? -1) > (calculateEmpireScore(current.topPlayer) ?? -1)
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

function formatOptionalNumber(value) {
  return value === null || value === undefined ? "—" : formatNumber(value);
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
  if (getLeaderboardExecutionMode() === GAMEPLAY_EXECUTION_MODES.serverAuthoritative) {
    return player.status === "defeated"
      ? "Tento gang byl v této válce poražen."
      : "Aktivní gang v aktuálním serverovém pořadí.";
  }
  if (player.status === "defeated") return "Hráč byl poražen.";
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
  const totalEmpireScore = players.reduce((sum, player) => sum + (calculateEmpireScore(player) ?? 0), 0);
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
      createStat("Tlak hledanosti", getLeaderboardExecutionMode() === GAMEPLAY_EXECUTION_MODES.serverAuthoritative
        ? "—"
        : formatNumber(alliances.reduce((sum, alliance) => sum + alliance.totalWanted, 0)))
    ].join("");
    return;
  }

  const summary = getRankSummary(players);
  const serverMode = getLeaderboardExecutionMode() === GAMEPLAY_EXECUTION_MODES.serverAuthoritative;
  leaderboardContext.statsElement.innerHTML = [
    createStat("Hráči ve výpisu", formatNumber(summary.totalPlayers)),
    createStat(serverMode ? "Aktivní" : "Online / aktivní", serverMode
      ? formatNumber(players.filter((player) => player.status === "active").length)
      : formatNumber(summary.activePlayers)),
    createStat("Empire score", formatNumber(summary.totalEmpireScore)),
    createStat(serverMode ? "Poražení" : "Police heat", serverMode
      ? formatNumber(players.filter((player) => player.status === "defeated").length)
      : formatNumber(summary.totalWanted))
  ].join("");
}

function renderPlayerRow(player) {
  const rank = normalizeNumber(player.currentRank);
  const wantedClass = getWantedClass(player.wanted);
  const rankClass = getRankClass(rank);
  const score = formatOptionalNumber(player.empireScore);
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
      <span>${getLeaderboardExecutionMode() === GAMEPLAY_EXECUTION_MODES.serverAuthoritative
        ? `<span class="leaderboard-cell-muted">${player.status === "defeated" ? "Poražen" : "Aktivní"}</span>`
        : `<span class="leaderboard-wanted ${wantedClass}">${formatNumber(player.wanted)}</span>`}</span>
      <span class="leaderboard-score-cell">${formatOptionalNumber(player.empireScore)}</span>
      <span class="leaderboard-actions">
        <button type="button" class="button leaderboard-row-action" data-leaderboard-action="view" data-player-id="${escapeHtml(player.id)}" aria-label="Detail hráče ${escapeHtml(player.name)}">Detail</button>
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
      <span>${getLeaderboardExecutionMode() === GAMEPLAY_EXECUTION_MODES.serverAuthoritative ? "Stav" : "Wanted"}</span>
      <span>Empire score</span>
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
      <span><span class="leaderboard-wanted ${wantedClass}">${getLeaderboardExecutionMode() === GAMEPLAY_EXECUTION_MODES.serverAuthoritative ? "—" : formatNumber(alliance.totalWanted)}</span></span>
      <span class="leaderboard-actions">
        <button type="button" class="button leaderboard-row-action" data-leaderboard-action="view-alliance" data-alliance="${escapeHtml(alliance.alliance)}">Profil</button>
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
      <span>Empire score</span>
      <span>Top hráč</span>
      <span>Tlak hledanosti</span>
      <span>Akce</span>
    </div>
    ${alliances.map(renderAllianceRow).join("")}
  `;
}

function getCurrentServerRankedPlayers() {
  const players = getLeaderboardPlayers();
  const selectedServerId = leaderboardState.selectedServerId || getCurrentServerScope().serverId;
  if (getLeaderboardExecutionMode() === GAMEPLAY_EXECUTION_MODES.serverAuthoritative) {
    return players.filter((player) => player.serverId === selectedServerId)
      .sort((left, right) => left.currentRank - right.currentRank);
  }
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
      <p>${getLeaderboardExecutionMode() === GAMEPLAY_EXECUTION_MODES.serverAuthoritative && !getServerLeaderboardView()
        ? "Serverová data nejsou dostupná."
        : "Mimo výpis."}</p>
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
        <span>${getLeaderboardExecutionMode() === GAMEPLAY_EXECUTION_MODES.serverAuthoritative && !getServerLeaderboardView()
          ? LIVE_UNAVAILABLE_COPY
          : "Vyber hráče."}</span>
      </div>
    `;
    return;
  }

  const ranked = rankPlayers(sortPlayers(filterPlayers(getLeaderboardPlayers(), { includeSearch: false }), "overall"));
  const rankedPlayer = ranked.find((entry) => entry.id === player.id) || player;
  const score = calculateEmpireScore(player);

  const stats = getLeaderboardExecutionMode() === GAMEPLAY_EXECUTION_MODES.serverAuthoritative ? [
    ["Rank", `#${rankedPlayer.currentRank}`],
    ["Empire score", formatOptionalNumber(score)],
    ["Distrikty", formatNumber(player.districts)],
    ["Vliv", formatNumber(player.influence)],
    ["Stav", player.status === "defeated" ? "Poražen" : "Aktivní"]
  ] : [
    ["Rank", `#${rankedPlayer.currentRank}`],
    ["Empire score", formatNumber(score)],
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
    const serverView = getServerLeaderboardView();
    leaderboardContext.phaseElement.textContent = getLeaderboardExecutionMode() === GAMEPLAY_EXECUTION_MODES.serverAuthoritative
      ? (serverView ? `SERVER SNAPSHOT · ${new Date(serverView.generatedAt).toLocaleTimeString("cs-CZ")}` : "SERVER DATA NEDOSTUPNÁ")
      : getServerPhaseLabel(session);
  }
}

function renderControls() {
  const liveMode = getLeaderboardExecutionMode() === GAMEPLAY_EXECUTION_MODES.serverAuthoritative;
  for (const tab of leaderboardContext.tabs) {
    const tabId = tab.dataset.leaderboardTab;
    const isSupported = !liveMode || LIVE_SUPPORTED_TABS.has(tabId);
    const isActive = tabId === leaderboardState.activeTab;
    tab.disabled = !isSupported;
    tab.setAttribute("aria-disabled", isSupported ? "false" : "true");
    tab.title = isSupported ? "" : LIVE_PENDING_TAB_COPY;
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
  const liveMode = getLeaderboardExecutionMode() === GAMEPLAY_EXECUTION_MODES.serverAuthoritative;
  if (liveMode && !LIVE_SUPPORTED_TABS.has(leaderboardState.activeTab)) {
    leaderboardState.activeTab = "overall";
  }
  const config = TAB_CONFIG[leaderboardState.activeTab] || TAB_CONFIG.overall;
  const serverView = liveMode ? getServerLeaderboardView() : null;
  const liveUnavailable = liveMode && !serverView;
  const players = getSortedLeaderboard(leaderboardState.activeTab);
  const alliances = leaderboardState.activeTab === "alliance" ? getVisibleAllianceLeaderboard() : [];
  const liveEmpty = liveMode && Boolean(serverView) && getLeaderboardPlayers().length === 0;

  renderHeader();
  renderControls();
  renderMyRankPanel();
  if (leaderboardContext.statsElement && (liveUnavailable || liveEmpty)) {
    leaderboardContext.statsElement.innerHTML = "";
  } else {
    renderStats(players, alliances);
  }

  if (leaderboardContext.tableTitleElement) {
    leaderboardContext.tableTitleElement.textContent = getLeaderboardExecutionMode() === GAMEPLAY_EXECUTION_MODES.localDemo
      ? `${config.title} · DEMO POŘADÍ`
      : config.title;
  }

  if (leaderboardContext.modeLabelElement) {
    leaderboardContext.modeLabelElement.textContent = config.label;
  }

  if (leaderboardContext.countElement) {
    leaderboardContext.countElement.textContent = liveUnavailable
      ? "—"
      : leaderboardState.activeTab === "alliance"
      ? `${formatNumber(alliances.length)} aliancí`
      : `${formatNumber(players.length)} hráčů`;
  }

  if (leaderboardContext.listElement) {
    leaderboardContext.listElement.innerHTML = liveUnavailable
      ? `<div class="leaderboard-detail-empty">${escapeHtml(LIVE_UNAVAILABLE_COPY)}</div>`
      : liveEmpty
        ? `<div class="leaderboard-detail-empty">${escapeHtml(LIVE_EMPTY_COPY)}</div>`
        : getLeaderboardExecutionMode() === GAMEPLAY_EXECUTION_MODES.localDemo && demoLeaderboardPlayers.length === 0
          ? '<div class="leaderboard-detail-empty">Načítám lokální demo pořadí.</div>'
          : leaderboardState.activeTab === "alliance"
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
    view: "Profil hráče zatím není dostupný.",
    target: "Označení cíle zatím není dostupné.",
    bounty: "Otevři bounty kartu a vyber cílového hráče.",
    profile: "Profil hráče zatím není dostupný.",
    message: "Zprávy zatím nejsou dostupné.",
    "view-alliance": "Detail aliance zatím není dostupný."
  };

  return actionLabels[action] || "Funkce zatím není dostupná.";
}

function openBountyFromLeaderboard(playerId) {
  closeLeaderboard();
  window.setTimeout(() => {
    document.dispatchEvent(new CustomEvent("empire:open-bounty-modal", {
      detail: {
        source: "leaderboard",
        targetPlayerId: String(playerId || "")
      }
    }));
  }, 0);
}

function openPlayerDetail(playerId) {
  if (!leaderboardContext.playerDetailShell || !playerId) {
    return;
  }

  leaderboardState.selectedPlayerId = playerId;
  renderLeaderboard();
  renderPlayerDetail(playerId);
  leaderboardContext.playerDetailShell.hidden = false;
  window.setTimeout(() => focusWithoutScroll(leaderboardContext.playerDetailCard), 0);
}

function closePlayerDetail() {
  if (!leaderboardContext.playerDetailShell) {
    return;
  }

  leaderboardContext.playerDetailShell.hidden = true;
}

export function showLeaderboardToast(message = "Funkce zatím není dostupná.", type = "info") {
  const toast = leaderboardContext.toastElement;
  if (!toast) {
    return;
  }

  window.clearTimeout(leaderboardContext.toastTimer);
  toast.dataset.type = type;

  if (leaderboardContext.toastTitleElement) {
    leaderboardContext.toastTitleElement.textContent = type === "warning" ? "VAROVÁNÍ" : "TERMINÁL";
  }

  if (leaderboardContext.toastMessageElement) {
    leaderboardContext.toastMessageElement.textContent = message;
  }

  toast.hidden = false;
  leaderboardContext.toastTimer = window.setTimeout(() => {
    toast.hidden = true;
  }, 2600);
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
  openOverlay(popup, {
    type: "modal",
    ariaModal: true,
    focusTarget: leaderboardContext.card,
    restoreFocusOnClose: false
  });
  window.setTimeout(() => focusWithoutScroll(leaderboardContext.card), 0);
}

export function closeLeaderboard() {
  const popup = leaderboardContext.popup;
  if (!popup) {
    return;
  }

  closePlayerDetail();
  closeOverlay(popup, { restoreFocus: false });
  popup.hidden = true;
  focusWithoutScroll(leaderboardContext.previousActiveElement);
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
    event.preventDefault();
    event.stopPropagation();
    if (actionButton.dataset.leaderboardAction === "bounty") {
      openBountyFromLeaderboard(actionButton.dataset.playerId);
      return;
    }
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
      if (tab.disabled || !TAB_CONFIG[nextTab]) {
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
  document.addEventListener("empire:gameplay-slice-rendered", () => {
    if (leaderboardContext.popup && !leaderboardContext.popup.hidden) renderLeaderboard();
  });
  document.addEventListener("empire:runtime-mode-changed", () => {
    leaderboardState.selectedServerId = null;
    leaderboardState.selectedPlayerId = null;
    void loadLocalDemoFixture();
    renderLeaderboard();
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

  void loadLocalDemoFixture();
  renderLeaderboard();
}
