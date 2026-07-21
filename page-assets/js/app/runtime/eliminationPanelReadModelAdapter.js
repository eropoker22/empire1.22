const SCORE_LABELS = Object.freeze({
  controlledDistricts: "Distrikty",
  districtInfluence: "Vliv districtů",
  activeBuildings: "Aktivní budovy",
  cleanCash: "Clean Cash",
  dirtyCash: "Dirty Cash",
  resources: "Zásoby",
  population: "Population",
  recentActivityBonus: "Nedávná aktivita",
  heatPenalty: "Heat postih",
  downtownDistricts: "Downtown",
  totalScore: "Celkem"
});

const asFiniteNumber = (value) => Number.isFinite(Number(value)) ? Number(value) : null;

const formatMetric = (value) => {
  const numeric = asFiniteNumber(value);
  if (numeric === null) return "—";
  return new Intl.NumberFormat("cs-CZ", {
    notation: Math.abs(numeric) >= 10000 ? "compact" : "standard",
    maximumFractionDigits: Math.abs(numeric) >= 1000 ? 1 : 2
  }).format(numeric);
};

const formatCountdown = (ticks, tickRateMs) => {
  const safeTicks = asFiniteNumber(ticks);
  const safeTickRate = asFiniteNumber(tickRateMs);
  if (safeTicks === null || safeTickRate === null || safeTickRate <= 0) return "—";
  const totalSeconds = Math.max(0, Math.ceil((safeTicks * safeTickRate) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}h ${String(minutes).padStart(2, "0")}min ${String(seconds).padStart(2, "0")}s`
    : `${minutes}min ${String(seconds).padStart(2, "0")}s`;
};

const createScoreRows = (breakdown) => {
  if (!breakdown || typeof breakdown !== "object") return [];
  const entries = Object.entries(breakdown).filter(([key, value]) => key !== "totalScore" && asFiniteNumber(value) !== null);
  const maximum = Math.max(1, ...entries.map(([, value]) => Math.abs(Number(value))));
  return entries.map(([key, value]) => ({
    label: SCORE_LABELS[key] || key,
    value: formatMetric(value),
    progress: Math.round((Math.abs(Number(value)) / maximum) * 100),
    negative: Number(value) < 0
  }));
};

const createUnavailableViewModel = (mode) => ({
  mode,
  status: "paused",
  title: mode === "final_lockdown" ? "FINAL LOCKDOWN" : "OČISTA",
  unitLabel: "SERVER DATA",
  countdownLabel: "Stav",
  countdownValue: "—",
  subtitle: "Serverová data se právě nepodařilo načíst.",
  metrics: [],
  leaderboardTitle: mode === "final_lockdown" ? "Top 3" : "Ohrožené gangy",
  leaderboard: [],
  actions: [],
  scoreTitle: "Rozpis score",
  scoreBreakdown: [],
  scoreTotal: "—",
  eliminationResult: null
});

export function createEliminationPanelViewModel(readModel, modeConfig = {}) {
  if (!readModel || typeof readModel !== "object") return createUnavailableViewModel("elimination");
  const activePlayers = asFiniteNumber(readModel.activePlayersRemaining);
  if (readModel.enabled !== true) {
    return {
      ...createUnavailableViewModel("elimination"),
      unitLabel: "CONTROL SERVER",
      countdownValue: "VYPNUTO",
      subtitle: "OČISTA JE NA KONTROLNÍM SERVERU VYPNUTÁ",
      metrics: [{ key: "players", label: "Aktivní hráči", value: formatMetric(activePlayers), icon: "◎" }]
    };
  }

  const currentDanger = Array.isArray(readModel.dangerZone)
    ? readModel.dangerZone.find((entry) => entry?.isCurrentPlayer)
    : null;
  const status = readModel.currentPlayerStatus === "defeated"
    ? "critical"
    : readModel.isQuietHoursNow ? "paused" : readModel.currentPlayerStatus || "safe";
  const scoreBreakdown = createScoreRows(readModel.currentPlayerScoreBreakdown);
  return {
    mode: "elimination",
    status,
    title: "OČISTA",
    unitLabel: readModel.isQuietHoursNow ? "TICHÉ HODINY" : "SERVEROVÁ OČISTA",
    countdownLabel: readModel.isQuietHoursNow ? "Obnoví se za" : "Očista za",
    countdownValue: asFiniteNumber(modeConfig.countdownRemainingMs) !== null
      ? formatCountdown(modeConfig.countdownRemainingMs, 1)
      : formatCountdown(
        readModel.isQuietHoursNow && asFiniteNumber(readModel.quietHoursResumeTick) !== null
          ? Number(readModel.quietHoursResumeTick) - Number(modeConfig.currentTick || 0)
          : readModel.ticksUntilNextElimination,
        modeConfig.tickRateMs
      ),
    subtitle: readModel.eliminationsStopped
      ? "Očista je zastavená: zbývá příliš málo aktivních hráčů."
      : readModel.currentPlayerStatus === "critical"
        ? "Jsi nejslabší aktivní gang. Změň skóre dřív, než doběhne odpočet."
        : "Pořadí vychází ze skutečného stavu serveru.",
    metrics: [
      { key: "score", label: "Score", value: formatMetric(readModel.currentPlayerScore), icon: "◇" },
      { key: "rank", label: "Odspodu", value: readModel.currentPlayerRankFromBottom === null ? "—" : `#${readModel.currentPlayerRankFromBottom}`, icon: "#" },
      { key: "players", label: "Aktivní hráči", value: formatMetric(activePlayers), icon: "◎" },
      { key: "districts", label: "Distrikty", value: formatMetric(currentDanger?.controlledDistricts), icon: "▣" }
    ],
    leaderboardTitle: "Ohrožené gangy",
    leaderboard: Array.isArray(readModel.dangerZone) ? readModel.dangerZone.map((entry) => ({
      rank: `#${entry.rankFromBottom}`,
      ownerId: entry.playerId,
      playerId: entry.playerId,
      name: entry.playerName,
      score: formatMetric(entry.score),
      districts: `${formatMetric(entry.controlledDistricts)}D`,
      isCurrentPlayer: Boolean(entry.isCurrentPlayer)
    })) : [],
    actions: readModel.eliminationsStopped ? [] : [
      { label: "Získej district", subtitle: "posil území", type: "cyan" },
      { label: "Rozjeď výrobu", subtitle: "zvedni zásoby", type: "green" },
      { label: "Sniž Heat", subtitle: "omez postih", type: "pink" }
    ],
    scoreTitle: "Rozpis score",
    scoreBreakdown,
    scoreTotal: formatMetric(readModel.currentPlayerScore),
    eliminationResult: readModel.lastElimination ? {
      ownerId: readModel.lastElimination.playerId,
      playerId: readModel.lastElimination.playerId,
      gangName: readModel.lastElimination.playerName,
      score: "—",
      controlledDistricts: null,
      districtsNeutralized: null,
      title: `Očista proběhla: ${readModel.lastElimination.playerName}`,
      body: `Gang ${readModel.lastElimination.playerName} byl vyřazen ze serverové války.`
    } : null
  };
}

