const PANEL_SELECTOR = "[data-elimination-ai-panel]";
const BODY_SELECTOR = "[data-elimination-ai-panel-body]";
const CARD_SELECTOR = ".elimination-ai-panel__card";
const OPEN_SELECTOR = "[data-elimination-ai-panel-open]";
const CLOSE_SELECTOR = "[data-elimination-ai-panel-close]";
const STATUS_SELECTOR = "[data-elimination-ai-panel-status]";
const COUNTDOWN_WARNING_SELECTOR = "[data-elimination-countdown-warning]";
const COUNTDOWN_WARNING_TIME_SELECTOR = "[data-elimination-countdown-warning-time]";
const MOCK_ELIMINATION_COUNTDOWN_MS = 361000;
const MOCK_ELIMINATION_RESET_COUNTDOWN_MS = 4 * 60 * 60 * 1000;
const COUNTDOWN_WARNING_THRESHOLD_MS = 300000;
let sharedMockCountdownEndsAt = null;

const htmlEscapeMap = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" };

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => htmlEscapeMap[character] ?? character);
}

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

function getSafeNow(timerApi) {
  const now = typeof timerApi?.now === "function" ? Number(timerApi.now()) : Date.now();
  return Number.isFinite(now) ? now : Date.now();
}

function ensureSharedMockCountdownEndsAt(timerApi, initialRemainingMs = MOCK_ELIMINATION_COUNTDOWN_MS) {
  if (!sharedMockCountdownEndsAt) {
    sharedMockCountdownEndsAt = getSafeNow(timerApi) + Math.max(0, Number(initialRemainingMs) || MOCK_ELIMINATION_COUNTDOWN_MS);
  }
  return sharedMockCountdownEndsAt;
}

function getCountdownResetMs(value) {
  return Math.max(1000, Number(value) || MOCK_ELIMINATION_RESET_COUNTDOWN_MS);
}

