export const MOCK_ELIMINATION_COUNTDOWN_MS = 361000;

function formatCountdown(value) {
  const totalSeconds = Math.max(0, Math.ceil(Number(value || 0) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const paddedMinutes = String(minutes).padStart(2, "0");
  const paddedSeconds = String(seconds).padStart(2, "0");
  if (hours > 0) return `${hours}h ${paddedMinutes}min ${paddedSeconds}s`;
  if (minutes > 0) return `${minutes}min ${paddedSeconds}s`;
  return `${seconds}s`;
}

function normalizeMode(value) {
  return String(value || "elimination").trim().toLowerCase();
}

function createEliminationResultTitle(gangName) {
  return `Očista proběhla: ${gangName}`;
}

function createEliminationResultBody(gangName) {
  return `Policie rozdrtila gang ${gangName}. Jeho území přechází do lockdownu.`;
}

function createMockFinalLockdownViewModel() {
  return {
    mode: "final_lockdown",
    status: "final",
    title: "FINAL LOCKDOWN",
    unitLabel: "PURGE-LOCK",
    countdownLabel: "Do rozsudku",
    countdownValue: "7h 42m",
    subtitle: "Top 3 bere město",
    metrics: [
      { key: "score", label: "Score", value: "8.47M", icon: "◇" },
      { key: "rank", label: "Rank", value: "#4", icon: "#" },
      { key: "top3", label: "Do Top 3", value: "+38K", icon: "△" },
      { key: "districts", label: "Districts", value: "23", icon: "▣" }
    ],
    leaderboardTitle: "Top 3",
    leaderboard: [
      { rank: 1, name: "Rado Viper", score: "614K", districts: "18D" },
      { rank: 2, name: "Nika Static", score: "598K", districts: "20D" },
      { rank: 3, name: "Mara Byte", score: "532K", districts: "15D" }
    ],
    actions: [
      { label: "+ Downtown", subtitle: "vezmi bonus", type: "cyan" },
      { label: "Útok Top 3", subtitle: "otoč pořadí", type: "pink" },
      { label: "Uzamknout score", subtitle: "hlídej náskok", type: "green" }
    ],
    scoreTitle: "Rozpis score",
    scoreBreakdown: [
      { label: "Districts", value: "5.62M", progress: 68 },
      { label: "Budovy", value: "1.74M", progress: 42 },
      { label: "Influence", value: "850K", progress: 30 },
      { label: "Cash", value: "420K", progress: 22 }
    ],
    scoreTotal: "8.47M"
  };
}

function createMockEliminationViewModel(options = {}) {
  const remainingMs = Number.isFinite(Number(options.countdownRemainingMs))
    ? Number(options.countdownRemainingMs)
    : MOCK_ELIMINATION_COUNTDOWN_MS;
  const gangName = "LowKeyLad";
  return {
    mode: "elimination",
    status: "danger",
    title: "OČISTA / PURGE OKNO",
    unitLabel: "PURGE-07",
    countdownLabel: "Očista za",
    countdownValue: formatCountdown(remainingMs),
    subtitle: "Nejslabší gang vypadne",
    metrics: [
      { key: "score", label: "Score", value: "8.47M", icon: "◇" },
      { key: "rank", label: "Rank", value: "2.", icon: "#" },
      { key: "players", label: "Hráči", value: "18/20", icon: "◎" },
      { key: "districts", label: "Districts", value: "23", icon: "▣" }
    ],
    leaderboardTitle: "Poslední 3 hráči",
    leaderboard: [
      { rank: 1, ownerId: 2, playerId: "player:2", name: "StreetPhantom", score: "1.30M", districts: "5D" },
      { rank: 2, ownerId: 1, playerId: "player:1", name: "NeonViper", score: "1.06M", districts: "6D", isCurrentPlayer: true },
      { rank: 3, ownerId: 3, playerId: "player:3", name: gangName, score: "980K", districts: "4D" }
    ],
    actions: [
      { label: "+ District", subtitle: "získej území", type: "cyan" },
      { label: "Útok nahoru", subtitle: "zvedni score", type: "pink" },
      { label: "Správa score", subtitle: "posil budovy", type: "green" }
    ],
    scoreTitle: "Rozpis score",
    scoreBreakdown: [
      { label: "Districts", value: "5.62M", progress: 68 },
      { label: "Budovy", value: "1.74M", progress: 42 },
      { label: "Influence", value: "850K", progress: 30 },
      { label: "Cash", value: "420K", progress: 22 }
    ],
    scoreTotal: "8.47M",
    eliminationResult: {
      ownerId: 3,
      playerId: "player:3",
      gangName,
      avatarSrc: "",
      avatarFallback: "LL",
      score: "980K",
      controlledDistricts: 4,
      districtsNeutralized: 4,
      title: createEliminationResultTitle(gangName),
      body: createEliminationResultBody(gangName)
    }
  };
}

export function createMockEliminationAiPanelViewModel(options = {}) {
  const mode = normalizeMode(options.mode || options.mockMode || options.viewMode);
  return mode === "final_lockdown" || mode === "final"
    ? createMockFinalLockdownViewModel()
    : createMockEliminationViewModel(options);
}

export const createMockEliminationPurgePanelViewModel = createMockEliminationAiPanelViewModel;
