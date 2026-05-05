import {
  FACTION_ADVANTAGES_SELECTOR,
  FACTION_CLEAN_MONEY_SELECTOR,
  FACTION_DESCRIPTION_SELECTOR,
  FACTION_DISADVANTAGES_SELECTOR,
  FACTION_DIRTY_MONEY_SELECTOR,
  FACTION_HEAT_SELECTOR,
  FACTION_INFLUENCE_SELECTOR,
  FACTION_NAME_SELECTOR,
  FACTION_TAGLINE_SELECTOR
} from "../runtime/constants.js";

function safeQuery(root, selector) {
  if (!root || typeof root.querySelector !== "function") {
    return null;
  }
  try {
    return root.querySelector(selector);
  } catch {
    return null;
  }
}

function setText(element, value) {
  if (element) {
    element.textContent = String(value ?? "");
  }
}

export function replaceListItems(listElement, values = []) {
  if (!listElement || typeof listElement.replaceChildren !== "function") {
    return false;
  }

  const safeValues = Array.isArray(values) ? values : [];
  const items = safeValues
    .map((value) => {
      const item = globalThis.document?.createElement?.("li");
      if (item) {
        item.textContent = String(value ?? "");
      }
      return item;
    })
    .filter(Boolean);
  listElement.replaceChildren(...items);
  return true;
}

export function renderFactionPreviewPanel(root, faction = {}, options = {}) {
  const formatCurrency = typeof options.formatCurrency === "function"
    ? options.formatCurrency
    : (value) => `$${Math.max(0, Math.round(Number(value || 0))).toLocaleString("cs-CZ")}`;
  const startingPackage = faction?.startingPackage || {};
  const cleanMoneyLabel = faction?.cleanMoneyLabel ?? formatCurrency(startingPackage.cleanMoney);
  const dirtyMoneyLabel = faction?.dirtyMoneyLabel ?? formatCurrency(startingPackage.dirtyMoney);
  const influenceLabel = faction?.influenceLabel ?? startingPackage.influence;
  const heatLabel = faction?.heatLabel ?? startingPackage.heat;

  setText(safeQuery(root, FACTION_NAME_SELECTOR), faction?.name);
  setText(safeQuery(root, FACTION_TAGLINE_SELECTOR), faction?.tagline);
  setText(safeQuery(root, FACTION_DESCRIPTION_SELECTOR), faction?.description);
  setText(safeQuery(root, FACTION_CLEAN_MONEY_SELECTOR), cleanMoneyLabel);
  setText(safeQuery(root, FACTION_DIRTY_MONEY_SELECTOR), dirtyMoneyLabel);
  setText(safeQuery(root, FACTION_INFLUENCE_SELECTOR), influenceLabel);
  setText(safeQuery(root, FACTION_HEAT_SELECTOR), heatLabel);
  replaceListItems(safeQuery(root, FACTION_ADVANTAGES_SELECTOR), faction?.advantages);
  replaceListItems(safeQuery(root, FACTION_DISADVANTAGES_SELECTOR), faction?.disadvantages);
  return true;
}

export function renderAuthStatus(statusMount, title, note) {
  if (!statusMount || typeof statusMount.replaceChildren !== "function") {
    return false;
  }

  const label = globalThis.document?.createElement?.("span");
  const titleElement = globalThis.document?.createElement?.("h3");
  const noteElement = globalThis.document?.createElement?.("p");
  if (!label || !titleElement || !noteElement) {
    return false;
  }

  label.className = "placeholder-label";
  label.textContent = "Registrace";
  titleElement.className = "placeholder-title";
  titleElement.textContent = String(title ?? "");
  noteElement.className = "panel-note";
  noteElement.textContent = String(note ?? "");
  statusMount.replaceChildren(label, titleElement, noteElement);
  return true;
}

if (typeof window !== "undefined") {
  window.EmpireAuthPanel = {
    replaceListItems,
    renderAuthStatus,
    renderFactionPreviewPanel
  };
}
