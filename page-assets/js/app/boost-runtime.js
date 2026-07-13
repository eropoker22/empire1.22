import {
  activateFactoryBoost,
  addGangHeat,
  formatDurationLabel,
  getFactoryBoostSnapshot,
  setBuildingActionFeedback
} from "./runtime.js";
import { closeOverlay, openOverlay } from "./ui/legacyOverlayCoordinator.js";
import { GAMEPLAY_EXECUTION_MODES, getGameplayExecutionMode } from "./runtime/gameplayExecutionMode.js";

const PAGE_SELECTOR = 'main[data-page="game"]';
const isLocalDemoBoostMode = () => getGameplayExecutionMode({
  windowRef: typeof window === "undefined" ? null : window,
  diagnosticsMode: typeof window === "undefined"
    ? null
    : window.empireStreetsRuntimeDiagnostics?.getSummary?.().runtimeMode
}) === GAMEPLAY_EXECUTION_MODES.localDemo;

function createFactoryBoostMessage(result) {
  if (!result?.ok) {
    return result?.reason || "Boost akce se nepodařila.";
  }

  const boost = result.boost || {};
  return `${boost.label || "Boost"} aktivní na ${formatDurationLabel(boost.durationMs || 0)}.`;
}

function renderBoostActions(content) {
  const factorySnapshot = getFactoryBoostSnapshot();

  const combatModule = Math.max(0, Math.floor(Number(factorySnapshot.supplies?.combatModule || 0)));

  content.innerHTML = `
    <section class="boost-modal__building">
      <div class="boost-modal__head">
        <div class="boost-modal__name">Továrna · DEMO</div>
        <div class="boost-modal__value">Bojový modul: <strong>${combatModule} ks</strong></div>
      </div>
      <div class="boost-modal__actions">
        <button class="button boost-modal__factory-btn boost-modal__factory-btn--assault" type="button" data-boost-building="factory" data-boost-action="assault" ${combatModule >= 2 ? "" : "disabled"}>
          Assault
        </button>
        <button class="button boost-modal__factory-btn boost-modal__factory-btn--rapid" type="button" data-boost-building="factory" data-boost-action="rapid" ${combatModule >= 3 ? "" : "disabled"}>
          Rapid
        </button>
        <button class="button boost-modal__factory-btn boost-modal__factory-btn--breach" type="button" data-boost-building="factory" data-boost-action="breach" ${combatModule >= 4 ? "" : "disabled"}>
          Breach
        </button>
      </div>
    </section>
  `;
}

function renderBoostStatus(status) {
  const factorySnapshot = getFactoryBoostSnapshot();

  const factoryEffects = Array.isArray(factorySnapshot.activeEffects)
    ? factorySnapshot.activeEffects.map((entry) => String(entry.type || "").trim() + ": " + formatDurationLabel(entry.remainingMs))
    : [];

  status.textContent = "Továrna • aktivní: " + (factoryEffects.length ? factoryEffects.join(", ") : "žádné");
}

function initBoostRuntime() {
  const root = document.querySelector(PAGE_SELECTOR);
  if (!root) {
    return;
  }

  const openButtons = Array.from(new Set(
    [
      ...document.querySelectorAll("[data-boost-open-trigger]"),
      document.getElementById("map-boost-btn")
    ].filter(Boolean)
  ));
  const modal = document.getElementById("boost-modal");
  const backdrop = document.getElementById("boost-modal-backdrop");
  const closeBtn = document.getElementById("boost-modal-close");
  const tabButtons = Array.from(modal?.querySelectorAll("[data-boost-tab]") || []);
  const actionsPanel = document.getElementById("boost-modal-panel-actions");
  const infoPanel = document.getElementById("boost-modal-panel-info");
  const content = document.getElementById("boost-modal-content");
  const status = document.getElementById("boost-modal-status");

  if (openButtons.length <= 0 || !modal || !content || !status) {
    return;
  }

  let activeTab = "actions";

  const setTab = (tab) => {
    activeTab = tab === "info" ? "info" : "actions";
    actionsPanel?.classList.toggle("hidden", activeTab !== "actions");
    infoPanel?.classList.toggle("hidden", activeTab !== "info");
    tabButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.boostTab === activeTab);
    });
  };

  const render = () => {
    renderBoostActions(content);
    renderBoostStatus(status);
  };

  const open = () => {
    if (!isLocalDemoBoostMode()) return;
    render();
    setTab("actions");
    modal.hidden = false;
    modal.classList.remove("hidden");
    openOverlay(modal, { type: "modal", ariaModal: true, restoreFocusOnClose: false });
  };

  const close = () => {
    modal.classList.add("hidden");
    modal.hidden = true;
    closeOverlay(modal, { restoreFocus: false });
  };

  openButtons.forEach((button) => {
    button.addEventListener("click", open);
  });
  const syncAvailability = () => {
    const available = isLocalDemoBoostMode();
    openButtons.forEach((button) => {
      button.hidden = !available;
      button.setAttribute("aria-hidden", available ? "false" : "true");
    });
    if (!available && !modal.classList.contains("hidden")) close();
  };
  backdrop?.addEventListener("click", close);
  closeBtn?.addEventListener("click", close);
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setTab(button.dataset.boostTab || "actions");
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.classList.contains("hidden")) {
      close();
    }
  });

  modal.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const actionBtn = target.closest("[data-boost-action]");
    if (!(actionBtn instanceof HTMLButtonElement)) {
      return;
    }

    const boostKey = String(actionBtn.dataset.boostAction || "").trim();
    const building = String(actionBtn.dataset.boostBuilding || "").trim().toLowerCase();
    if (!boostKey) {
      return;
    }

    if (building === "factory") {
      if (!isLocalDemoBoostMode()) return;
      const result = activateFactoryBoost(boostKey);
      if (!result?.ok) {
        setBuildingActionFeedback(root, "warning", "Factory boost", result.reason || "Boost akce se nepodařila.");
      } else {
        const nextHeat = addGangHeat(root, Number(result.boost?.heatAdded || 0), "Factory boost aktivace.");
        setBuildingActionFeedback(
          root,
          "success",
          "Factory boost",
          createFactoryBoostMessage(result),
          nextHeat > 0 ? `Heat ${nextHeat}` : ""
        );
      }
    } else {
      setBuildingActionFeedback(root, "warning", "Komponenta", "Ghost Serum a Overdrive X nemají přímé použití.");
    }

    render();
  });

  window.Empire = window.Empire || {};
  window.Empire.Map = {
    ...(window.Empire.Map || {}),
    getFactoryBoostSnapshot,
    useFactoryBoost: activateFactoryBoost
  };
  document.addEventListener("empire:runtime-mode-changed", syncAvailability);
  syncAvailability();
}

if (typeof document !== "undefined") {
  initBoostRuntime();
}
