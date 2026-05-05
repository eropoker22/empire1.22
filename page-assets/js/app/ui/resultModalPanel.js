export function escapeModalHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
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

export function renderActionResultRows(container, rows = []) {
  if (!container) {
    return;
  }

  container.innerHTML = rows
    .filter((row) => row && row.label != null && row.value != null)
    .map((row) => `
      <div class="modal__row">
        <span>${escapeModalHtml(row.label)}</span>
        <strong class="${row.nowrap ? "modal__nowrap-value" : ""}">${escapeModalHtml(row.value)}</strong>
      </div>
    `)
    .join("");
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
  renderActionResultRows(elements.details, payload.rows || []);
  elements.modal.classList.remove("hidden");
  return true;
}
