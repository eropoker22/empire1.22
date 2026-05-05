import {
  FREE_SESSION_ONBOARDING_STEPS,
  getNextOnboardingHint as getPanelNextHint,
  hideOnboardingPanel as hidePanel,
  initOnboardingPanel,
  markOnboardingStepDone as markPanelStepDone,
  normalizeOnboardingProgress,
  renderOnboardingPanel,
  showOnboardingPanel as showPanel
} from "../ui/onboardingPanel.js";

const STORAGE_KEY = "empireStreets.freeSessionOnboarding.v1";

function safeObject(value) {
  return value && typeof value === "object" ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function getStorage(storage = null) {
  return storage || (typeof window !== "undefined" ? window.localStorage : null);
}

function readStoredProgress(storage = null) {
  const store = getStorage(storage);
  if (!store?.getItem) {
    return { completedStepIds: [], hidden: false, minimized: false };
  }

  try {
    const parsed = JSON.parse(store.getItem(STORAGE_KEY) || "{}");
    return {
      completedStepIds: asArray(parsed.completedStepIds).map(String),
      hidden: Boolean(parsed.hidden),
      minimized: Boolean(parsed.minimized)
    };
  } catch {
    return { completedStepIds: [], hidden: false, minimized: false };
  }
}

function writeStoredProgress(progress = {}, storage = null) {
  const store = getStorage(storage);
  if (!store?.setItem) {
    return false;
  }

  try {
    store.setItem(STORAGE_KEY, JSON.stringify({
      completedStepIds: asArray(progress.completedStepIds).map(String),
      hidden: Boolean(progress.hidden),
      minimized: Boolean(progress.minimized)
    }));
    return true;
  } catch {
    return false;
  }
}

function hasAnyPositiveValue(value = {}) {
  return Object.values(safeObject(value)).some((amount) => Number(amount || 0) > 0);
}

function isOwnDistrict(selectedDistrict, ownedDistrictIds = []) {
  const selectedId = Number(selectedDistrict?.id || selectedDistrict?.districtId || 0);
  return selectedId > 0 && asArray(ownedDistrictIds).map(Number).includes(selectedId);
}

function isEnemyDistrict(selectedDistrict, ownedDistrictIds = []) {
  const selectedId = Number(selectedDistrict?.id || selectedDistrict?.districtId || 0);
  return selectedId > 0 && !asArray(ownedDistrictIds).map(Number).includes(selectedId);
}

function getEventType(eventOrState = {}) {
  if (typeof eventOrState === "string") {
    return eventOrState;
  }
  return String(eventOrState?.type || eventOrState?.kind || eventOrState?.detail?.type || "").trim();
}

export function updateOnboardingProgress(context = {}, eventOrState = {}) {
  const safeContext = safeObject(context);
  const progress = safeContext.progress || {};
  const completed = new Set([
    ...asArray(progress.completedStepIds || progress.completed).map(String),
    ...asArray(safeContext.completedStepIds).map(String)
  ]);
  const eventType = getEventType(eventOrState);
  const detail = safeObject(eventOrState?.detail || eventOrState);
  const world = safeObject(safeContext.world);
  const inventory = safeObject(safeContext.inventory);
  const selectedDistrict = safeContext.selectedDistrict || detail.district || null;
  const ownedDistrictIds = asArray(world.ownedDistrictIds || safeContext.ownedDistrictIds).map(Number).filter(Boolean);
  const spyIntel = safeObject(safeContext.spyIntel || safeContext.spy?.intel);
  const spyState = safeObject(safeContext.spy);

  if (isOwnDistrict(selectedDistrict, ownedDistrictIds) || eventType === "district:own-opened") {
    completed.add("open-own-district");
  }
  if (eventType === "building:opened" || safeContext.openedBuilding || detail.buildingName) {
    completed.add("open-first-building");
  }
  if (eventType === "production:collected" || eventType === "action:production" || detail.kind === "production") {
    completed.add("collect-production");
  }
  if (eventType === "storage:opened" || safeContext.storageOpened) {
    completed.add("check-storage");
  }
  if (
    eventType === "craft:completed"
    || eventType === "equipment:prepared"
    || hasAnyPositiveValue(inventory.weapons)
    || hasAnyPositiveValue(inventory.factorySupplies)
  ) {
    completed.add("prepare-equipment");
  }
  if (isEnemyDistrict(selectedDistrict, ownedDistrictIds) || eventType === "district:enemy-opened") {
    completed.add("select-enemy-district");
  }
  if (
    eventType === "spy:started"
    || eventType === "spy:completed"
    || eventType === "action:spy"
    || asArray(spyState.missions).length > 0
    || asArray(spyIntel.revealedTypeDistrictIds).length > 0
    || asArray(spyIntel.revealedDefenseDistrictIds).length > 0
  ) {
    completed.add("run-spy");
  }
  if (eventType === "attack:started" || eventType === "action:attack" || asArray(safeContext.attackOrders).length > 0) {
    completed.add("run-attack");
  }
  if (eventType === "battle-report:opened" || eventType === "attack:completed" || eventType === "action:attack") {
    completed.add("read-battle-report");
  }
  if (eventType === "heat:changed" || eventType === "police:feedback" || eventType === "action:police" || safeContext.hasPoliceFeedback) {
    completed.add("watch-heat-police");
  }

  return normalizeOnboardingProgress({
    ...progress,
    completedStepIds: Array.from(completed)
  });
}

export function markOnboardingStepDone(stepId, progress = {}) {
  const completed = new Set(asArray(progress.completedStepIds || progress.completed).map(String));
  const panelCompleted = markPanelStepDone(stepId);
  for (const id of panelCompleted) {
    completed.add(id);
  }
  return normalizeOnboardingProgress({
    ...progress,
    completedStepIds: Array.from(completed)
  });
}

export function getNextOnboardingHint(context = {}) {
  return getPanelNextHint({
    progress: updateOnboardingProgress(context, {})
  });
}

export function hideOnboardingPanel() {
  return hidePanel();
}

export function showOnboardingPanel() {
  return showPanel();
}

function defaultFindContainer(root) {
  return root?.querySelector?.("#game-left-nav")
    || root?.querySelector?.("#game-rail-left")
    || root;
}

export function createOnboardingBridge(deps = {}) {
  const storage = deps.storage || null;
  const documentRef = deps.documentRef || (typeof document !== "undefined" ? document : null);
  const root = deps.root || documentRef?.querySelector?.("#game-root") || null;
  const container = deps.container || defaultFindContainer(root);
  let progress = normalizeOnboardingProgress(readStoredProgress(storage));
  let mount = null;

  const getContext = () => ({
    ...(typeof deps.getContext === "function" ? safeObject(deps.getContext()) : {}),
    progress
  });

  const persist = () => writeStoredProgress(progress, storage);

  const render = () => {
    if (!mount) {
      mount = initOnboardingPanel({ progress }, {
        container,
        documentRef,
        root,
        callbacks: {
          onHide: () => {
            progress = { ...progress, hidden: true };
            persist();
          },
          onMinimize: (minimized) => {
            progress = { ...progress, minimized: Boolean(minimized) };
            persist();
            render();
          }
        }
      });
    }
    if (!mount) {
      return false;
    }
    return renderOnboardingPanel(progress, {
      onHide: () => {
        progress = { ...progress, hidden: true };
        persist();
      },
      onMinimize: (minimized) => {
        progress = { ...progress, minimized: Boolean(minimized) };
        persist();
        render();
      }
    }, { mount });
  };

  const update = (eventOrState = {}) => {
    progress = updateOnboardingProgress(getContext(), eventOrState);
    persist();
    render();
    return progress;
  };

  const bindEvents = () => {
    if (!documentRef?.addEventListener) {
      return false;
    }

    const eventMap = new Map([
      ["empire:district-opened", (event) => update(event)],
      ["empire:building-opened", (event) => update(event)],
      ["empire:action-result", (event) => {
        const kind = String(event?.detail?.kind || "").trim();
        update({ type: `action:${kind}`, detail: event?.detail || {} });
      }],
      ["empire:production-collected", (event) => update({ type: "production:collected", detail: event?.detail || {} })],
      ["empire:spy-started", (event) => update({ type: "spy:started", detail: event?.detail || {} })],
      ["empire:attack-started", (event) => update({ type: "attack:started", detail: event?.detail || {} })],
      ["empire:result-modal-opened", (event) => {
        const kind = String(event?.detail?.kind || "").trim();
        update({ type: kind === "attack" ? "battle-report:opened" : `result:${kind}`, detail: event?.detail || {} });
      }],
      ["empire:heat-changed", (event) => update({ type: "heat:changed", detail: event?.detail || {} })],
      ["empire:police-feedback", (event) => update({ type: "police:feedback", detail: event?.detail || {} })],
      ["empire:runtime-refresh", () => update({ type: "runtime:refresh" })]
    ]);

    for (const [name, handler] of eventMap.entries()) {
      documentRef.addEventListener(name, handler);
    }

    root?.querySelector?.("[data-storage-popup-open]")?.addEventListener?.("click", () => update({ type: "storage:opened" }));
    documentRef.addEventListener("click", (event) => {
      if (event?.target?.closest?.("[data-storage-popup-open]")) {
        update({ type: "storage:opened" });
      }
    });
    return true;
  };

  const init = () => {
    render();
    update({ type: "init" });
    bindEvents();
    return progress;
  };

  return {
    getProgress: () => progress,
    getSteps: () => FREE_SESSION_ONBOARDING_STEPS,
    init,
    markDone: (stepId) => {
      progress = markOnboardingStepDone(stepId, progress);
      persist();
      render();
      return progress;
    },
    render,
    update
  };
}

if (typeof window !== "undefined") {
  window.EmpireOnboardingBridge = {
    STORAGE_KEY,
    createOnboardingBridge,
    getNextOnboardingHint,
    hideOnboardingPanel,
    markOnboardingStepDone,
    showOnboardingPanel,
    updateOnboardingProgress
  };
}
