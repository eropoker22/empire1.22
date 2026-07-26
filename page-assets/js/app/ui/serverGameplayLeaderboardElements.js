export const SERVER_LEADERBOARD_SELECTORS = Object.freeze({
  open: "[data-leaderboard-popup-open]",
  popup: "[data-leaderboard-popup]",
  close: "[data-leaderboard-popup-close]",
  tab: "[data-leaderboard-tab]",
  filter: "[data-leaderboard-filter]",
  search: "[data-leaderboard-search]",
  list: "[data-leaderboard-list]",
  stats: "[data-leaderboard-stats]",
  serverBadge: "[data-leaderboard-server-badge]",
  phase: "[data-leaderboard-phase]",
  myRank: "[data-leaderboard-my-rank]",
  detail: "[data-leaderboard-detail]",
  playerDetail: "[data-leaderboard-player-detail]",
  playerDetailClose: "[data-leaderboard-player-detail-close]",
  toast: "[data-leaderboard-toast]",
  toastTitle: "[data-leaderboard-toast-title]",
  toastMessage: "[data-leaderboard-toast-message]",
  tableTitle: "[data-leaderboard-table-title]",
  modeLabel: "[data-leaderboard-mode-label]",
  count: "[data-leaderboard-count]"
});

export function collectServerGameplayLeaderboardElements(scope) {
  const selectors = SERVER_LEADERBOARD_SELECTORS;
  const popup = scope?.querySelector?.(selectors.popup) || null;
  return {
    popup,
    card: popup?.querySelector?.(".leaderboard-popup-card") || null,
    openButtons: Array.from(scope?.querySelectorAll?.(selectors.open) || []),
    tabs: Array.from(popup?.querySelectorAll?.(selectors.tab) || []),
    filters: Array.from(popup?.querySelectorAll?.(selectors.filter) || []),
    search: popup?.querySelector?.(selectors.search) || null,
    list: popup?.querySelector?.(selectors.list) || null,
    stats: popup?.querySelector?.(selectors.stats) || null,
    serverBadge: popup?.querySelector?.(selectors.serverBadge) || null,
    phase: popup?.querySelector?.(selectors.phase) || null,
    myRank: popup?.querySelector?.(selectors.myRank) || null,
    detail: popup?.querySelector?.(selectors.detail) || null,
    playerDetail: popup?.querySelector?.(selectors.playerDetail) || null,
    playerDetailCard: popup?.querySelector?.(".leaderboard-player-detail-card") || null,
    toast: popup?.querySelector?.(selectors.toast) || null,
    toastTitle: popup?.querySelector?.(selectors.toastTitle) || null,
    toastMessage: popup?.querySelector?.(selectors.toastMessage) || null,
    tableTitle: popup?.querySelector?.(selectors.tableTitle) || null,
    modeLabel: popup?.querySelector?.(selectors.modeLabel) || null,
    count: popup?.querySelector?.(selectors.count) || null
  };
}
