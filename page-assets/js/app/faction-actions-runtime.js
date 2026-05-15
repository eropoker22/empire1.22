import { STORAGE_KEYS } from "../config.js";
import { FACTION_CATALOG } from "../../../packages/game-config/src/legacy-page/faction-config.js";

const PAGE_SELECTOR = "[data-client-surface='game-shell']";
const DEFAULT_FACTION_ID = "mafian";

const PREVIEW_BY_FACTION_ID = Object.freeze({
  mafian: "Pasivně drží čisté peníze a lepší práci s heatem. Aktivní schopnost zatím není core-backed.",
  kartel: "Pasivně tlačí dirty cash a ilegální produkci. Aktivní schopnost zatím není core-backed.",
  kult: "Pasivně zvedá influence a obranu districtů. Aktivní schopnost zatím není core-backed.",
  "tajna-organizace": "Pasivně zlepšuje špehování a snižuje heat. Aktivní schopnost zatím není core-backed.",
  hackeri: "Pasivně posilují tech produkci a intel. Aktivní schopnost zatím není core-backed.",
  "motorkarsky-gang": "Pasivně zrychluje útoky a drží dirty tempo. Aktivní schopnost zatím není core-backed.",
  "soukroma-armada": "Pasivně posiluje útok a obranu. Aktivní schopnost zatím není core-backed.",
  korporace: "Pasivně posiluje clean economy a finance. Aktivní schopnost zatím není core-backed."
});

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeFactionId(value) {
  return String(value || "").trim().toLowerCase();
}

export function getCurrentPlayerFactionId(storage = globalThis.window?.localStorage) {
  try {
    const session = JSON.parse(storage?.getItem?.(STORAGE_KEYS.session) || "null");
    const registration = session?.registration || {};
    const factionId = normalizeFactionId(registration.selectedFaction || registration.factionId);
    return FACTION_CATALOG[factionId] ? factionId : DEFAULT_FACTION_ID;
  } catch {
    return DEFAULT_FACTION_ID;
  }
}

export function getFactionActionForPlayer(storage) {
  const factionId = getCurrentPlayerFactionId(storage);
  const faction = FACTION_CATALOG[factionId] || FACTION_CATALOG[DEFAULT_FACTION_ID];
  return {
    factionId,
    name: faction.name,
    code: "Passive foundation",
    effect: PREVIEW_BY_FACTION_ID[factionId] || PREVIEW_BY_FACTION_ID[DEFAULT_FACTION_ID],
    cost: "Žádná aktivní schopnost"
  };
}

function renderFactionActions(grid, action = getFactionActionForPlayer()) {
  grid.innerHTML = `
    <div class="faction-action-launch faction-action-launch--preview">
      <p class="faction-action-launch-description">
        ${escapeHtml(action.effect)}
      </p>
      <div class="faction-action-launch-meta">
        <span>${escapeHtml(action.code)}</span>
        <strong>${escapeHtml(action.cost)}</strong>
      </div>
    </div>
  `;
}

function initFactionActionsRuntime() {
  const root = document.querySelector(PAGE_SELECTOR);
  if (!root) return;

  const modal = document.getElementById("faction-actions-modal");
  const backdrop = document.getElementById("faction-actions-modal-backdrop");
  const closeBtn = document.getElementById("faction-actions-modal-close");
  const grid = document.getElementById("faction-actions-modal-grid");
  const status = document.getElementById("faction-actions-modal-status");
  const openButtons = Array.from(document.querySelectorAll("[data-faction-actions-open-trigger]"));

  if (!modal || !grid || openButtons.length <= 0) return;

  const open = () => {
    const playerAction = getFactionActionForPlayer();
    renderFactionActions(grid, playerAction);
    if (status) {
      status.textContent = `${playerAction.name}: pasivní frakční efekty jsou aktivní.`;
    }
    modal.classList.remove("hidden");
  };

  const close = () => modal.classList.add("hidden");

  openButtons.forEach((button) => button.addEventListener("click", open));
  backdrop?.addEventListener("click", close);
  closeBtn?.addEventListener("click", close);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.classList.contains("hidden")) close();
  });
}

if (typeof document !== "undefined") {
  initFactionActionsRuntime();
}
