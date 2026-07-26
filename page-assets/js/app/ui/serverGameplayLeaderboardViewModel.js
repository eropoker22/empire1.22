export const SERVER_LEADERBOARD_SUPPORTED_TABS = new Set([
  "overall",
  "influence",
  "districts",
  "alliance"
]);

export const SERVER_LEADERBOARD_TAB_CONFIG = Object.freeze({
  overall: { label: "CELKOVĚ", title: "Empire score" },
  influence: { label: "VLIV", title: "Kontrola vlivu" },
  districts: { label: "DISTRIKTY", title: "Kontrola districtů" },
  money: { label: "PENÍZE", title: "Finanční tlak" },
  wanted: { label: "WANTED", title: "Seznam hledaných" },
  attacks: { label: "ÚTOKY", title: "Index útoků" },
  alliance: { label: "ALIANCE", title: "Síla aliancí" }
});

export function createServerGameplayLeaderboardFingerprint(readModel) {
  return JSON.stringify({
    serverInstanceId: readModel?.server?.serverInstanceId || null,
    mode: readModel?.mode?.mode || readModel?.player?.mode || null,
    playerId: readModel?.player?.playerId || null,
    leaderboard: readModel?.leaderboard || null
  });
}

const normalizeNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : fallback;
};

const normalizeEntry = (entry, readModel) => ({
  playerId: String(entry?.playerId || ""),
  name: String(entry?.name || entry?.playerId || "—"),
  factionId: String(entry?.factionId || "—"),
  allianceTag: String(entry?.allianceTag || ""),
  controlledDistricts: Math.floor(normalizeNumber(entry?.controlledDistricts)),
  influence: Math.floor(normalizeNumber(entry?.influence)),
  score: entry?.score === null || entry?.score === undefined
    ? null
    : normalizeNumber(entry.score),
  rank: Math.max(1, Math.floor(normalizeNumber(entry?.rank, 1))),
  movement: Number.isFinite(Number(entry?.movement)) ? Number(entry.movement) : null,
  status: entry?.status === "defeated" ? "defeated" : "active",
  isCurrentPlayer: Boolean(entry?.isCurrentPlayer),
  serverId: String(readModel?.server?.serverInstanceId || ""),
  mode: String(readModel?.mode?.mode || readModel?.player?.mode || "")
});

const collectEntries = (readModel) => {
  const view = readModel?.leaderboard;
  if (!view) return [];
  const entries = [...(Array.isArray(view.entries) ? view.entries : [])];
  if (
    view.currentPlayer?.playerId
    && !entries.some((entry) => entry?.playerId === view.currentPlayer.playerId)
  ) {
    entries.push(view.currentPlayer);
  }
  return entries
    .map((entry) => normalizeEntry(entry, readModel))
    .filter((entry) => entry.playerId);
};

const filterEntries = (entries, state, readModel) => {
  const query = String(state.searchQuery || "").trim().toLowerCase();
  const currentPlayer = entries.find((entry) => entry.isCurrentPlayer)
    || entries.find((entry) => entry.playerId === readModel?.player?.playerId)
    || null;
  return entries.filter((entry) => {
    if (query && ![
      entry.name,
      entry.playerId,
      entry.factionId,
      entry.allianceTag
    ].join(" ").toLowerCase().includes(query)) {
      return false;
    }
    if (state.modeFilter === "free" || state.modeFilter === "war") {
      return entry.mode === state.modeFilter;
    }
    if (state.modeFilter === "alliance") {
      return Boolean(currentPlayer?.allianceTag)
        && entry.allianceTag === currentPlayer.allianceTag;
    }
    if (state.modeFilter === "active") return entry.status === "active";
    return true;
  });
};

const sortEntries = (entries, tab) => [...entries].sort((left, right) => {
  if (tab === "overall") return left.rank - right.rank;
  if (tab === "influence") {
    return right.influence - left.influence || left.rank - right.rank;
  }
  if (tab === "districts") {
    return right.controlledDistricts - left.controlledDistricts || left.rank - right.rank;
  }
  return left.rank - right.rank;
});

const createAllianceRows = (entries) => {
  const alliances = new Map();
  for (const entry of entries) {
    const tag = entry.allianceTag || "Bez aliance";
    const current = alliances.get(tag) || {
      tag,
      members: 0,
      controlledDistricts: 0,
      influence: 0,
      score: 0,
      topPlayer: null
    };
    current.members += 1;
    current.controlledDistricts += entry.controlledDistricts;
    current.influence += entry.influence;
    current.score += entry.score || 0;
    if (!current.topPlayer || (entry.score || 0) > (current.topPlayer.score || 0)) {
      current.topPlayer = entry;
    }
    alliances.set(tag, current);
  }
  return [...alliances.values()]
    .sort((left, right) => right.score - left.score || right.influence - left.influence)
    .map((alliance, index) => ({ ...alliance, rank: index + 1 }));
};

const resolveGeneratedLabel = (leaderboard) => {
  const timestamp = Date.parse(String(leaderboard?.generatedAt || ""));
  return Number.isFinite(timestamp)
    ? `SERVER SNAPSHOT · ${new Date(timestamp).toLocaleTimeString("cs-CZ")}`
    : "SERVER SNAPSHOT";
};

export function createServerGameplayLeaderboardViewModel(readModel, state = {}) {
  const activeTab = SERVER_LEADERBOARD_TAB_CONFIG[state.activeTab]
    ? state.activeTab
    : "overall";
  const supported = SERVER_LEADERBOARD_SUPPORTED_TABS.has(activeTab);
  const allEntries = collectEntries(readModel);
  const entries = supported
    ? sortEntries(filterEntries(allEntries, state, readModel), activeTab)
    : [];
  const alliances = activeTab === "alliance" ? createAllianceRows(entries) : [];
  const currentPlayerId = String(
    readModel?.leaderboard?.currentPlayer?.playerId
    || readModel?.player?.playerId
    || ""
  );
  const currentPlayer = allEntries.find((entry) => entry.playerId === currentPlayerId) || null;
  const status = !readModel?.leaderboard
    ? "unavailable"
    : !supported
      ? "pending"
      : (activeTab === "alliance" ? alliances.length : entries.length) === 0
        ? "empty"
        : "ready";
  const activeEntries = allEntries.filter((entry) => entry.status === "active");
  const defeatedEntries = allEntries.filter((entry) => entry.status === "defeated");
  const config = SERVER_LEADERBOARD_TAB_CONFIG[activeTab];
  return {
    activeTab,
    config,
    supported,
    status,
    serverLabel: String(readModel?.server?.serverInstanceId || "SERVER").toUpperCase(),
    phaseLabel: resolveGeneratedLabel(readModel?.leaderboard),
    countLabel: status === "unavailable"
      ? "—"
      : activeTab === "alliance"
        ? `${alliances.length} aliancí`
        : `${entries.length} hráčů`,
    allEntries,
    entries,
    alliances,
    currentPlayer,
    stats: {
      totalPlayers: allEntries.length,
      activePlayers: activeEntries.length,
      defeatedPlayers: defeatedEntries.length,
      totalScore: allEntries.reduce((sum, entry) => sum + (entry.score || 0), 0)
    }
  };
}
