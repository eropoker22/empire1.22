import { escapeAttribute, escapeHtml, escapeUrlAttribute } from "./htmlEscape.js";
import { openOverlay } from "./legacyOverlayCoordinator.js";

export { escapeAttribute, escapeUrlAttribute };

export function escapeModalHtml(value) {
  return escapeHtml(value);
}

export function safeResultModalQuery(root, selector) {
  if (!root || typeof root.querySelector !== "function") {
    return null;
  }

  try {
    return root.querySelector(selector);
  } catch {
    return null;
  }
}

function warnMissingResultModal(root, payload, missingKeys, options = {}) {
  const message = `Result modal is missing required elements: ${missingKeys.join(", ")}`;

  if (typeof options.onMissingContainer === "function") {
    options.onMissingContainer({ root, payload, missingKeys, message });
    return;
  }

  const logger = options.console || (typeof console !== "undefined" ? console : null);
  if (logger && typeof logger.warn === "function") {
    logger.warn(message);
  }
}

function applyResultModalTone(content, tone, toneClasses = [], fallbackTone = "") {
  if (toneClasses.length > 0) {
    content.classList.remove(...toneClasses);
  }

  for (const token of String(tone || fallbackTone || "").split(/\s+/).map((entry) => entry.trim()).filter(Boolean)) {
    content.classList.add(token);
  }
}

const ACTION_RESULT_COUNTDOWN_SELECTOR = "[data-action-result-countdown-until]";

export function formatActionResultCountdownLabel(remainingMs) {
  const totalSeconds = Math.max(0, Math.ceil(Number(remainingMs || 0) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const secondLabel = String(seconds).padStart(2, "0");

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}:${secondLabel}`;
  }

  if (minutes > 0) {
    return `${minutes}:${secondLabel}`;
  }

  return `${seconds}s`;
}

export function getActionResultCountdownUntil(row = {}) {
  const rawValue = row.countdownUntil ?? row.countdownUntilMs ?? row.endsAt ?? row.expiresAt ?? "";
  const numericValue = Number(rawValue);
  if (Number.isFinite(numericValue) && numericValue > 0) {
    return numericValue;
  }

  const parsedValue = Date.parse(String(rawValue || ""));
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : 0;
}

function getActionResultCountdownValue(row = {}, nowMs = Date.now()) {
  const countdownUntil = getActionResultCountdownUntil(row);
  if (!countdownUntil) {
    return String(row.value ?? "");
  }

  const remainingMs = Math.max(0, countdownUntil - nowMs);
  if (remainingMs <= 0 && row.countdownDoneLabel) {
    return String(row.countdownDoneLabel);
  }

  return formatActionResultCountdownLabel(remainingMs);
}

export function activateActionResultCountdownRows(container, options = {}) {
  if (!container || typeof container.querySelectorAll !== "function") {
    return false;
  }

  if (container.__empireActionResultCountdownTimer) {
    const clearTimer = options.clearInterval || globalThis.clearInterval;
    clearTimer?.(container.__empireActionResultCountdownTimer);
    container.__empireActionResultCountdownTimer = null;
  }

  const rows = Array.from(container.querySelectorAll(ACTION_RESULT_COUNTDOWN_SELECTOR));
  if (rows.length <= 0) {
    return false;
  }

  const updateRows = () => {
    let hasActiveCountdown = false;
    for (const row of rows) {
      const countdownUntil = Number(row.getAttribute?.("data-action-result-countdown-until") || 0);
      if (!Number.isFinite(countdownUntil) || countdownUntil <= 0) {
        continue;
      }

      const remainingMs = Math.max(0, countdownUntil - Date.now());
      row.textContent = remainingMs > 0
        ? formatActionResultCountdownLabel(remainingMs)
        : (row.getAttribute?.("data-action-result-countdown-done") || "0s");
      hasActiveCountdown = hasActiveCountdown || remainingMs > 0;
    }
    return hasActiveCountdown;
  };

  const hasActiveCountdown = updateRows();
  if (!hasActiveCountdown) {
    return true;
  }

  const setTimer = options.setInterval || globalThis.setInterval;
  const clearTimer = options.clearInterval || globalThis.clearInterval;
  if (typeof setTimer !== "function" || typeof clearTimer !== "function") {
    return true;
  }

  container.__empireActionResultCountdownTimer = setTimer(() => {
    if (container.isConnected === false) {
      clearTimer(container.__empireActionResultCountdownTimer);
      container.__empireActionResultCountdownTimer = null;
      return;
    }

    if (!updateRows()) {
      clearTimer(container.__empireActionResultCountdownTimer);
      container.__empireActionResultCountdownTimer = null;
    }
  }, 1000);

  return true;
}

export function renderActionResultRows(container, rows = [], options = {}) {
  if (!container) {
    return;
  }

  const visibleRows = rows.filter((row) => row && row.label != null && row.value != null);
  if (container.classList) {
    if (visibleRows.length === 3) {
      container.classList.add("modal__details--compact-trio");
    } else {
      container.classList.remove("modal__details--compact-trio");
    }
  }

  container.innerHTML = visibleRows
    .map((row) => {
      const countdownUntil = getActionResultCountdownUntil(row);
      const countdownAttributes = countdownUntil
        ? ` data-action-result-countdown-until="${escapeAttribute(countdownUntil)}" data-action-result-countdown-done="${escapeAttribute(row.countdownDoneLabel || "0s")}"`
        : "";
      return `
        <div class="modal__row${row.fullWidth ? " modal__row--full-width" : ""}">
          <span>${escapeModalHtml(row.label)}</span>
          <strong class="${row.nowrap ? "modal__nowrap-value" : ""}"${countdownAttributes}>${escapeModalHtml(getActionResultCountdownValue(row))}</strong>
        </div>
      `;
    })
    .join("");
  activateActionResultCountdownRows(container, options);
}

export function renderSimpleResultModal(root, payload = {}, config = {}, options = {}) {
  const elements = {
    modal: safeResultModalQuery(root, config.modalSelector),
    content: safeResultModalQuery(root, config.contentSelector),
    title: safeResultModalQuery(root, config.titleSelector),
    summary: safeResultModalQuery(root, config.summarySelector),
    details: safeResultModalQuery(root, config.detailsSelector)
  };

  if (config.badgeSelector) {
    elements.badge = safeResultModalQuery(root, config.badgeSelector);
  }

  const missingKeys = Object.entries(elements)
    .filter(([, element]) => !element)
    .map(([key]) => key);

  if (missingKeys.length > 0) {
    warnMissingResultModal(root, payload, missingKeys, options);
    return false;
  }

  applyResultModalTone(elements.content, payload.tone, config.toneClasses || [], config.fallbackTone || "");
  elements.title.textContent = payload.title || config.defaultTitle || "";
  elements.summary.textContent = payload.summary || "";
  if (elements.badge) {
    elements.badge.textContent = payload.badge || config.defaultBadge || "";
  }
  renderActionResultRows(elements.details, payload.rows || [], {
    setInterval: options.setInterval,
    clearInterval: options.clearInterval
  });
  elements.modal.classList.remove("hidden");
  elements.modal.removeAttribute("aria-hidden");
  openOverlay(elements.modal, { type: "modal", ariaModal: true });
  return true;
}
