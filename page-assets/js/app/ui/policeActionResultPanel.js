import { renderActionResultRows } from "./resultModalPanel.js";

const POLICE_ACTION_RESULT_TONE_CLASSES = Object.freeze([
  "is-tier-1",
  "is-tier-2",
  "is-tier-3",
  "is-tier-4",
  "is-tier-5",
  "is-tier-6",
  "is-specialty-financial",
  "is-specialty-drug",
  "is-specialty-weapons",
  "is-specialty-arrests",
  "is-specialty-total",
  "is-district-raid-warning",
  "is-district-attack-warning",
  "is-owned-district-raid-alert"
]);

function query(root, selector) {
  if (!root || !selector || typeof root.querySelector !== "function") {
    return null;
  }
  return root.querySelector(selector);
}

function getCityEventRows(payload = {}, remainingMs = 0, formatDuration = (value) => `${value}ms`) {
  return [
    { label: "Stav", value: remainingMs > 0 ? "Probíhá" : "Doběhnuto" },
    { label: "Úkol", value: String(payload.taskTitle || payload.title || "City Event") },
    { label: "Zbývá", value: remainingMs > 0 ? formatDuration(remainingMs) : "0s", nowrap: true },
    { label: "Úspěšnost", value: `${Math.max(0, Math.min(100, Math.floor(Number(payload.successRate || 0))))}%` },
    { label: "Možný zisk", value: Array.isArray(payload.gains) && payload.gains.length ? payload.gains.join(", ") : "Bez garantované odměny" },
    { label: "Riziko", value: String(payload.risk || "Nízké") }
  ];
}

function updateLiveCityEventRows(details, remainingMs = 0, formatDuration = (value) => `${value}ms`) {
  const values = details?.querySelectorAll?.(".modal__row strong") || [];
  if (values[0]) values[0].textContent = remainingMs > 0 ? "Probíhá" : "Doběhnuto";
  if (values[2]) values[2].textContent = remainingMs > 0 ? formatDuration(remainingMs) : "0s";
}

export function renderPoliceActionResultPanel(root, payload = {}, options = {}) {
  const selectors = options.selectors || {};
  const elements = {
    modal: query(root, selectors.modal),
    content: query(root, selectors.content),
    title: query(root, selectors.title),
    badge: query(root, selectors.badge),
    summary: query(root, selectors.summary),
    details: query(root, selectors.details)
  };

  if (!elements.modal || !elements.content || !elements.title || !elements.badge || !elements.summary || !elements.details) {
    return { ok: false, ...elements };
  }

  const formatDuration = typeof options.formatDurationLabel === "function"
    ? options.formatDurationLabel
    : (value) => `${value}ms`;
  let cityEventRowsRendered = false;

  elements.content.classList.remove(...(options.toneClasses || POLICE_ACTION_RESULT_TONE_CLASSES));
  for (const token of String(payload.tone || "").split(/\s+/).map((entry) => entry.trim()).filter(Boolean)) {
    elements.content.classList.add(token);
  }

  elements.title.textContent = payload.title || "Policejní akce";
  elements.badge.textContent = payload.badge || "Policejní zásah";
  elements.summary.textContent = payload.summary || "";

  const renderRows = () => {
    const isCityEvent = String(payload.liveRowsKind || "") === "city_event";
    const remainingMs = isCityEvent ? Math.max(0, Number(payload.endsAt || 0) - Date.now()) : null;
    if (remainingMs !== null && cityEventRowsRendered) {
      updateLiveCityEventRows(elements.details, remainingMs, formatDuration);
      return;
    }

    const resolvedRows = remainingMs === null
      ? (typeof payload.getRows === "function" ? payload.getRows() : (payload.rows || []))
      : getCityEventRows(payload, remainingMs, formatDuration);
    const renderImpactDetails = options.renderPoliceRaidImpactDetails;
    if (typeof renderImpactDetails !== "function" || !renderImpactDetails(elements.details, payload, resolvedRows)) {
      renderActionResultRows(elements.details, resolvedRows);
    }
    cityEventRowsRendered = remainingMs !== null;
  };

  renderRows();
  elements.modal.classList.remove("hidden");
  return {
    ok: true,
    ...elements,
    renderRows,
    hasLiveRows: typeof payload.getRows === "function" || String(payload.liveRowsKind || "") === "city_event"
  };
}