export function createFinalLockdownPanelViewModel(readModel, modeConfig = {}) {
  if (!readModel || typeof readModel !== "object") return createUnavailableViewModel("final_lockdown");
  if (readModel.enabled !== true) {
    return {
      ...createUnavailableViewModel("final_lockdown"),
      countdownValue: "NEAKTIVNÍ",
      subtitle: "Final Lockdown na tomto serveru není aktivní."
    };
  }
  const scoreBreakdown = createScoreRows(readModel.currentPlayerScoreBreakdown);
  return {
    mode: "final_lockdown",
    status: readModel.active ? (readModel.pausedByQuietHours ? "paused" : "final") : "safe",
    title: "FINAL LOCKDOWN",
    unitLabel: readModel.pausedByQuietHours ? "TICHÉ HODINY" : "ZÁVĚREČNÁ FÁZE",
    countdownLabel: readModel.active ? "Do konce" : "Stav",
    countdownValue: readModel.active
      ? (asFiniteNumber(modeConfig.countdownRemainingMs) !== null
        ? formatCountdown(modeConfig.countdownRemainingMs, 1)
        : formatCountdown(readModel.remainingActiveTicks, modeConfig.tickRateMs))
      : "ČEKÁ",
    subtitle: readModel.active
      ? "Rozhoduje skutečné serverové pořadí."
      : "Final Lockdown začne podle tempa tohoto serveru.",
    metrics: [
      { key: "score", label: "Final score", value: formatMetric(readModel.currentPlayerFinalScore), icon: "◇" },
      { key: "rank", label: "Rank", value: readModel.currentPlayerRank === null ? "—" : `#${readModel.currentPlayerRank}`, icon: "#" },
      { key: "top3", label: "Do Top 3", value: formatMetric(readModel.scoreGapToTop3), icon: "△" },
      { key: "districts", label: "Distrikty", value: formatMetric(readModel.currentPlayer?.controlledDistricts), icon: "▣" }
    ],
    leaderboardTitle: "Top 3",
    leaderboard: Array.isArray(readModel.leaderboardTop3) ? readModel.leaderboardTop3.map((entry) => ({
      rank: entry.rank,
      ownerId: entry.playerId,
      playerId: entry.playerId,
      name: entry.playerName,
      score: formatMetric(entry.score),
      districts: `${formatMetric(entry.controlledDistricts)}D`,
      isCurrentPlayer: Boolean(entry.isCurrentPlayer)
    })) : [],
    actions: readModel.active ? [
      { label: "Drž Downtown", subtitle: "braň náskok", type: "cyan" },
      { label: "Zlom Top 3", subtitle: "změň pořadí", type: "pink" },
      { label: "Hlídej Heat", subtitle: "omez postih", type: "green" }
    ] : [],
    scoreTitle: "Rozpis score",
    scoreBreakdown,
    scoreTotal: formatMetric(readModel.currentPlayerFinalScore),
    eliminationResult: null
  };
}
