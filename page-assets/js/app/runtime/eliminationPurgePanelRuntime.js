import {
  MOCK_ELIMINATION_COUNTDOWN_MS,
  createMockEliminationAiPanelViewModel,
  createMockEliminationPurgePanelViewModel
} from "./eliminationPurgePanelViewModel.js";
import { closeOverlay, openOverlay } from "../ui/legacyOverlayCoordinator.js";

export {
  createMockEliminationAiPanelViewModel,
  createMockEliminationPurgePanelViewModel
};

const PURGE_PANEL_SELECTOR = "[data-elimination-ai-panel]";
const PURGE_PANEL_BODY_SELECTOR = "[data-elimination-ai-panel-body]";
const PURGE_PANEL_CARD_SELECTOR = ".elimination-ai-panel__card";
const PURGE_PANEL_OPEN_SELECTOR = "[data-elimination-ai-panel-open]";
const PURGE_PANEL_CLOSE_SELECTOR = "[data-elimination-ai-panel-close]";
const PURGE_PANEL_STATUS_SELECTOR = "[data-elimination-ai-panel-status]";
const COUNTDOWN_WARNING_SELECTOR = "[data-elimination-countdown-warning]";
const COUNTDOWN_WARNING_TIME_SELECTOR = "[data-elimination-countdown-warning-time]";
const COUNTDOWN_WARNING_CLOSE_SELECTOR = "[data-elimination-countdown-warning-close]";
const RESULT_POPUP_SELECTOR = "[data-elimination-result-popup]";
const RESULT_POPUP_BODY_SELECTOR = "[data-elimination-result-popup-body]";
const RESULT_POPUP_CARD_SELECTOR = ".elimination-result-popup__card";
const RESULT_POPUP_CLOSE_SELECTOR = "[data-elimination-result-popup-close]";
const RESULT_POPUP_AVATAR_SELECTOR = "[data-elimination-result-popup-avatar]";
const MOCK_ELIMINATION_RESET_COUNTDOWN_MS = 4 * 60 * 60 * 1000;
const COUNTDOWN_WARNING_THRESHOLD_MS = 300000;
const COUNTDOWN_WARNING_REOPEN_THRESHOLD_MS = 60000;
let sharedMockCountdownEndsAt = null;
let sharedLastResolvedCountdownEndsAt = null;
let sharedLastEliminationResult = null;

const htmlEscapeMap = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" };
const safeDataImageUrlPattern = /^data:image\/(?:gif|png|jpeg|jpg|webp);base64,[a-z0-9+/=\s]+$/iu;

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

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => htmlEscapeMap[character] ?? character);
}

