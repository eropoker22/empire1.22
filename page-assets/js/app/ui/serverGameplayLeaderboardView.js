import {
  SERVER_LEADERBOARD_SUPPORTED_TABS,
  SERVER_LEADERBOARD_TAB_CONFIG
} from "./serverGameplayLeaderboardViewModel.js";

const escapeHtml = (value) => String(value ?? "")
  .replace(/&/gu, "&amp;")
  .replace(/</gu, "&lt;")
  .replace(/>/gu, "&gt;")
  .replace(/"/gu, "&quot;")
  .replace(/'/gu, "&#039;");

const formatNumber = (value) => (
  Math.max(0, Number(value) || 0).toLocaleString("cs-CZ")
);

const formatScore = (value) => (
  value === null || value === undefined ? "—" : formatNumber(value)
);

const rankClass = (rank) => (
  rank >= 1 && rank <= 3 ? `is-rank-${rank}` : ""
);

const renderTrend = (entry) => {
  const movement = Number(entry.movement || 0);
  if (movement > 0) {
    return `<span class="leaderboard-trend leaderboard-trend--up">▲ +${formatNumber(movement)}</span>`;
  }
  if (movement < 0) {
    return `<span class="leaderboard-trend leaderboard-trend--down">▼ -${formatNumber(Math.abs(movement))}</span>`;
  }
  return '<span class="leaderboard-trend leaderboard-trend--flat">●</span>';
};

const renderPlayerRow = (entry, selectedPlayerId) => `
  <article class="leaderboard-table-row${entry.isCurrentPlayer ? " is-current" : ""}${entry.playerId === selectedPlayerId ? " is-selected" : ""}"
    data-leaderboard-player-id="${escapeHtml(entry.playerId)}" tabindex="0">
    <span class="leaderboard-rank-cell ${rankClass(entry.rank)}">#${formatNumber(entry.rank)}</span>
    ${renderTrend(entry)}
    <span class="leaderboard-player-cell">
      <strong>${escapeHtml(entry.isCurrentPlayer ? `${entry.name} (ty)` : entry.name)}</strong>
      <span class="leaderboard-player-score-mobile" aria-label="Skóre ${escapeHtml(formatScore(entry.score))}">${escapeHtml(formatScore(entry.score))}</span>
      <span class="leaderboard-player-gang">${escapeHtml(entry.playerId)}</span>
    </span>
    <span class="leaderboard-cell-muted">${escapeHtml(entry.factionId)}</span>
    <span class="leaderboard-cell-muted">${escapeHtml(entry.allianceTag || "—")}</span>
    <span class="leaderboard-number-cell">${formatNumber(entry.controlledDistricts)}</span>
    <span class="leaderboard-number-cell">${formatNumber(entry.influence)}</span>
    <span><span class="leaderboard-cell-muted">${entry.status === "defeated" ? "Poražen" : "Aktivní"}</span></span>
    <span class="leaderboard-score-cell">${escapeHtml(formatScore(entry.score))}</span>
    <span class="leaderboard-actions">
      <button type="button" class="button leaderboard-row-action" data-leaderboard-action="view"
        data-player-id="${escapeHtml(entry.playerId)}">Detail</button>
    </span>
  </article>
`;

const renderPlayerTable = (entries, selectedPlayerId) => `
  <div class="leaderboard-table-head" aria-hidden="true">
    <span>Rank</span><span>Trend</span><span>Hráč / Gang</span><span>Frakce</span>
    <span>Aliance</span><span>Distrikty</span><span>Vliv</span><span>Stav</span>
    <span>Empire score</span><span>Akce</span>
  </div>
  ${entries.map((entry) => renderPlayerRow(entry, selectedPlayerId)).join("")}
`;

const renderAllianceTable = (alliances) => `
  <div class="leaderboard-table-head leaderboard-alliance-row" aria-hidden="true">
    <span>Rank</span><span>Aliance</span><span>Členové</span><span>Distrikty</span>
    <span>Celkový vliv</span><span>Empire score</span><span>Top hráč</span>
    <span>Stav</span><span>Akce</span>
  </div>
  ${alliances.map((alliance) => `
    <article class="leaderboard-table-row leaderboard-alliance-row">
      <span class="leaderboard-rank-cell ${rankClass(alliance.rank)}">#${alliance.rank}</span>
      <span class="leaderboard-player-cell"><strong>${escapeHtml(alliance.tag)}</strong></span>
      <span class="leaderboard-number-cell">${formatNumber(alliance.members)}</span>
      <span class="leaderboard-number-cell">${formatNumber(alliance.controlledDistricts)}</span>
      <span class="leaderboard-number-cell">${formatNumber(alliance.influence)}</span>
      <span class="leaderboard-score-cell">${formatNumber(alliance.score)}</span>
      <span class="leaderboard-cell-muted">${escapeHtml(alliance.topPlayer?.name || "—")}</span>
      <span class="leaderboard-cell-muted">Server data</span>
      <span class="leaderboard-actions"><button type="button" class="button leaderboard-row-action"
        data-leaderboard-action="view-alliance" data-alliance="${escapeHtml(alliance.tag)}">Profil</button></span>
    </article>
  `).join("")}
`;

const renderStats = (model) => [
  ["Hráči ve výpisu", model.stats.totalPlayers],
  ["Aktivní", model.stats.activePlayers],
  ["Empire score", model.stats.totalScore],
  ["Poražení", model.stats.defeatedPlayers]
].map(([label, value]) => `
  <span class="leaderboard-popup-stat">
    <small>${escapeHtml(label)}</small><strong>${formatNumber(value)}</strong>
  </span>
`).join("");

const renderMyRank = (entry) => entry ? `
  <span class="leaderboard-panel-label">TVŮJ RANK</span>
  <div class="leaderboard-my-rank__hero"><strong>#${formatNumber(entry.rank)}</strong></div>
  <button type="button" class="button leaderboard-my-rank__detail"
    data-leaderboard-action="view" data-player-id="${escapeHtml(entry.playerId)}">Detail hráče</button>
` : `
  <span class="leaderboard-panel-label">TVŮJ RANK</span>
  <p>Mimo výpis.</p>
`;

const renderDetail = (entry) => {
  if (!entry) return '<div class="leaderboard-detail-empty"><span>Vyber hráče.</span></div>';
  const stats = [
    ["Rank", `#${entry.rank}`],
    ["Empire score", formatScore(entry.score)],
    ["Distrikty", formatNumber(entry.controlledDistricts)],
    ["Vliv", formatNumber(entry.influence)],
    ["Stav", entry.status === "defeated" ? "Poražen" : "Aktivní"]
  ];
  return `
    <span class="leaderboard-panel-label">DETAIL HRÁČE</span>
    <div class="leaderboard-detail-identity">
      <strong>${escapeHtml(entry.name)}</strong>
      <span>${escapeHtml(entry.playerId)} · ${escapeHtml(entry.factionId)} · ${escapeHtml(entry.allianceTag || "Bez aliance")}</span>
    </div>
    <div class="leaderboard-detail-grid">
      ${stats.map(([label, value]) => `
        <span class="leaderboard-detail-stat"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></span>
      `).join("")}
    </div>
    <div class="leaderboard-detail-actions">
      <button type="button" class="button leaderboard-detail-action"
        data-leaderboard-action="bounty" data-player-id="${escapeHtml(entry.playerId)}">Bounty</button>
    </div>
  `;
};

const writeText = (element, value) => {
  const text = String(value ?? "");
  if (!element || element.textContent === text) return 0;
  element.textContent = text;
  return 1;
};

const writeHtml = (element, value) => {
  if (!element || element.innerHTML === value) return 0;
  element.innerHTML = value;
  return 1;
};

export function renderServerGameplayLeaderboard(elements, model, state = {}) {
  let writes = 0;
  writes += writeText(elements.serverBadge, `Server: ${model.serverLabel}`);
  writes += writeText(elements.phase, model.phaseLabel);
  writes += writeText(elements.tableTitle, model.config.title);
  writes += writeText(elements.modeLabel, model.config.label);
  writes += writeText(elements.count, model.countLabel);
  elements.tabs.forEach((tab) => {
    const tabId = tab.dataset.leaderboardTab;
    const supported = SERVER_LEADERBOARD_SUPPORTED_TABS.has(tabId);
    const active = tabId === model.activeTab;
    tab.disabled = !supported;
    tab.title = supported ? "" : "Tato statistika se připravuje.";
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", active ? "true" : "false");
    tab.setAttribute("aria-disabled", supported ? "false" : "true");
  });
  elements.filters.forEach((filter) => {
    filter.classList.toggle(
      "is-active",
      (filter.dataset.leaderboardFilter || "current") === state.modeFilter
    );
  });
  writes += writeHtml(elements.stats, model.status === "ready" ? renderStats(model) : "");
  const message = model.status === "unavailable"
    ? "Leaderboard se právě nepodařilo načíst."
    : model.status === "pending"
      ? "Tato statistika se připravuje."
      : "Na tomto serveru zatím nejsou aktivní hráči.";
  const listHtml = model.status === "ready"
    ? model.activeTab === "alliance"
      ? renderAllianceTable(model.alliances)
      : renderPlayerTable(model.entries, state.selectedPlayerId)
    : `<div class="leaderboard-detail-empty">${escapeHtml(message)}</div>`;
  writes += writeHtml(elements.list, listHtml);
  writes += writeHtml(elements.myRank, renderMyRank(model.currentPlayer));
  const selected = model.allEntries.find(
    (entry) => entry.playerId === state.selectedPlayerId
  ) || model.currentPlayer;
  writes += writeHtml(elements.detail, renderDetail(selected));
  return writes;
}

export const isServerLeaderboardTab = (value) => (
  Object.hasOwn(SERVER_LEADERBOARD_TAB_CONFIG, String(value || ""))
);