function getSharedMockCountdownRemainingMs(timerApi, initialRemainingMs, resetRemainingMs = MOCK_ELIMINATION_RESET_COUNTDOWN_MS) {
  const now = getSafeNow(timerApi);
  const remainingMs = ensureSharedMockCountdownEndsAt(timerApi, initialRemainingMs) - now;
  if (remainingMs > 0) return remainingMs;
  const resetMs = getCountdownResetMs(resetRemainingMs);
  sharedMockCountdownEndsAt = now + resetMs;
  return resetMs;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function isHeatPanelItem(item = {}) {
  const key = String(item.key || "").toLowerCase();
  const label = String(item.label || "").toLowerCase();
  return key === "heat" || label.includes("heat");
}

function parseCompactScore(value) {
  const text = String(value ?? "").trim().toLowerCase().replace(/\s+/g, "");
  const match = text.match(/^(-?\d+(?:[.,]\d+)?)([mk])?$/u);
  if (!match) return Number.POSITIVE_INFINITY;
  const amount = Number(match[1].replace(",", "."));
  if (!Number.isFinite(amount)) return Number.POSITIVE_INFINITY;
  if (match[2] === "m") return amount * 1000000;
  if (match[2] === "k") return amount * 1000;
  return amount;
}

function getInitials(value) {
  const text = String(value || "").trim();
  if (!text) return "?";
  return text
    .split(/\s+/u)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "?";
}

function normalizeStatus(value) {
  const status = String(value || "danger").trim().toLowerCase().replace(/_/g, "-");
  if (status === "safe") return "safe";
  if (status === "critical") return "critical";
  if (status === "final") return "final";
  if (status === "paused" || status === "pauza") return "paused";
  return "danger";
}

function normalizeMode(value) {
  return String(value || "elimination").trim().toLowerCase();
}

function getStatusText(status) {
  const normalized = normalizeStatus(status);
  if (normalized === "safe") return "SAFE";
  if (normalized === "critical") return "CRITICAL";
  if (normalized === "final") return "FINAL";
  if (normalized === "paused") return "PAUZA";
  return "DANGER";
}

function createMockFinalLockdownViewModel() {
  return {
    mode: "final_lockdown",
    status: "final",
    title: "FINAL LOCKDOWN",
    aiUnit: "AI-LOCK",
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
      { label: "Útok Top 3", subtitle: "otoč pořadí", type: "pink" }
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
  return {
    mode: "elimination",
    status: "danger",
    title: "AI OPERÁTOR OČISTY",
    aiUnit: "AI-07",
    countdownLabel: "Očista za",
    countdownValue: formatCountdown(remainingMs),
    subtitle: "Nejnižší gang vypadne",
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
      { rank: 3, ownerId: 3, playerId: "player:3", name: "LowKeyLad", score: "980K", districts: "4D" }
    ],
    actions: [
      { label: "+ District", subtitle: "získej území", type: "cyan" },
      { label: "Útok nahoru", subtitle: "zvedni score", type: "pink" }
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

export function createMockEliminationAiPanelViewModel(options = {}) {
  const mode = normalizeMode(options.mode || options.mockMode || options.viewMode);
  return mode === "final_lockdown" || mode === "final" ? createMockFinalLockdownViewModel() : createMockEliminationViewModel(options);
}

function isPanelViewModel(value) {
  return Boolean(value && typeof value === "object" && Array.isArray(value.metrics) && Array.isArray(value.actions));
}

function resolvePanelViewModel(input = {}, fallbackMode = "elimination") {
  if (isPanelViewModel(input)) return input;
  if (isPanelViewModel(input.viewModel)) return input.viewModel;
  return createMockEliminationAiPanelViewModel({
    mode: input.mode || input.mockMode || input.viewMode || fallbackMode,
    countdownRemainingMs: input.countdownRemainingMs
  });
}

function createSection(title, content, modifier = "") {
  const className = modifier ? ` elimination-ai-panel__section--${escapeHtml(modifier)}` : "";
  return `
    <section class="elimination-ai-panel__section${className}">
      <h3>${escapeHtml(title)}</h3>
      ${content}
    </section>
  `;
}

function renderHero(viewModel) {
  return `
    <div class="elimination-ai-panel__hero">
      <div class="elimination-ai-panel__hero-main">
        <span class="elimination-ai-panel__countdown-label">${escapeHtml(viewModel.countdownLabel)}</span>
        <strong class="elimination-ai-panel__countdown">${escapeHtml(viewModel.countdownValue)}</strong>
        <span class="elimination-ai-panel__subtitle">${escapeHtml(viewModel.subtitle)}</span>
      </div>
    </div>
  `;
}

function renderMetrics(metrics = []) {
  const safeMetrics = asArray(metrics).filter((metric) => !isHeatPanelItem(metric));
  return `
    <div class="elimination-ai-panel__metrics">
      ${safeMetrics.map((metric) => `
        <div class="elimination-ai-panel__metric" data-ai-metric="${escapeHtml(metric.key || metric.label)}">
          <i aria-hidden="true">${escapeHtml(metric.icon || "◇")}</i>
          <span>${escapeHtml(metric.label)}</span>
          <strong>${escapeHtml(metric.value)}</strong>
        </div>
      `).join("")}
    </div>
  `;
}

function renderLeaderboard(entries = []) {
  const safeEntries = asArray(entries).slice(0, 3);
  if (!safeEntries.length) {
    return `<p class="elimination-ai-panel__empty">Data se načítají</p>`;
  }
  return `
    <div class="elimination-ai-panel__leaderboard">
      ${safeEntries.map((entry) => `
        <div class="elimination-ai-panel__leaderboard-row${entry.isCurrentPlayer ? " elimination-ai-panel__leaderboard-row--current is-current" : ""}">
          <span class="elimination-ai-panel__leaderboard-rank">${escapeHtml(entry.rank)}</span>
          <i class="elimination-ai-panel__leaderboard-emblem" aria-hidden="true"></i>
          <strong class="elimination-ai-panel__leaderboard-name">${escapeHtml(entry.isCurrentPlayer ? `${entry.name} (TY)` : entry.name)}</strong>
          <span class="elimination-ai-panel__leaderboard-score">${escapeHtml(entry.score)}</span>
          <span class="elimination-ai-panel__leaderboard-districts">${escapeHtml(entry.districts)}</span>
        </div>
      `).join("")}
    </div>
  `;
}

function progressStyle(progress) {
  const numericProgress = Math.max(0, Math.min(100, Number(progress) || 0));
  return `--score-progress: ${numericProgress}%;`;
}

function renderScoreBreakdown(viewModel) {
  const rows = asArray(viewModel.scoreBreakdown).filter((row) => !isHeatPanelItem(row)).slice(0, 5);
  if (!rows.length) {
    return `<p class="elimination-ai-panel__empty">Data se načítají</p>`;
  }
  return `
    <div class="elimination-ai-panel__score">
      ${rows.map((row) => `
        <div class="elimination-ai-panel__score-row${row.negative ? " elimination-ai-panel__score-row--negative" : ""}" style="${escapeHtml(progressStyle(row.progress))}">
          <div class="elimination-ai-panel__score-label">
            <span>${escapeHtml(row.label)}</span>
            <strong>${escapeHtml(row.value)}</strong>
          </div>
          <i aria-hidden="true"></i>
        </div>
      `).join("")}
      <div class="elimination-ai-panel__score-total">
        <span>Celkem</span>
        <strong>${escapeHtml(viewModel.scoreTotal)}</strong>
      </div>
    </div>
  `;
}

function resolveEliminationResult(input = {}) {
  if (input.eliminationResult && typeof input.eliminationResult === "object") return input.eliminationResult;
  const viewModel = resolvePanelViewModel(input, input.mode || input.mockMode || "elimination");
  const candidates = asArray(viewModel.leaderboard);
  const weakest = candidates.reduce((current, entry) => (
    parseCompactScore(entry?.score) < parseCompactScore(current?.score) ? entry : current
  ), candidates[0] || null);
  const gangName = String(weakest?.gangName || weakest?.name || weakest?.playerName || "neznámý gang").trim();
  return {
    ownerId: weakest?.ownerId ?? weakest?.playerId ?? null,
    playerId: weakest?.playerId ?? weakest?.ownerId ?? null,
    gangName,
    avatarSrc: weakest?.avatarSrc || weakest?.avatar || "",
    avatarFallback: getInitials(gangName),
    score: weakest?.score || "",
    districtsNeutralized: Number(weakest?.districtsNeutralized || 0) || null,
    title: `Policie vystřílela gang ${gangName}`,
    body: "Policie vystřílela gang na sračky a nic tu po něm nezbylo."
  };
}

function renderEliminationResultNotice(result = {}) {
  const gangName = String(result.gangName || "neznámý gang").trim();
  const avatarSrc = String(result.avatarSrc || "").trim();
  const avatarFallback = String(result.avatarFallback || getInitials(gangName)).trim();
  const districtCount = Number(result.districtsNeutralized);
  const districtLine = Number.isFinite(districtCount) && districtCount > 0
    ? `<span>${escapeHtml(districtCount)} districtů je teď neobsazených</span>`
    : "";
  return `
    <section class="elimination-ai-panel__result" role="alert" aria-live="assertive">
      <div class="elimination-ai-panel__result-avatar" aria-hidden="true">
        ${avatarSrc
          ? `<img src="${escapeHtml(avatarSrc)}" alt="">`
          : `<span>${escapeHtml(avatarFallback)}</span>`}
      </div>
      <div class="elimination-ai-panel__result-copy">
        <span>Očista dokončena</span>
        <strong>${escapeHtml(result.title || `Policie vystřílela gang ${gangName}`)}</strong>
        <p>${escapeHtml(result.body || "Policie vystřílela gang na sračky a nic tu po něm nezbylo.")}</p>
        ${districtLine}
      </div>
    </section>
  `;
}

function renderPanelContent(viewModel, eliminationResult = null) {
  return [
    eliminationResult ? renderEliminationResultNotice(eliminationResult) : "",
    renderHero(viewModel),
    renderMetrics(viewModel.metrics),
    createSection(viewModel.leaderboardTitle, renderLeaderboard(viewModel.leaderboard), "leaderboard"),
    createSection(viewModel.scoreTitle, renderScoreBreakdown(viewModel), "score")
  ].join("");
}

export function renderEliminationAiPanel(input = {}) {
  return renderPanelContent(resolvePanelViewModel(input, "elimination"), input.eliminationResult || null);
}

export function renderFinalLockdownAiPanel(input = {}) {
  return renderPanelContent(resolvePanelViewModel(input, "final_lockdown"), input.eliminationResult || null);
}

export function renderEliminationAiPanelBody(input = {}) {
  return renderPanelContent(resolvePanelViewModel(input, input.mode || input.mockMode || "elimination"), input.eliminationResult || null);
}

function setHeader(panel, input = {}) {
  const viewModel = resolvePanelViewModel(input, input.mode || input.mockMode || "elimination");
  const statusValue = normalizeStatus(viewModel.status);
  const status = panel.querySelector?.(STATUS_SELECTOR);
  if (status) {
    status.textContent = getStatusText(statusValue);
    status.dataset.state = statusValue;
  }
  return statusValue;
}

export function bindEliminationAiPanel(root, deps = {}) {
  if (deps.resetCountdown) {
    sharedMockCountdownEndsAt = null;
  }
  const documentRef = deps.documentRef || root?.ownerDocument || (typeof document !== "undefined" ? document : null);
  const panel = root?.querySelector?.(PANEL_SELECTOR) || documentRef?.querySelector?.(PANEL_SELECTOR);
  if (!root || !panel) return false;
  const body = panel.querySelector?.(BODY_SELECTOR);
  const card = panel.querySelector?.(CARD_SELECTOR);
  const panelIsInsideRoot = typeof root.contains === "function" ? root.contains(panel) : true;
  const timerApi = deps.timerApi || (typeof window !== "undefined" ? window : globalThis);
  let lastTrigger = null;
  let countdownEndsAt = null;
  let refreshIntervalId = null;
  let lastEliminationResult = null;

  const createInput = (countdownRemainingMs) => {
    const viewModel = deps.getViewModel?.();
    return {
      viewModel: isPanelViewModel(viewModel) ? viewModel : null,
      mode: deps.getMockMode?.() || deps.mockMode || "elimination",
      countdownRemainingMs,
      eliminationResult: lastEliminationResult
    };
  };

  const handleCountdownElapsed = () => {
    const input = createInput(0);
    let result = deps.resolveEliminationResult?.(input) || resolveEliminationResult(input);
    const enrichedResult = deps.onCountdownElapsed?.(result, input);
    if (enrichedResult && typeof enrichedResult === "object") {
      result = { ...result, ...enrichedResult };
    }
    lastEliminationResult = result;
    const CustomEventCtor = documentRef?.defaultView?.CustomEvent || globalThis.CustomEvent;
    if (typeof CustomEventCtor === "function") {
      documentRef?.dispatchEvent?.(new CustomEventCtor("empire:elimination-resolved", {
        detail: result
      }));
    }
    return result;
  };

  const getCountdownRemainingMs = () => {
    const resetMs = getCountdownResetMs(deps.resetCountdownMs);
    if (!countdownEndsAt) {
      return getSharedMockCountdownRemainingMs(timerApi, deps.initialCountdownMs, resetMs);
    }
    const now = getSafeNow(timerApi);
    const remainingMs = countdownEndsAt - now;
    if (remainingMs > 0) return remainingMs;
    handleCountdownElapsed();
    countdownEndsAt = now + resetMs;
    sharedMockCountdownEndsAt = countdownEndsAt;
    return resetMs;
  };

  const startLiveCountdown = () => {
    if (refreshIntervalId || typeof timerApi?.setInterval !== "function") return;
    refreshIntervalId = timerApi.setInterval(() => {
      if (!panel.hidden) render();
    }, 1000);
  };

  const stopLiveCountdown = () => {
    if (!refreshIntervalId || typeof timerApi?.clearInterval !== "function") return;
    timerApi.clearInterval(refreshIntervalId);
    refreshIntervalId = null;
  };

  const getInput = () => createInput(getCountdownRemainingMs());

  const render = () => {
    if (!body) return false;
    const input = getInput();
    const statusClass = setHeader(panel, input);
    panel.dataset.aiState = statusClass;
    card?.classList?.remove?.("is-safe", "is-danger", "is-critical", "is-defeated", "is-final", "is-paused", "is-pauza");
    card?.classList?.add?.(`is-${statusClass}`);
    body.innerHTML = renderEliminationAiPanelBody(input);
    return true;
  };

  const close = () => {
    panel.hidden = true;
    panel.classList?.remove?.("is-open");
    documentRef?.body?.classList?.remove?.("elimination-ai-panel-open");
    documentRef?.removeEventListener?.("keydown", handleKeydown);
    stopLiveCountdown();
    lastTrigger?.focus?.();
  };

  const open = (trigger = null) => {
    lastTrigger = trigger;
    countdownEndsAt = ensureSharedMockCountdownEndsAt(timerApi, deps.initialCountdownMs);
    render();
    panel.hidden = false;
    panel.classList?.add?.("is-open");
    documentRef?.body?.classList?.add?.("elimination-ai-panel-open");
    documentRef?.addEventListener?.("keydown", handleKeydown);
    startLiveCountdown();
    card?.focus?.();
  };

  function handleKeydown(event) {
    if (event.key === "Escape") {
      event.preventDefault?.();
      close();
    }
  }

  const handleClick = (event) => {
    const target = event.target;
    const openTarget = target?.closest?.(OPEN_SELECTOR);
    if (openTarget) {
      event.preventDefault?.();
      open(openTarget);
      return;
    }
    if (target?.closest?.(CLOSE_SELECTOR)) {
      event.preventDefault?.();
      close();
    }
  };

  const handleGameplaySliceRendered = () => {
    if (!panel.hidden) render();
  };

  root.addEventListener?.("click", handleClick);
  if (!panelIsInsideRoot) {
    panel.addEventListener?.("click", handleClick);
  }
  documentRef?.addEventListener?.("empire:gameplay-slice-rendered", handleGameplaySliceRendered);
  return {
    close,
    open,
    render,
    destroy() {
      root.removeEventListener?.("click", handleClick);
      if (!panelIsInsideRoot) {
        panel.removeEventListener?.("click", handleClick);
      }
      documentRef?.removeEventListener?.("keydown", handleKeydown);
      documentRef?.removeEventListener?.("empire:gameplay-slice-rendered", handleGameplaySliceRendered);
      stopLiveCountdown();
    }
  };
}

export function bindEliminationCountdownWarning(root, deps = {}) {
  if (deps.resetCountdown) {
    sharedMockCountdownEndsAt = null;
  }
  const documentRef = deps.documentRef || root?.ownerDocument || (typeof document !== "undefined" ? document : null);
  const warning = root?.querySelector?.(COUNTDOWN_WARNING_SELECTOR) || documentRef?.querySelector?.(COUNTDOWN_WARNING_SELECTOR);
  if (!root || !warning) return false;
  const timerApi = deps.timerApi || (typeof window !== "undefined" ? window : globalThis);
  const timeNode = warning.querySelector?.(COUNTDOWN_WARNING_TIME_SELECTOR);
  let intervalId = null;

  const render = () => {
    const remainingMs = getSharedMockCountdownRemainingMs(timerApi, deps.initialCountdownMs, deps.resetCountdownMs);
    const shouldShow = remainingMs > 0 && remainingMs <= COUNTDOWN_WARNING_THRESHOLD_MS;
    warning.hidden = !shouldShow;
    warning.classList?.toggle?.("is-visible", shouldShow);
    if (timeNode) {
      timeNode.textContent = formatCountdown(remainingMs);
    }
    if (remainingMs <= 0 && intervalId && typeof timerApi?.clearInterval === "function") {
      timerApi.clearInterval(intervalId);
      intervalId = null;
    }
    return shouldShow;
  };

  ensureSharedMockCountdownEndsAt(timerApi, deps.initialCountdownMs);
  render();
  if (typeof timerApi?.setInterval === "function") {
    intervalId = timerApi.setInterval(render, 1000);
  }

  return {
    render,
    destroy() {
      if (intervalId && typeof timerApi?.clearInterval === "function") {
        timerApi.clearInterval(intervalId);
      }
      intervalId = null;
    }
  };
}