function escapeUrlAttribute(value) {
  const rawValue = String(value ?? "").trim();
  if (!rawValue) return "";

  const schemeCheckValue = rawValue.replace(/[\u0000-\u001F\u007F\s]+/g, "");
  if (/^javascript:/iu.test(schemeCheckValue)) return "";

  const schemeMatch = /^[a-z][a-z0-9+.-]*:/iu.exec(rawValue);
  if (schemeMatch) {
    const scheme = schemeMatch[0].toLowerCase();
    if (scheme !== "http:" && scheme !== "https:" && !safeDataImageUrlPattern.test(rawValue)) {
      return "";
    }
  }

  return escapeHtml(rawValue);
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

function renderCountdownValue(value) {
  const text = String(value ?? "");
  const match = text.match(/^(.*?)(\d{1,2}s)$/u);
  if (!match) return escapeHtml(text);
  const prefix = match[1].trimEnd();
  const seconds = match[2];
  const secondsMarkup = `<span class="elimination-ai-panel__countdown-seconds">${escapeHtml(seconds)}</span>`;
  return prefix ? `${escapeHtml(prefix)} ${secondsMarkup}` : secondsMarkup;
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

function resetSharedMockEliminationState() {
  sharedMockCountdownEndsAt = null;
  sharedLastResolvedCountdownEndsAt = null;
  sharedLastEliminationResult = null;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function isHeatPanelItem(item = {}) {
  const key = String(item.key || "").toLowerCase();
  const label = String(item.label || "").toLowerCase();
  return key === "heat" || label.includes("heat");
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

function createEliminationResultTitle(gangName) {
  return `Očista proběhla: ${gangName}`;
}

function createEliminationResultBody(gangName) {
  return `Policie rozdrtila gang ${gangName}. Jeho území se vrací pod kontrolu města.`;
}

function renderResultBody(body, gangName) {
  return String(body || createEliminationResultBody(gangName))
    .replace(/\s*Jeho území se vrací pod kontrolu města\./u, "")
    .trim();
}

function getFiniteNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function formatRemainingPlayers(remainingPlayers, serverCapacity) {
  const remaining = getFiniteNumber(remainingPlayers);
  if (remaining === null) return "—";
  const safeRemaining = Math.max(0, Math.floor(remaining));
  const capacity = getFiniteNumber(serverCapacity);
  if (capacity !== null && capacity > 0) {
    return `${safeRemaining}/${Math.max(1, Math.floor(capacity))}`;
  }
  return `${safeRemaining} hráčů`;
}

function renderResultTitle(title, gangName) {
  const safeTitle = String(title || createEliminationResultTitle(gangName));
  const safeGangName = String(gangName || "").trim();
  if (!safeGangName || !safeTitle.includes(safeGangName)) {
    return escapeHtml(safeTitle);
  }
  const [prefix, ...rest] = safeTitle.split(safeGangName);
  return `${escapeHtml(prefix)}<span>${escapeHtml(safeGangName)}</span>${escapeHtml(rest.join(safeGangName))}`;
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

function isPanelViewModel(value) {
  if (!value || typeof value !== "object") return false;
  return [
    "mode",
    "status",
    "title",
    "unitLabel",
    "countdownLabel",
    "countdownValue",
    "subtitle",
    "metrics",
    "leaderboard",
    "actions",
    "scoreBreakdown",
    "eliminationResult"
  ].some((key) => key in value);
}

function normalizePanelViewModel(viewModel = {}, fallbackMode = "elimination") {
  const normalizedMode = normalizeMode(viewModel.mode || fallbackMode);
  return {
    mode: normalizedMode,
    status: viewModel.status || (normalizedMode === "final_lockdown" ? "final" : "paused"),
    title: viewModel.title || (normalizedMode === "final_lockdown" ? "FINAL LOCKDOWN" : "OČISTA / PURGE OKNO"),
    unitLabel: viewModel.unitLabel || (normalizedMode === "final_lockdown" ? "PURGE-LOCK" : "PURGE-07"),
    countdownLabel: viewModel.countdownLabel || "Očista za",
    countdownValue: viewModel.countdownValue || "Data se načítají",
    subtitle: viewModel.subtitle || "Data se načítají",
    metrics: asArray(viewModel.metrics),
    leaderboardTitle: viewModel.leaderboardTitle || (normalizedMode === "final_lockdown" ? "Top 3" : "Poslední 3 hráči"),
    leaderboard: asArray(viewModel.leaderboard),
    actions: asArray(viewModel.actions),
    scoreTitle: viewModel.scoreTitle || "Rozpis score",
    scoreBreakdown: asArray(viewModel.scoreBreakdown),
    scoreTotal: viewModel.scoreTotal || "0",
    eliminationResult: viewModel.eliminationResult || null
  };
}

function resolvePanelViewModel(input = {}, fallbackMode = "elimination") {
  if (isPanelViewModel(input.viewModel)) return normalizePanelViewModel(input.viewModel, fallbackMode);
  const isInputEnvelope = Boolean(input && typeof input === "object" && (
    "viewModel" in input
    || "countdownRemainingMs" in input
    || "mockMode" in input
    || "viewMode" in input
  ));
  if (!isInputEnvelope && isPanelViewModel(input)) return normalizePanelViewModel(input, fallbackMode);
  return createMockEliminationAiPanelViewModel({
    mode: input.mode || input.mockMode || input.viewMode || fallbackMode,
    countdownRemainingMs: input.countdownRemainingMs
  });
}

function resolveReadModelPanelViewModel(playerView = null, mode = "elimination") {
  const normalizedMode = normalizeMode(mode);
  const source = normalizedMode === "final_lockdown" || normalizedMode === "final"
    ? playerView?.finalLockdown
    : playerView?.elimination;
  const candidate = source?.viewModel || source?.panelViewModel || source?.aiPanelViewModel || null;
  return isPanelViewModel(candidate) ? candidate : null;
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
        <strong class="elimination-ai-panel__countdown" aria-label="${escapeHtml(viewModel.countdownValue)}">${renderCountdownValue(viewModel.countdownValue)}</strong>
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

function normalizeEliminationResult(result = {}, fallbackEntry = {}) {
  const gangName = String(
    result.gangName
    || fallbackEntry.gangName
    || fallbackEntry.name
    || fallbackEntry.playerName
    || "neznámý gang"
  ).trim();
  return {
    ...result,
    ownerId: result.ownerId ?? fallbackEntry.ownerId ?? fallbackEntry.playerId ?? null,
    playerId: result.playerId ?? fallbackEntry.playerId ?? fallbackEntry.ownerId ?? null,
    gangName,
    avatarSrc: result.avatarSrc || fallbackEntry.avatarSrc || fallbackEntry.avatar || "",
    avatarFallback: result.avatarFallback || getInitials(gangName),
    score: result.score ?? fallbackEntry.score ?? "",
    controlledDistricts: result.controlledDistricts ?? fallbackEntry.controlledDistricts ?? null,
    districtsNeutralized: Number(result.districtsNeutralized ?? fallbackEntry.districtsNeutralized ?? 0) || null,
    remainingPlayers: result.remainingPlayers ?? result.activePlayersRemaining ?? fallbackEntry.remainingPlayers ?? fallbackEntry.activePlayersRemaining ?? null,
    serverCapacity: result.serverCapacity ?? result.maxPlayersPerServer ?? fallbackEntry.serverCapacity ?? fallbackEntry.maxPlayersPerServer ?? null,
    title: result.title || createEliminationResultTitle(gangName),
    body: result.body || createEliminationResultBody(gangName)
  };
}

function resolveEliminationResult(input = {}) {
  if (input.eliminationResult && typeof input.eliminationResult === "object") {
    return normalizeEliminationResult(input.eliminationResult);
  }
  const viewModel = resolvePanelViewModel(input, input.mode || input.mockMode || "elimination");
  if (viewModel.eliminationResult && typeof viewModel.eliminationResult === "object") {
    return normalizeEliminationResult(viewModel.eliminationResult);
  }
  const candidates = asArray(viewModel.leaderboard);
  const preparedBottomEntry = candidates[candidates.length - 1] || null;
  return normalizeEliminationResult({}, preparedBottomEntry || {});
}

function dispatchEliminationResolved(documentRef, result) {
  const CustomEventCtor = documentRef?.defaultView?.CustomEvent || globalThis.CustomEvent;
  if (typeof CustomEventCtor !== "function") {
    return false;
  }
  documentRef?.dispatchEvent?.(new CustomEventCtor("empire:elimination-resolved", {
    detail: result
  }));
  return true;
}

function resolveCountdownElapsed(input = {}, deps = {}, documentRef = null, cycleEndsAt = null) {
  const cycleKey = Number(cycleEndsAt);
  if (
    Number.isFinite(cycleKey)
    && sharedLastResolvedCountdownEndsAt === cycleKey
    && sharedLastEliminationResult
  ) {
    return sharedLastEliminationResult;
  }

  let result = deps.resolveEliminationResult?.(input) || resolveEliminationResult(input);
  const enrichedResult = deps.onCountdownElapsed?.(result, input);
  if (enrichedResult && typeof enrichedResult === "object") {
    result = { ...result, ...enrichedResult };
  }

  if (Number.isFinite(cycleKey)) {
    sharedLastResolvedCountdownEndsAt = cycleKey;
  }
  sharedLastEliminationResult = result;
  dispatchEliminationResolved(documentRef, result);
  return result;
}

export function renderEliminationResultPopupBody(result = {}) {
  const gangName = String(result.gangName || "neznámý gang").trim();
  const avatarSrc = String(result.avatarSrc || "").trim();
  const escapedAvatarSrc = escapeUrlAttribute(avatarSrc);
  const avatarFallback = String(result.avatarFallback || getInitials(gangName)).trim();
  const remainingPlayersLabel = formatRemainingPlayers(
    result.remainingPlayers ?? result.activePlayersRemaining,
    result.serverCapacity ?? result.maxPlayersPerServer
  );
  return `
    <article class="elimination-result-popup__notice" role="alert" aria-live="assertive">
      <button type="button" class="elimination-result-popup__avatar" data-elimination-result-popup-avatar aria-label="Zvětšit avatar vypadlého hráče">
        ${escapedAvatarSrc
          ? `<img src="${escapedAvatarSrc}" alt="">`
          : `<span>${escapeHtml(avatarFallback)}</span>`}
      </button>
      <div class="elimination-result-popup__copy">
        <div class="elimination-result-popup__copy-main">
          <strong>${renderResultTitle(result.title || createEliminationResultTitle(gangName), gangName)}</strong>
          <p>${escapeHtml(renderResultBody(result.body, gangName))}</p>
        </div>
      </div>
      <div class="elimination-result-popup__chips" aria-label="Výsledek očisty">
        <span class="elimination-result-popup__chip">
          <i aria-hidden="true">!</i>
          <span>Status:</span>
          <strong>Gang eliminován</strong>
        </span>
        <span class="elimination-result-popup__chip">
          <i aria-hidden="true">⌂</i>
          <span>Důsledek:</span>
          <strong>Území patří znovu městu</strong>
        </span>
        <span class="elimination-result-popup__chip">
          <i aria-hidden="true">#</i>
          <span>Zbývá hráčů:</span>
          <strong>${escapeHtml(remainingPlayersLabel)}</strong>
        </span>
      </div>
    </article>
  `;
}

function renderPanelContent(viewModel) {
  return [
    renderHero(viewModel),
    renderMetrics(viewModel.metrics),
    createSection(viewModel.leaderboardTitle, renderLeaderboard(viewModel.leaderboard), "leaderboard"),
    createSection(viewModel.scoreTitle, renderScoreBreakdown(viewModel), "score")
  ].join("");
}

export function renderEliminationPurgePanel(input = {}) {
  return renderPanelContent(resolvePanelViewModel(input, "elimination"));
}

export function renderEliminationAiPanel(viewModel = {}) {
  return renderEliminationPurgePanel(viewModel);
}

export function renderFinalLockdownPurgePanel(input = {}) {
  return renderPanelContent(resolvePanelViewModel(input, "final_lockdown"));
}

export function renderFinalLockdownAiPanel(viewModel = {}) {
  return renderFinalLockdownPurgePanel(viewModel);
}

export function renderEliminationPurgePanelBody(input = {}) {
  return renderPanelContent(resolvePanelViewModel(input, input.mode || input.mockMode || "elimination"));
}

export function renderEliminationAiPanelBody(viewModel = {}) {
  return renderEliminationPurgePanelBody(viewModel);
}

function setHeader(panel, input = {}) {
  const viewModel = resolvePanelViewModel(input, input.mode || input.mockMode || "elimination");
  const statusValue = normalizeStatus(viewModel.status);
  const status = panel.querySelector?.(PURGE_PANEL_STATUS_SELECTOR);
  if (status) {
    status.textContent = getStatusText(statusValue);
    status.dataset.state = statusValue;
  }
  return statusValue;
}

export function bindEliminationPurgePanel(root, deps = {}) {
  if (deps.resetCountdown) {
    resetSharedMockEliminationState();
  }
  const documentRef = deps.documentRef || root?.ownerDocument || (typeof document !== "undefined" ? document : null);
  const panel = root?.querySelector?.(PURGE_PANEL_SELECTOR) || documentRef?.querySelector?.(PURGE_PANEL_SELECTOR);
  if (!root || !panel) return false;
  const body = panel.querySelector?.(PURGE_PANEL_BODY_SELECTOR);
  const card = panel.querySelector?.(PURGE_PANEL_CARD_SELECTOR);
  const panelIsInsideRoot = typeof root.contains === "function" ? root.contains(panel) : true;
  const timerApi = deps.timerApi || (typeof window !== "undefined" ? window : globalThis);
  let lastTrigger = null;
  let countdownEndsAt = null;
  let refreshIntervalId = null;

  const createInput = (countdownRemainingMs) => {
    const mode = deps.getMockMode?.() || deps.mockMode || "elimination";
    const viewModel = deps.getViewModel?.();
    const readModelViewModel = resolveReadModelPanelViewModel(deps.getPlayerView?.(), mode);
    return {
      viewModel: isPanelViewModel(viewModel) ? viewModel : readModelViewModel,
      mode,
      countdownRemainingMs
    };
  };

  const handleCountdownElapsed = () => {
    return resolveCountdownElapsed(createInput(0), deps, documentRef, countdownEndsAt || sharedMockCountdownEndsAt);
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
    body.innerHTML = renderEliminationPurgePanelBody(input);
    return true;
  };

  const close = () => {
    documentRef?.body?.classList?.remove?.("elimination-ai-panel-open");
    closeOverlay(panel, { restoreFocus: false });
    panel.hidden = true;
    panel.classList?.remove?.("is-open");
    documentRef?.removeEventListener?.("keydown", handleKeydown);
    stopLiveCountdown();
    focusWithoutScroll(lastTrigger);
  };

  const open = (trigger = null) => {
    lastTrigger = trigger;
    countdownEndsAt = ensureSharedMockCountdownEndsAt(timerApi, deps.initialCountdownMs);
    render();
    panel.hidden = false;
    panel.classList?.add?.("is-open");
    openOverlay(panel, { type: "modal", ariaModal: true, focusTarget: card, restoreFocusOnClose: false });
    documentRef?.body?.classList?.add?.("elimination-ai-panel-open");
    documentRef?.addEventListener?.("keydown", handleKeydown);
    startLiveCountdown();
    focusWithoutScroll(card);
  };

  const showResult = (result = {}, trigger = null) => {
    if (trigger) {
      lastTrigger = trigger;
    }
    const resolvedResult = result && typeof result === "object" ? result : resolveEliminationResult(createInput(0));
    const now = getSafeNow(timerApi);
    const resetMs = getCountdownResetMs(deps.resetCountdownMs);
    countdownEndsAt = sharedMockCountdownEndsAt && sharedMockCountdownEndsAt > now
      ? sharedMockCountdownEndsAt
      : now + resetMs;
    sharedMockCountdownEndsAt = countdownEndsAt;
    render();
    return deps.openEliminationResultPopup?.(resolvedResult, trigger) ?? false;
  };

  function handleKeydown(event) {
    if (event.key === "Escape") {
      event.preventDefault?.();
      close();
    }
  }

  const handleClick = (event) => {
    const target = event.target;
    const openTarget = target?.closest?.(PURGE_PANEL_OPEN_SELECTOR);
    if (openTarget) {
      event.preventDefault?.();
      open(openTarget);
      return;
    }
    if (target?.closest?.(PURGE_PANEL_CLOSE_SELECTOR)) {
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
    showResult,
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

export function bindEliminationAiPanel(root, deps = {}) {
  return bindEliminationPurgePanel(root, deps);
}

export function bindEliminationResultPopup(root, deps = {}) {
  const documentRef = deps.documentRef || root?.ownerDocument || (typeof document !== "undefined" ? document : null);
  const popup = root?.querySelector?.(RESULT_POPUP_SELECTOR) || documentRef?.querySelector?.(RESULT_POPUP_SELECTOR);
  if (!root || !popup) return false;
  const body = popup.querySelector?.(RESULT_POPUP_BODY_SELECTOR);
  const card = popup.querySelector?.(RESULT_POPUP_CARD_SELECTOR);
  const popupIsInsideRoot = typeof root.contains === "function" ? root.contains(popup) : true;
  let lastTrigger = null;

  const render = (result = {}) => {
    if (!body) return false;
    const customMarkup = deps.renderBody?.(result);
    body.innerHTML = typeof customMarkup === "string" && customMarkup
      ? customMarkup
      : renderEliminationResultPopupBody(result);
    return true;
  };

  const close = () => {
    documentRef?.body?.classList?.remove?.("elimination-result-popup-open");
    closeOverlay(popup, { restoreFocus: false });
    popup.hidden = true;
    popup.classList?.remove?.("is-open");
    card?.classList?.remove?.("is-avatar-expanded");
    documentRef?.removeEventListener?.("keydown", handleKeydown);
    focusWithoutScroll(lastTrigger);
    deps.onClose?.();
  };

  const open = (result = {}, trigger = null) => {
    lastTrigger = trigger;
    render(result);
    popup.hidden = false;
    popup.classList?.add?.("is-open");
    openOverlay(popup, { type: "modal", ariaModal: true, focusTarget: card, restoreFocusOnClose: false });
    documentRef?.body?.classList?.add?.("elimination-result-popup-open");
    documentRef?.addEventListener?.("keydown", handleKeydown);
    focusWithoutScroll(card);
    return true;
  };

  function handleKeydown(event) {
    if (event.key === "Escape") {
      event.preventDefault?.();
      if (card?.classList?.contains?.("is-avatar-expanded")) {
        card.classList.remove("is-avatar-expanded");
        return;
      }
      close();
    }
  }

  const handleClick = (event) => {
    if (event.target?.closest?.(RESULT_POPUP_AVATAR_SELECTOR)) {
      event.preventDefault?.();
      card?.classList?.toggle?.("is-avatar-expanded");
      return;
    }
    if (event.target?.closest?.(RESULT_POPUP_CLOSE_SELECTOR)) {
      event.preventDefault?.();
      close();
    }
  };

  root.addEventListener?.("click", handleClick);
  if (!popupIsInsideRoot) {
    popup.addEventListener?.("click", handleClick);
  }

  return {
    close,
    open,
    render,
    destroy() {
      root.removeEventListener?.("click", handleClick);
      if (!popupIsInsideRoot) {
        popup.removeEventListener?.("click", handleClick);
      }
      documentRef?.removeEventListener?.("keydown", handleKeydown);
    }
  };
}

export function bindEliminationCountdownWarning(root, deps = {}) {
  if (deps.resetCountdown) {
    resetSharedMockEliminationState();
  }
  const documentRef = deps.documentRef || root?.ownerDocument || (typeof document !== "undefined" ? document : null);
  const warning = root?.querySelector?.(COUNTDOWN_WARNING_SELECTOR) || documentRef?.querySelector?.(COUNTDOWN_WARNING_SELECTOR);
  if (!root || !warning) return false;
  const timerApi = deps.timerApi || (typeof window !== "undefined" ? window : globalThis);
  const timeNode = warning.querySelector?.(COUNTDOWN_WARNING_TIME_SELECTOR);
  const closeButton = warning.querySelector?.(COUNTDOWN_WARNING_CLOSE_SELECTOR);
  let intervalId = null;
  let dismissedCountdownEndsAt = null;
  let dismissedDuringFinalMinute = false;

  const createInput = (countdownRemainingMs) => {
    const mode = deps.getMockMode?.() || deps.mockMode || "elimination";
    const viewModel = deps.getViewModel?.();
    const readModelViewModel = resolveReadModelPanelViewModel(deps.getPlayerView?.(), mode);
    return {
      viewModel: isPanelViewModel(viewModel) ? viewModel : readModelViewModel,
      mode,
      countdownRemainingMs
    };
  };

  const getWarningCountdownRemainingMs = () => {
    const now = getSafeNow(timerApi);
    const endsAt = ensureSharedMockCountdownEndsAt(timerApi, deps.initialCountdownMs);
    const remainingMs = endsAt - now;
    if (remainingMs > 0) return remainingMs;

    resolveCountdownElapsed(createInput(0), deps, documentRef, endsAt);
    const resetMs = getCountdownResetMs(deps.resetCountdownMs);
    sharedMockCountdownEndsAt = now + resetMs;
    return resetMs;
  };

  const render = () => {
    const remainingMs = getWarningCountdownRemainingMs();
    const shouldShow = remainingMs > 0 && remainingMs <= COUNTDOWN_WARNING_THRESHOLD_MS;
    if (dismissedCountdownEndsAt !== sharedMockCountdownEndsAt) {
      dismissedCountdownEndsAt = null;
      dismissedDuringFinalMinute = false;
    }
    const shouldReopenDismissedWarning = dismissedCountdownEndsAt
      && !dismissedDuringFinalMinute
      && remainingMs <= COUNTDOWN_WARNING_REOPEN_THRESHOLD_MS;
    if (shouldReopenDismissedWarning) {
      dismissedCountdownEndsAt = null;
      dismissedDuringFinalMinute = false;
    }
    const isDismissed = dismissedCountdownEndsAt === sharedMockCountdownEndsAt;
    const isVisible = shouldShow && !isDismissed;
    warning.hidden = !isVisible;
    warning.classList?.toggle?.("is-visible", isVisible);
    if (timeNode) {
      timeNode.textContent = formatCountdown(remainingMs);
    }
    if (remainingMs <= 0 && intervalId && typeof timerApi?.clearInterval === "function") {
      timerApi.clearInterval(intervalId);
      intervalId = null;
    }
    return isVisible;
  };

  const closeWarning = () => {
    const remainingMs = getWarningCountdownRemainingMs();
    dismissedCountdownEndsAt = sharedMockCountdownEndsAt;
    dismissedDuringFinalMinute = remainingMs <= COUNTDOWN_WARNING_REOPEN_THRESHOLD_MS;
    warning.hidden = true;
    warning.classList?.toggle?.("is-visible", false);
  };

  const handleCloseClick = (event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    closeWarning();
  };

  ensureSharedMockCountdownEndsAt(timerApi, deps.initialCountdownMs);
  render();
  if (typeof timerApi?.setInterval === "function") {
    intervalId = timerApi.setInterval(render, 1000);
  }
  closeButton?.addEventListener?.("click", handleCloseClick);

  return {
    close: closeWarning,
    render,
    destroy() {
      closeButton?.removeEventListener?.("click", handleCloseClick);
      if (intervalId && typeof timerApi?.clearInterval === "function") {
        timerApi.clearInterval(intervalId);
      }
      intervalId = null;
    }
  };
}
