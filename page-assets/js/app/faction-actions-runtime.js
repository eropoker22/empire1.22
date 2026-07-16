import { STORAGE_KEYS } from "../config.js";
import { FACTION_CATALOG } from "../../../packages/game-config/src/legacy-page/faction-config.js";
import { closeOverlay, openOverlay } from "./ui/legacyOverlayCoordinator.js";
import { GAMEPLAY_EXECUTION_MODES, getGameplayExecutionMode } from "./runtime/gameplayExecutionMode.js";

const PAGE_SELECTOR = "[data-client-surface='game-shell']";
const DEFAULT_FACTION_ID = "mafian";

const PREVIEW_BY_FACTION_ID = Object.freeze({
  mafian: "Frakce už má aktivní pasivy. Speciální schopnost se připravuje pro další fázi hry.",
  kartel: "Frakce už má aktivní pasivy pro dirty cash, podporovanou ilegální produkci a pašování. Speciální schopnost přijde později.",
  kult: "Frakce už má aktivní pasivy pro influence, populaci a obranu. Masová posedlost se připravuje pro další fázi války.",
  "tajna-organizace": "Frakce už má aktivní pasivy pro špehování a pasti. Spící buňka se připravuje pro další fázi války.",
  hackeri: "Frakce už má aktivní pasivy pro data, kamery, alarmy, tech produkci a špehování. Výpadek systému přijde později.",
  "motorkarsky-gang": "Frakce už má aktivní pasivy pro tempo, vykrádání a agresivní tlak. Bleskový nájezd se připravuje.",
  "soukroma-armada": "Frakce už má aktivní pasivy pro útok, obranu a ztráty vybavení. Taktické nasazení přijde později.",
  korporace: "Frakce už má aktivní pasivy pro clean economy, heat mimo obsazování a obranné systémy. Právní štít se připravuje."
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
    ? `${specialAction.description} ${specialAction.status === "implemented" ? "Schopnost je aktivní." : "Efekt je součást identity frakce, ale v této verzi ho zatím nelze spustit."}`
    : PREVIEW_BY_FACTION_ID[factionId] || PREVIEW_BY_FACTION_ID[DEFAULT_FACTION_ID];
  return {
    factionId,
    name: faction.name,
    code: specialAction?.name || "Passive foundation",
    effect,
    cost: specialAction?.status === "implemented" ? "Dostupné" : "Nedostupné",
    canRun: specialAction?.status === "implemented"
  };
}

export function getFactionPassiveView(storage = globalThis.window?.localStorage) {
  const executionMode = getGameplayExecutionMode({ windowRef: globalThis.window });
  if (executionMode === GAMEPLAY_EXECUTION_MODES.serverAuthoritative) {
    const faction = globalThis.window?.empireStreetsGameplaySliceReadModel?.player?.faction || null;
    return faction ? {
      factionId: faction.factionId,
      name: faction.name,
      tagline: faction.tagline,
      playstyleSummary: faction.playstyleSummary,
      activePassiveEffects: [...(faction.activePassiveEffects || [])],
      source: "server"
    } : null;
  }
  if (executionMode !== GAMEPLAY_EXECUTION_MODES.localDemo) return null;
  const factionId = getCurrentPlayerFactionId(storage);
  const faction = FACTION_CATALOG[factionId] || FACTION_CATALOG[DEFAULT_FACTION_ID];
  return {
    factionId,
    name: faction.name,
    tagline: faction.tagline,
    playstyleSummary: faction.playstyleSummary,
    activePassiveEffects: [...(faction.coreBackedEffects || [])],
    source: "local-demo"
  };
}

function renderFactionPassives(grid, view) {
  if (!view) {
    grid.innerHTML = '<div class="faction-action-launch faction-action-launch--preview"><p class="faction-action-launch-description">Frakční data nejsou v tomto režimu dostupná.</p></div>';
    return;
  }
  grid.innerHTML = (view.activePassiveEffects || []).map((effect) => `
    <div class="faction-action-launch faction-action-launch--preview">
      <p class="faction-action-launch-description">${escapeHtml(effect)}</p>
      <div class="faction-action-launch-meta">
        <span>Pasivní efekt</span>
        <strong>AKTIVNÍ</strong>
      </div>
    </div>
  `).join("") || '<div class="faction-action-launch faction-action-launch--preview"><p class="faction-action-launch-description">Tato frakce nemá aktivní canonical pasiv.</p></div>';
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

  const open = (event) => {
    const factionView = getFactionPassiveView();
    renderFactionPassives(grid, factionView);
    if (status) {
      status.textContent = factionView
        ? `${factionView.name}: ${factionView.playstyleSummary}. Zobrazené efekty jsou aktivní v game-core.`
        : "Frakční data nejsou dostupná.";
    }
    modal.hidden = false;
    modal.classList.remove("hidden");
    openOverlay(modal, { type: "modal", ariaModal: true, restoreFocusOnClose: true, trigger: event?.currentTarget || null });
    closeBtn?.focus({ preventScroll: true });
  };

  const close = () => {
    modal.classList.add("hidden");
    modal.hidden = true;
    closeOverlay(modal, { restoreFocus: true });
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
