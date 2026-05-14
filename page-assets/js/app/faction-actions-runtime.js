import { STORAGE_KEYS } from "../config.js";

const PAGE_SELECTOR = "[data-client-surface='game-shell']";

const FACTION_ACTIONS = [
  {
    factionId: "mafian",
    name: "Mafián",
    code: "Omerta Lock",
    effect: "Zamkne další police pressure tick a sníží heat z jedné špinavé akce.",
    cost: "2 influence"
  },
  {
    factionId: "kartel",
    name: "Kartel",
    code: "Supply Flood",
    effect: "Další produkce drog doběhne rychleji a přidá bonusový dirty cash pulse.",
    cost: "1 lab slot"
  },
  {
    factionId: "kult",
    name: "Kult",
    code: "Fanatic Surge",
    effect: "Dočasně zvýší vliv a posílí obranu districtu s nejnižším morale.",
    cost: "4 influence"
  },
  {
    factionId: "tajna-organizace",
    name: "Tajná organizace",
    code: "Black File",
    effect: "Odhalí slabinu cíle a zvýší kvalitu příští spy akce.",
    cost: "1 intel token"
  },
  {
    factionId: "hackeri",
    name: "Hackeři",
    code: "Grid Breach",
    effect: "Na krátkou dobu zrychlí event reakce a oslabí digitální obranu soupeře.",
    cost: "2 tech cores"
  },
  {
    factionId: "motorkarsky-gang",
    name: "Motorkářský gang",
    code: "Road Rush",
    effect: "Další raid nebo attack dostane rychlostní bonus a menší návratové ztráty.",
    cost: "1 fuel route"
  },
  {
    factionId: "soukroma-armada",
    name: "Soukromá armáda",
    code: "Hard Shield",
    effect: "Přidá bojový shield na první napadený district a posílí obranné výpočty.",
    cost: "2 combat modules"
  },
  {
    factionId: "korporace",
    name: "Korporace",
    code: "Legal Cover",
    effect: "Zvedne čistý cash income a sníží viditelnost příští ekonomické akce.",
    cost: "$7,500 clean"
  }
];

const DEFAULT_FACTION_ID = "mafian";
const FACTION_ACTION_BY_ID = new Map(FACTION_ACTIONS.map((action) => [action.factionId, action]));

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
    return FACTION_ACTION_BY_ID.has(factionId) ? factionId : DEFAULT_FACTION_ID;
  } catch {
    return DEFAULT_FACTION_ID;
  }
}

export function getFactionActionForPlayer(storage) {
  return FACTION_ACTION_BY_ID.get(getCurrentPlayerFactionId(storage)) || FACTION_ACTION_BY_ID.get(DEFAULT_FACTION_ID);
}

function renderFactionActions(grid, action = getFactionActionForPlayer()) {
  grid.innerHTML = `
    <div class="faction-action-launch">
      <button
        type="button"
        class="faction-action-launch-button"
        data-faction-action="${escapeHtml(action.code)}"
        data-faction-name="${escapeHtml(action.name)}"
        aria-label="${escapeHtml(`${action.name}: spustit ${action.code}`)}"
      >
        Spustit akci
      </button>
      <p class="faction-action-launch-description">
        Popis této frakční akce doplníme později.
      </p>
    </div>
  `;
}

function initFactionActionsRuntime() {
  const root = document.querySelector(PAGE_SELECTOR);
  if (!root) {
    return;
  }

  const modal = document.getElementById("faction-actions-modal");
  const backdrop = document.getElementById("faction-actions-modal-backdrop");
  const closeBtn = document.getElementById("faction-actions-modal-close");
  const grid = document.getElementById("faction-actions-modal-grid");
  const status = document.getElementById("faction-actions-modal-status");
  const openButtons = Array.from(document.querySelectorAll("[data-faction-actions-open-trigger]"));

  if (!modal || !grid || openButtons.length <= 0) {
    return;
  }

  const open = () => {
    const playerAction = getFactionActionForPlayer();
    renderFactionActions(grid, playerAction);
    if (status) {
      status.textContent = `${playerAction.name}: ${playerAction.code}`;
    }
    modal.classList.remove("hidden");
  };

  const close = () => {
    modal.classList.add("hidden");
  };

  openButtons.forEach((button) => button.addEventListener("click", open));
  backdrop?.addEventListener("click", close);
  closeBtn?.addEventListener("click", close);

  modal.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const button = target.closest("[data-faction-action]");
    if (!(button instanceof HTMLButtonElement) || !status) {
      return;
    }

    const factionName = button.dataset.factionName || "Frakce";
    const actionCode = button.dataset.factionAction || "Protokol";
    status.textContent = `${factionName}: ${actionCode} spuštěno.`;
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.classList.contains("hidden")) {
      close();
    }
  });
}

if (typeof document !== "undefined") {
  initFactionActionsRuntime();
}
