import {
  activateFactoryBoost,
  addGangHeat,
  formatDurationLabel,
  getFactoryBoostSnapshot,
  getPharmacyBoostSnapshot,
  setBuildingActionFeedback,
  usePharmacyBoost
} from "./runtime.js";

const PAGE_SELECTOR = 'main[data-page="game"]';

function createFactoryBoostMessage(result) {
  if (!result?.ok) {
    return result?.reason || "Boost akce se nepodařila.";
  }

  const boost = result.boost || {};
  return `${boost.label || "Boost"} aktivní na ${formatDurationLabel(boost.durationMs || 0)}.`;
}

function renderBoostActions(content) {
  const pharmacySnapshot = getPharmacyBoostSnapshot();
  const factorySnapshot = getFactoryBoostSnapshot();

  const ghostSerum = Math.max(0, Math.floor(Number(pharmacySnapshot.drugInventory?.ghostSerum || 0)));
  const overdriveX = Math.max(0, Math.floor(Number(pharmacySnapshot.drugInventory?.overdriveX || 0)));
  const combatModule = Math.max(0, Math.floor(Number(factorySnapshot.supplies?.combatModule || 0)));

  content.innerHTML = `
    <section class="boost-modal__building">
      <div class="boost-modal__head">
        <div class="boost-modal__name">Lab</div>
        <div class="boost-modal__value">Boost drogy: <strong>Ghost Serum ${ghostSerum} ks • Overdrive X ${overdriveX} ks</strong></div>
      </div>
      <div class="boost-modal__actions">
        <button class="button boost-modal__boost-btn boost-modal__boost-btn--ghost" type="button" data-boost-building="pharmacy" data-boost-action="recon" ${ghostSerum >= 1 ? "" : "disabled"}>
          Ghost Serum boost
        </button>
        <button class="button boost-modal__boost-btn boost-modal__boost-btn--overdrive" type="button" data-boost-building="pharmacy" data-boost-action="neuro" ${overdriveX >= 1 ? "" : "disabled"}>
          Overdrive X boost
        </button>
      </div>
    </section>
    <section class="boost-modal__building">
      <div class="boost-modal__head">
        <div class="boost-modal__name">Továrna</div>
        <div class="boost-modal__value">Combat Module: <strong>${combatModule} ks</strong></div>
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
  const pharmacySnapshot = getPharmacyBoostSnapshot();
  const factorySnapshot = getFactoryBoostSnapshot();

  const pharmacyEffects = Array.isArray(pharmacySnapshot.activeEffects)
    ? pharmacySnapshot.activeEffects.map((entry) => {
        const label = entry.type === "recon"
          ? "Recon"
          : entry.type === "action"
            ? "Action"
            : entry.type === "neuro"
              ? "Neuro"
              : "Crash";
        return `${label}: ${formatDurationLabel(entry.remainingMs)}`;
      })
    : [];

  const factoryEffects = Array.isArray(factorySnapshot.activeEffects)
    ? factorySnapshot.activeEffects.map((entry) => `${String(entry.type || "").trim()}: ${formatDurationLabel(entry.remainingMs)}`)
    : [];

  status.textContent = [
    `Lab • aktivní: ${pharmacyEffects.length ? pharmacyEffects.join(", ") : "žádné"}`,
    `Továrna • aktivní: ${factoryEffects.length ? factoryEffects.join(", ") : "žádné"}`
  ].join(" | ");
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
    render();
    setTab("actions");
    modal.classList.remove("hidden");
  };

  const close = () => {
    modal.classList.add("hidden");
  };

  openButtons.forEach((button) => {
    button.addEventListener("click", open);
  });
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
      const result = usePharmacyBoost(boostKey);
      if (!result?.ok) {
        setBuildingActionFeedback(root, "warning", "Lab boost", result.message || "Boost akce se nepodařila.");
      } else {
        const nextHeat = addGangHeat(root, Number(result.heatAdded || 0), "Lab boost aktivace.");
        setBuildingActionFeedback(
          root,
          "success",
          "Lab boost",
          result.message || "Boost aktivní.",
          nextHeat > 0 ? `Heat ${nextHeat}` : ""
        );
      }
    }

    render();
  });

  window.Empire = window.Empire || {};
  window.Empire.Map = {
    ...(window.Empire.Map || {}),
    getPharmacyBoostSnapshot,
    usePharmacyBoost,
    getFactoryBoostSnapshot,
    useFactoryBoost: activateFactoryBoost
  };
}

if (typeof document !== "undefined") {
  initBoostRuntime();
}
