import {
  activateActionResultCountdownRows,
  getActionResultCountdownUntil,
  formatActionResultCountdownLabel
} from "./resultModalPanel.js";

function resolveDocument(container) {
  // Preview-only legacy panel helper. Authoritative building action reports come from the server slice.
  return container?.ownerDocument || (typeof document !== "undefined" ? document : null);
}

function createElement(documentRef, tagName, className = "") {
  if (!documentRef || typeof documentRef.createElement !== "function") {
    return null;
  }

  const element = documentRef.createElement(tagName);
  if (className) {
    element.className = className;
  }
  return element;
}

function resolveResultTone(result = {}) {
  const status = String(result.status || result.outcome || "").trim().toLowerCase();
  const tone = String(result.tone || "").trim().toLowerCase();

  if (result.ok === false || status === "fail" || status === "failed" || status === "failure" || tone.includes("fail") || tone.includes("error")) {
    return "error";
  }

  if (result.ok === true || status === "success" || status === "ok" || tone.includes("success") || tone.includes("positive")) {
    return "success";
  }

  if (tone === "warning") {
    return "warning";
  }

  return "event";
}

function resolveResultTheme(tone) {
  if (tone === "success") return "positive";
  if (tone === "error" || tone === "warning") return "negative";
  return "neutral";
}

function resolveContainer(result = {}, options = {}) {
  if (options.container) {
    return options.container;
  }

  const root = options.root || result.root || null;
  const selector = options.selector || result.selector || "";
  if (!root || !selector || typeof root.querySelector !== "function") {
    return null;
  }

  try {
    return root.querySelector(selector);
  } catch {
    return null;
  }
}

function notifyMissingContainer(result, options = {}) {
  if (typeof options.onMissingContainer === "function") {
    options.onMissingContainer({ result, options });
  }
}

export function cloneBuildingActionResultPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  return {
    ...payload,
    rows: Array.isArray(payload.rows)
      ? payload.rows.map((row) => ({ ...row }))
      : payload.rows,
    items: Array.isArray(payload.items)
      ? payload.items.map((row) => ({ ...row }))
      : payload.items
  };
}

export function normalizeBuildingActionResult(result = {}) {
  const tone = resolveResultTone(result);
  const isSuccess = tone === "success";
  const isFailure = tone === "error";
  const title = String(result.title || (isSuccess ? "Akce proběhla" : isFailure ? "Akce selhala" : "Výsledek akce")).trim();
  const summary = String(result.summary || result.message || (isSuccess ? "Akce byla dokončena." : isFailure ? "Akci se nepodařilo dokončit." : "Bez detailu.")).trim();

  return {
    tone,
    theme: resolveResultTheme(tone),
    title,
    summary,
    badge: String(result.badge || (isSuccess ? "Úspěch" : isFailure ? "Selhání" : "Akce")).trim(),
    meta: String(result.meta || "").trim(),
    rows: Array.isArray(result.rows)
      ? result.rows.filter((row) => row && row.label != null && row.value != null)
      : (Array.isArray(result.items) ? result.items.filter((row) => row && row.label != null && row.value != null) : [])
  };
}

export function renderBuildingActionResult(result = {}, options = {}) {
  const container = resolveContainer(result, options);
  if (!container || typeof container.replaceChildren !== "function") {
    notifyMissingContainer(result, options);
    return false;
  }

  const documentRef = resolveDocument(container);
  const normalized = normalizeBuildingActionResult(result);
  const item = createElement(
    documentRef,
    "article",
    `building-action-status__item building-action-status__item--${normalized.tone} building-action-status__item--${normalized.theme}`
  );
  const head = createElement(documentRef, "div", "building-action-status__item-head");
  const title = createElement(documentRef, "strong", "building-action-status__item-title");
  const badge = createElement(documentRef, "span", "building-action-status__item-meta");
  const summary = createElement(documentRef, "p", "building-action-status__item-summary");

  if (!item || !head || !title || !badge || !summary) {
    return false;
  }

  title.textContent = normalized.title;
  badge.textContent = normalized.badge;
  summary.textContent = normalized.summary;
  head.append(title, badge);
  item.append(head, summary);

  if (normalized.meta) {
    const meta = createElement(documentRef, "p", "building-action-status__item-meta");
    if (meta) {
      meta.textContent = normalized.meta;
      item.append(meta);
    }
  }

  if (normalized.rows.length > 0) {
    const rows = createElement(documentRef, "div", "modal__details");
    if (rows) {
      for (const rowView of normalized.rows) {
        const row = createElement(documentRef, "div", "modal__row");
        const label = createElement(documentRef, "span");
        const value = createElement(documentRef, "strong", rowView.nowrap ? "modal__nowrap-value" : "");
        if (!row || !label || !value) {
          continue;
        }
        const countdownUntil = getActionResultCountdownUntil(rowView);
        label.textContent = String(rowView.label);
        value.textContent = countdownUntil
          ? formatActionResultCountdownLabel(Math.max(0, countdownUntil - Date.now()))
          : String(rowView.value);
        if (countdownUntil) {
          value.setAttribute("data-action-result-countdown-until", String(countdownUntil));
          value.setAttribute("data-action-result-countdown-done", String(rowView.countdownDoneLabel || "0s"));
        }
        row.append(label, value);
        rows.append(row);
      }
      item.append(rows);
    }
  }

  container.replaceChildren(item);
  activateActionResultCountdownRows(container);
  return true;
}
