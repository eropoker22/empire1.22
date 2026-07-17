const formatScore = (value) => {
  const score = Number(value);
  return Number.isFinite(score) ? Math.round(score).toLocaleString("cs-CZ") : "--";
};

const formatRemaining = (finalLockdown) => {
  if (finalLockdown?.pausedByQuietHours) return "Pozastaveno";
  const ticks = Number(finalLockdown?.remainingActiveTicks);
  if (!Number.isFinite(ticks)) return "--";
  return `${Math.max(0, Math.ceil(ticks / 4))} min`;
};

const getFinalLockdown = (event) =>
  event?.detail?.playerView?.finalLockdown
  || event?.detail?.gameplaySlice?.player?.finalLockdown
  || null;

const renderRanking = (target, ranking, { table = false } = {}) => {
  if (!target) return;
  const entries = Array.isArray(ranking) ? ranking : [];
  target.replaceChildren(...entries.map((entry, index) => {
    const rank = Number(entry?.rank) || index + 1;
    const name = entry?.playerName || "Neznámý hráč";
    const score = formatScore(entry?.score);
    const districts = Number.isFinite(Number(entry?.controlledDistricts)) ? entry.controlledDistricts : "--";
    if (table) {
      const row = document.createElement("tr");
      if (entry?.isCurrentPlayer) row.classList.add("is-current-player");
      [rank, name, score, districts].forEach((value) => {
        const cell = document.createElement("td");
        cell.textContent = String(value);
        row.append(cell);
      });
      return row;
    }
    const item = document.createElement("li");
    if (entry?.isCurrentPlayer) item.classList.add("is-current-player");
    const rankElement = document.createElement("span");
    const nameElement = document.createElement("strong");
    const scoreElement = document.createElement("em");
    rankElement.textContent = String(rank);
    nameElement.textContent = name;
    scoreElement.textContent = score;
    item.append(rankElement, nameElement, scoreElement);
    return item;
  }));
};

const closeModal = (modal) => {
  modal.hidden = true;
};

const openModal = (modal) => {
  modal.hidden = false;
  modal.querySelector("[role=dialog]")?.focus();
};

const bindFinalLockdownModals = () => {
  const startModal = document.querySelector('[data-final-lockdown-modal="start"]');
  const resultsModal = document.querySelector('[data-final-lockdown-modal="results"]');
  if (!startModal || !resultsModal) return;
  let lastStatus = null;

  document.querySelectorAll("[data-final-lockdown-close]").forEach((button) => {
    button.addEventListener("click", () => closeModal(button.closest("[data-final-lockdown-modal]")));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    document.querySelectorAll("[data-final-lockdown-modal]:not([hidden])").forEach(closeModal);
  });

  document.addEventListener("empire:gameplay-slice-rendered", (event) => {
    const finalLockdown = getFinalLockdown(event);
    if (!finalLockdown?.enabled) return;

    const ranking = finalLockdown.leaderboardTop3;
    const statusChanged = lastStatus !== finalLockdown.status;
    lastStatus = finalLockdown.status;
    if (finalLockdown.status === "resolved") {
      if (!statusChanged) return;
      startModal.hidden = true;
      renderRanking(resultsModal.querySelector("[data-final-lockdown-results-ranking]"), ranking, { table: true });
      const rank = Number(finalLockdown.currentPlayerRank);
      const summary = resultsModal.querySelector("[data-final-lockdown-results-summary]");
      if (summary) summary.textContent = Number.isFinite(rank)
        ? `Skončil jsi na ${rank}. místě s Empire score ${formatScore(finalLockdown.currentPlayerFinalScore)}.`
        : "Konečný Empire score rozhodl o vítězích této hry.";
      openModal(resultsModal);
      return;
    }

    if (!(finalLockdown.active || finalLockdown.status === "active" || finalLockdown.status === "paused") || !statusChanged) return;
    resultsModal.hidden = true;
    const rank = Number(finalLockdown.currentPlayerRank);
    startModal.querySelector("[data-final-lockdown-rank]").textContent = Number.isFinite(rank) ? `#${rank}` : "--";
    startModal.querySelector("[data-final-lockdown-score]").textContent = formatScore(finalLockdown.currentPlayerFinalScore);
    startModal.querySelector("[data-final-lockdown-remaining]").textContent = formatRemaining(finalLockdown);
    renderRanking(startModal.querySelector("[data-final-lockdown-start-ranking]"), ranking);
    openModal(startModal);
  });
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bindFinalLockdownModals, { once: true });
} else {
  bindFinalLockdownModals();
}
