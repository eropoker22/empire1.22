import {
  FREE_SESSION_ONBOARDING_STEPS,
  completeOnboardingProgress,
  getNextOnboardingHint as getPanelNextHint,
  hideOnboardingPanel as hidePanel,
  initOnboardingPanel,
  markOnboardingStepDone as markPanelStepDone,
  moveOnboardingProgress,
  normalizeOnboardingProgress,
  renderOnboardingPanel,
  shouldAutoStartOnboarding,
  showOnboardingPanel as showPanel
} from "../ui/onboardingPanel.js";
import { ONBOARDING_VERSION } from "./onboardingStepRegistry.js";
import {
  createOnboardingReadModel,
  resolveOnboardingMode
} from "./onboardingReadModel.js";

export const STORAGE_PREFIX = "empire:onboarding:v1";

function safeObject(value) {
  return value && typeof value === "object" ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function getStorage(storage = null) {
  return storage || (typeof window !== "undefined" ? window.localStorage : null);
}

function getEventType(eventOrState = {}) {
  if (typeof eventOrState === "string") {
    return eventOrState;
  }
  return String(eventOrState?.type || eventOrState?.kind || eventOrState?.detail?.type || "").trim();
}

function sanitizeKeyPart(value, fallback) {
  return encodeURIComponent(String(value || fallback || "unknown").trim() || fallback || "unknown");
}

export function resolveOnboardingStorageKey(context = {}) {
  const safeContext = safeObject(context);
  const playerId = createOnboardingReadModel(safeContext).playerId;
  const mode = resolveOnboardingMode({ ...safeContext, mode: "dev-only" });
  return `${STORAGE_PREFIX}:${sanitizeKeyPart(mode, "dev-only")}:${sanitizeKeyPart(playerId, "dev-player")}`;
}

function readStoredProgress(storage = null, key = "") {
  const store = getStorage(storage);
  if (!store?.getItem || !key) {
    return { completed: false, skipped: false, currentStepId: "welcome", dismissedAt: null, version: ONBOARDING_VERSION };
  }

  try {
    const parsed = JSON.parse(store.getItem(key) || "{}");
    return {
      completed: Boolean(parsed.completed),
      skipped: Boolean(parsed.skipped),
      currentStepId: String(parsed.currentStepId || "welcome"),
      dismissedAt: parsed.dismissedAt ? String(parsed.dismissedAt) : null,
      version: String(parsed.version || ONBOARDING_VERSION)
    };
  } catch {
    return { completed: false, skipped: false, currentStepId: "welcome", dismissedAt: null, version: ONBOARDING_VERSION };
  }
}

export function serializeOnboardingProgress(progress = {}) {
  const normalized = normalizeOnboardingProgress(progress);
  return {
    completed: Boolean(normalized.completed),
    skipped: Boolean(normalized.skipped),
    currentStepId: String(normalized.currentStepId || "welcome"),
    dismissedAt: normalized.dismissedAt || null,
    version: String(normalized.version || ONBOARDING_VERSION)
  };
}

function writeStoredProgress(progress = {}, storage = null, key = "") {
  const store = getStorage(storage);
  if (!store?.setItem || !key) {
    return false;
  }

  try {
    store.setItem(key, JSON.stringify(serializeOnboardingProgress(progress)));
    return true;
  } catch {
    return false;
  }
}

function eventCompletesStep(eventType = "", detail = {}) {
  const actionId = String(detail.actionId || detail.kind || "").trim();
  if (eventType === "onboarding:next") return detail.stepId;
  if (eventType === "win-condition:read") return "win-condition";
  if (eventType === "spawn:selected" || eventType === "spawn:confirmed") return "spawn-selection";
  if (eventType === "district:own-opened" || eventType === "empire:district-opened") return "your-district";
  if (eventType === "district:stats-read") return "district-stats";
  if (eventType === "building:opened" || eventType === "empire:building-opened") return "buildings";
  if (eventType === "income:tick" || eventType === "production:collected" || eventType === "action:production" || eventType === "cash:read") return "cash";
  if (eventType === "production:selected" || eventType === "craft:completed" || eventType === "equipment:prepared") return "production";
  if (eventType === "people:read") return "people";
  if (eventType === "heat:opened" || eventType === "heat:changed" || eventType === "police:feedback") return "heat";
  if (eventType === "day-night:opened") return "day-night";
  if (eventType === "district:enemy-opened" || eventType === "district:neighbor-opened") return "neighbor-districts";
  if (eventType === "spy:opened" || eventType === "spy:started" || eventType === "spy:completed" || actionId === "spy") return "spy";
  if (eventType === "robbery:opened" || eventType === "robbery:started" || actionId === "rob" || actionId === "heist") return "robbery";
  if (eventType === "attack:opened" || eventType === "attack:started" || eventType === "occupy:opened" || eventType === "occupy:started" || actionId === "attack" || actionId === "occupy") return "occupy-attack";
  if (eventType === "trap:opened" || actionId === "trap") return "traps";
  if (eventType === "city-feed:opened") return "city-feed";
  if (eventType === "market:opened") return "market";
  if (eventType === "alliance:opened") return "alliance";
  if (eventType === "elimination:opened" || eventType === "battle-royale:opened") return "elimination";
  if (eventType === "danger-zone:opened") return "danger-zone";
  if (eventType === "downtown:read") return "downtown";
  return null;
}

function shouldAdvanceFromEvent(progress = {}, stepId = "") {
  const normalized = normalizeOnboardingProgress(progress);
  if (!stepId || normalized.completed) {
    return false;
  }
  return normalized.currentStepId === stepId;
}

export function updateOnboardingProgress(context = {}, eventOrState = {}) {
  const safeContext = safeObject(context);
  const eventType = getEventType(eventOrState);
  const detail = safeObject(eventOrState?.detail || eventOrState);
  const progress = normalizeOnboardingProgress(safeContext.progress || {});

  if (progress.completed) {
    return progress;
  }

  if (eventType === "onboarding:skip") {
    return completeOnboardingProgress(progress, "skipped", { skipped: true });
  }

  if (eventType === "onboarding:dismiss") {
    return completeOnboardingProgress(progress, "dismissed", { skipped: true });
  }

  const completedStepId = eventCompletesStep(eventType, detail);
  if (shouldAdvanceFromEvent(progress, completedStepId)) {
    return markPanelStepDone(completedStepId, progress);
  }

  return progress;
}

export function markOnboardingStepDone(stepId, progress = {}) {
  return markPanelStepDone(stepId, progress);
}

export function skipOnboardingProgress(progress = {}) {
  return completeOnboardingProgress(progress, "skipped", { skipped: true });
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

function defaultFindContainer(root, documentRef) {
  return documentRef?.body || root?.querySelector?.("#game-root") || root;
}

function classifyDistrictOpen(context = {}, detail = {}) {
  const district = detail.district || context.selectedDistrict || null;
  const districtId = Number(district?.id || district?.districtId || 0);
  const ownedDistrictIds = asArray(context.world?.ownedDistrictIds || context.districtState?.ownedDistrictIds).map(Number);
  if (!districtId) {
    return "district:neighbor-opened";
  }
  return ownedDistrictIds.includes(districtId) ? "district:own-opened" : "district:neighbor-opened";
}

export function createOnboardingBridge(deps = {}) {
  const storage = deps.storage || null;
  const documentRef = deps.documentRef || (typeof document !== "undefined" ? document : null);
  const root = deps.root || documentRef?.querySelector?.("#game-root") || null;
  const container = deps.container || defaultFindContainer(root, documentRef);
  let storageKey = "";
  let progress = normalizeOnboardingProgress({ currentStepId: "welcome" });
  let readModel = createOnboardingReadModel({});
  let mount = null;
  let eventsBound = false;
  const boundEvents = [];

  const getContext = () => ({
    ...(typeof deps.getContext === "function" ? safeObject(deps.getContext()) : {}),
    mode: "dev-only",
    progress
  });

  const refreshReadModel = () => {
    readModel = createOnboardingReadModel(getContext());
    const nextKey = resolveOnboardingStorageKey(getContext());
    if (nextKey && nextKey !== storageKey) {
      storageKey = nextKey;
      progress = normalizeOnboardingProgress(readStoredProgress(storage, storageKey));
    }
    return readModel;
  };

  const persist = () => writeStoredProgress(progress, storage, storageKey);

  const render = () => {
    refreshReadModel();
    if (!mount) {
      mount = initOnboardingPanel({ progress }, {
        container,
        documentRef,
        root,
        readModel,
        callbacks: callbacks()
      });
    }
    if (!mount) {
      return false;
    }
    return renderOnboardingPanel(progress, callbacks(), {
      mount,
      root,
      readModel
    });
  };

  const update = (eventOrState = {}) => {
    refreshReadModel();
    progress = updateOnboardingProgress(getContext(), eventOrState);
    persist();
    render();
    return progress;
  };

  const next = (stepId = "") => {
    progress = markPanelStepDone(stepId || progress.currentStepId, progress);
    persist();
    render();
    return progress;
  };

  const skip = (currentStepId = "skipped") => {
    progress = completeOnboardingProgress(progress, currentStepId, { skipped: currentStepId !== "completed" });
    persist();
    render();
    return progress;
  };

  const back = () => {
    progress = moveOnboardingProgress(progress, -1);
    persist();
    render();
    return progress;
  };

  const restart = () => {
    refreshReadModel();
    progress = normalizeOnboardingProgress({
      completed: false,
      currentStepId: "welcome",
      skipped: false,
      dismissedAt: null,
      version: ONBOARDING_VERSION
    });
    persist();
    showPanel();
    render();
    return progress;
  };

  function callbacks() {
    return {
      onNext: (stepId) => next(stepId),
      onBack: () => back(),
      onSkip: () => skip("skipped"),
      onDismiss: () => skip("dismissed")
    };
  }

  const bindEvents = () => {
    if (eventsBound || !documentRef?.addEventListener) {
      return false;
    }
    eventsBound = true;

    const addBoundEvent = (name, handler) => {
      documentRef.addEventListener(name, handler);
      boundEvents.push([name, handler]);
    };

    const handleDistrictOpened = (event) => update({
      type: classifyDistrictOpen(getContext(), safeObject(event?.detail)),
      detail: event?.detail || {}
    });

    const eventMap = new Map([
      ["empire:district-opened", handleDistrictOpened],
      ["empire:building-opened", (event) => update({ type: "building:opened", detail: event?.detail || {} })],
      ["empire:production-collected", (event) => update({ type: "production:collected", detail: event?.detail || {} })],
      ["empire:spy-started", (event) => update({ type: "spy:started", detail: event?.detail || {} })],
      ["empire:robbery-started", (event) => update({ type: "robbery:started", detail: event?.detail || {} })],
      ["empire:attack-started", (event) => update({ type: "attack:started", detail: event?.detail || {} })],
      ["empire:occupy-started", (event) => update({ type: "occupy:started", detail: event?.detail || {} })],
      ["empire:heat-changed", (event) => update({ type: "heat:changed", detail: event?.detail || {} })],
      ["empire:police-feedback", (event) => update({ type: "police:feedback", detail: event?.detail || {} })],
      ["empire:runtime-refresh", () => render()]
    ]);

    for (const [name, handler] of eventMap.entries()) {
      addBoundEvent(name, handler);
    }

    const handleClick = (event) => {
      const target = event?.target;
      if (!target?.closest) {
        return;
      }

      if (target.closest("[data-onboarding-launch]")) {
        restart();
        return;
      }
      if (target.closest("[data-gang-heat]")) {
        update({ type: "heat:opened" });
        return;
      }
      if (target.closest("[data-game-phase-toggle], [data-map-phase-toggle], .map-phase-toolbar")) {
        update({ type: "day-night:opened" });
        return;
      }
      if (target.closest("[data-market-popup-open], [data-market-popup]")) {
        update({ type: "market:opened" });
        return;
      }
      if (target.closest("[data-alliance-popup-open], #alliance-btn, [data-gang-alliance]")) {
        update({ type: "alliance:opened" });
        return;
      }
      if (target.closest("[data-building-action-feed], [data-district-popup-gossip], [data-district-popup-gossip-list]")) {
        update({ type: "city-feed:opened" });
        return;
      }
      if (target.closest("[data-br-info-open]")) {
        update({ type: "elimination:opened" });
        return;
      }
      if (target.closest("[data-select-spawn-district-id]")) {
        update({ type: "spawn:selected" });
        return;
      }
      const actionButton = target.closest("[data-district-action-id]");
      if (actionButton) {
        update({
          type: "district-action:opened",
          detail: { actionId: actionButton.dataset?.districtActionId || "" }
        });
      }
    };
    addBoundEvent("click", handleClick);

    return true;
  };

  const destroy = () => {
    if (documentRef?.removeEventListener) {
      for (const [name, handler] of boundEvents.splice(0)) {
        documentRef.removeEventListener(name, handler);
      }
    }
    eventsBound = false;
    hidePanel();
    return true;
  };

  const init = () => {
    refreshReadModel();
    if (shouldAutoStartOnboarding(progress, readModel)) {
      render();
    }
    bindEvents();
    return progress;
  };

  return {
    getProgress: () => progress,
    getReadModel: () => readModel,
    getStorageKey: () => storageKey,
    getSteps: () => FREE_SESSION_ONBOARDING_STEPS,
    init,
    markDone: (stepId) => next(stepId),
    back,
    destroy,
    render,
    restart,
    skip,
    update
  };
}

if (typeof window !== "undefined") {
  window.EmpireOnboardingBridge = {
    STORAGE_PREFIX,
    createOnboardingBridge,
    getNextOnboardingHint,
    hideOnboardingPanel,
    markOnboardingStepDone,
    resolveOnboardingStorageKey,
    serializeOnboardingProgress,
    showOnboardingPanel,
    skipOnboardingProgress,
    updateOnboardingProgress
  };
}
