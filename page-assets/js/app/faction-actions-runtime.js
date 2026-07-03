import { STORAGE_KEYS } from "../config.js";
import { FACTION_CATALOG } from "../../../packages/game-config/src/legacy-page/faction-config.js";
import { closeOverlay, openOverlay } from "./ui/legacyOverlayCoordinator.js";

const PAGE_SELECTOR = "[data-client-surface='game-shell']";
const DEFAULT_FACTION_ID = "mafian";

const PREVIEW_BY_FACTION_ID = Object.freeze({
  mafian: "Pasivně drží čisté peníze a lepší práci s heatem. Speciální akce je zatím jen preview.",
  kartel: "Pasivně tlačí dirty cash, ilegální produkci a pašování, ale zvedá heat z ilegálních akcí. Noční zásilka je preview: zatím není core-backed.",
  kult: "Pasivně zvedá influence, růst populace a obranu, ale oslabuje clean economy a přímý útok. Masová posedlost je preview: zatím není core-backed.",
  "tajna-organizace": "Pasivně zlepšuje špehování, trap detection a intel mind-games. Spící buňka je preview: zatím není core-backed.",
  hackeri: "Pasivně posilují potvrzenost drbů, kamery, alarmy, tech produkci a spying. Výpadek systému je preview: zatím není core-backed.",
  "motorkarsky-gang": "Pasivně zkracuje cooldowny na vykrádání, útoky a obsazování. Bleskový nájezd je preview: zatím není core-backed.",
  "soukroma-armada": "Pasivně posiluje útok, obranu a snižuje bojové ztráty vybavení. Taktické nasazení je preview: zatím není core-backed.",
  korporace: "Pasivně posiluje clean economy, snižuje heat a zlepšuje obranné systémy. Právní štít je preview: zatím není core-backed."
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
  const specialAction = faction.specialAction || null;
  const effect = specialAction
    ? `${specialAction.description} ${specialAction.status === "implemented" ? "Schopnost je implementovaná." : "Preview: zatím není core-backed."}`
    : PREVIEW_BY_FACTION_ID[factionId] || PREVIEW_BY_FACTION_ID[DEFAULT_FACTION_ID];
  return {
    factionId,
    name: faction.name,
    code: specialAction?.name || "Passive foundation",
    effect,
    cost: specialAction?.status === "implemented" ? "Dostupné" : "Preview pouze",
    canRun: specialAction?.status === "implemented"
  };
}

function renderFactionActions(grid, action = getFactionActionForPlayer()) {
  grid.innerHTML = `
    <div class="faction-action-launch faction-action-launch--preview">
      <button
        class="faction-action-launch-button"
        type="button"
        data-faction-action-run
        ${action.canRun ? "" : "disabled"}
        aria-disabled="${action.canRun ? "false" : "true"}"
      >
        ${action.canRun ? "Aktivovat schopnost" : "Plánovaná schopnost"}
      </button>
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
    grid.querySelector("[data-faction-action-run]")?.addEventListener("click", () => {
      if (status) {
        status.textContent = playerAction.canRun
          ? `${playerAction.code}: akce je připravená.`
          : `${playerAction.code}: zatím preview, core spuštění ještě není implementované.`;
      }
    });
    if (status) {
      status.textContent = `${playerAction.name}: pasivní frakční efekty jsou aktivní.`;
    }
    modal.hidden = false;
    modal.classList.remove("hidden");
    openOverlay(modal, { type: "modal", ariaModal: true, restoreFocusOnClose: false });
  };

  const close = () => {
    closeOverlay(modal, { restoreFocus: false });
    modal.classList.add("hidden");
    modal.hidden = true;
  };

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
