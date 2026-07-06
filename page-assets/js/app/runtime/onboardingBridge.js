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

export const STORAGE_PREFIX = "empire:onboarding:demo-v1";
const LEGACY_STORAGE_PREFIXES = Object.freeze([
  "empire:onboarding:v1"
]);
const LEGACY_STORAGE_KEYS = Object.freeze([
  "empireStreets.freeSessionOnboarding.v1"
]);

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

function hasBuildingActionFeedback(detail = {}) {
  const safeDetail = safeObject(detail);
  const payload = safeObject(safeDetail.payload);
  const snapshot = safeObject(safeDetail.snapshot);
  return Boolean(
    payload.actionId
    || payload.buildingTypeId
    || payload.reportType === "building-action"
    || snapshot.actionId
    || snapshot.buildingTypeId
    || snapshot.reportType === "building-action"
  );
}

function getDetailDistrictId(detail = {}, ...keys) {
  const safeDetail = safeObject(detail);
  for (const key of keys) {
    const value = key.split(".").reduce((current, part) => safeObject(current)[part], safeDetail);
    const districtId = Number(value);
    if (Number.isFinite(districtId) && districtId > 0) {
      return districtId;
    }
  }
  return null;
}

function isConfirmedSpyOnboardingTarget(detail = {}) {
  return getDetailDistrictId(detail, "targetDistrictId", "mission.targetDistrictId", "districtId") === 2;
}

function isConfirmedTrapOnboardingTarget(detail = {}) {
  return getDetailDistrictId(detail, "targetDistrictId", "districtId") === 1;
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
    const parsedVersion = String(parsed.version || "");
    if (parsedVersion && parsedVersion !== ONBOARDING_VERSION) {
      store.removeItem?.(key);
      return { completed: false, skipped: false, currentStepId: "welcome", dismissedAt: null, version: ONBOARDING_VERSION };
    }
    return {
      completed: Boolean(parsed.completed),
      skipped: Boolean(parsed.skipped),
      currentStepId: String(parsed.currentStepId || "welcome"),
      observedStepIds: asArray(parsed.observedStepIds).map(String).filter(Boolean),
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
    observedStepIds: asArray(normalized.observedStepIds).map(String).filter(Boolean),
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
  if (eventType === "onboarding:next") return detail.stepId;
  if (eventType === "spawn:selected" || eventType === "spawn:confirmed") return "your-district";
  if (eventType === "district:own-opened" || eventType === "empire:district-opened") return "your-district";
  if (eventType === "district:stats-read") return "your-district";
  if (eventType === "building-action:feedback") return "building-action";
  if (eventType === "spy:started" && isConfirmedSpyOnboardingTarget(detail)) return "spy";
  if ((eventType === "trap:moved" || eventType === "trap:armed") && isConfirmedTrapOnboardingTarget(detail)) return "attack-order";
  if (eventType === "attack:started" || eventType === "occupy:started") return "attack-order";
  return null;
}

function pruneLegacyOnboardingStorage(storage = null) {
  const store = getStorage(storage);
  if (!store?.removeItem) {
    return false;
  }

  for (const key of LEGACY_STORAGE_KEYS) {
    store.removeItem(key);
  }

  if (!store.length || !store.key) {
    return true;
  }

  const keysToRemove = [];
  for (let index = 0; index < store.length; index += 1) {
    const key = String(store.key(index) || "");
    if (LEGACY_STORAGE_PREFIXES.some((prefix) => key === prefix || key.startsWith(`${prefix}:`))) {
      keysToRemove.push(key);
    }
  }
  for (const key of keysToRemove) {
    store.removeItem(key);
  }
  return true;
}

function getObservedStepIdsForEvent(eventType = "", detail = {}) {
  const completedStepId = eventCompletesStep(eventType, detail);
  if (!completedStepId || !FREE_SESSION_ONBOARDING_STEPS.some((step) => step.id === completedStepId)) {
    return [];
  }

  const observed = new Set([completedStepId]);
  const userActionStepIds = new Set(["your-district", "building-action", "spy", "attack-order"]);
  if (userActionStepIds.has(completedStepId)) {
    observed.add("welcome");
  }
  if (completedStepId === "building-action" || completedStepId === "spy" || completedStepId === "attack-order") {
    observed.add("your-district");
  }
  return Array.from(observed);
}

function applyObservedProgress(progress = {}) {
  let nextProgress = normalizeOnboardingProgress(progress);
  const observed = new Set(nextProgress.observedStepIds);
  observed.delete("heat-police");
  let guard = 0;

  while (!nextProgress.completed && observed.has(nextProgress.currentStepId) && guard < FREE_SESSION_ONBOARDING_STEPS.length) {
    nextProgress = markPanelStepDone(nextProgress.currentStepId, {
      ...nextProgress,
      observedStepIds: Array.from(observed)
    });
    guard += 1;
  }

  return normalizeOnboardingProgress({
    ...nextProgress,
    observedStepIds: Array.from(observed)
  });
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

  const observed = new Set(progress.observedStepIds);
  for (const stepId of getObservedStepIdsForEvent(eventType, detail)) {
    observed.add(stepId);
  }

  return applyObservedProgress({
    ...progress,
    observedStepIds: Array.from(observed)
  });
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
  let legacyStoragePruned = false;
  let lastEnteredStepId = "";
  const boundEvents = [];

  const getContext = () => ({
    ...(typeof deps.getContext === "function" ? safeObject(deps.getContext()) : {}),
    mode: "dev-only",
    progress
  });

  const refreshReadModel = () => {
    if (!legacyStoragePruned) {
      pruneLegacyOnboardingStorage(storage);
      legacyStoragePruned = true;
    }
    readModel = createOnboardingReadModel(getContext());
    const nextKey = resolveOnboardingStorageKey(getContext());
    if (nextKey && nextKey !== storageKey) {
      storageKey = nextKey;
      progress = normalizeOnboardingProgress(readStoredProgress(storage, storageKey));
    }
    return readModel;
  };

  const persist = () => writeStoredProgress(progress, storage, storageKey);

  const syncStepEnter = () => {
    const currentStepId = normalizeOnboardingProgress(progress).currentStepId;
    if (!currentStepId || currentStepId === lastEnteredStepId) {
      return false;
    }
    lastEnteredStepId = currentStepId;
    return typeof deps.onStepEnter === "function" && deps.onStepEnter(currentStepId, getContext()) === true;
  };

  const render = () => {
    refreshReadModel();
    if (syncStepEnter()) {
      refreshReadModel();
    }
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
    const wasCompleted = normalizeOnboardingProgress(progress).completed;
    progress = markPanelStepDone(stepId || progress.currentStepId, progress);
    persist();
    render();
    if (!wasCompleted && progress.completed && typeof deps.onComplete === "function") {
      deps.onComplete(getContext());
    }
    return progress;
  };

  const welcomeStart = (stepId = "") => {
    const normalizedStepId = String(stepId || progress.currentStepId || "").trim();
    if (normalizedStepId === "welcome" && typeof deps.onWelcomeStart === "function") {
      deps.onWelcomeStart(getContext());
    }
    return next(normalizedStepId);
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
      onNext: (stepId) => welcomeStart(stepId),
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
      ["empire:onboarding-event", (event) => update({ type: getEventType(event?.detail), detail: event?.detail || {} })],
      ["empire:building-opened", (event) => update({ type: "building:opened", detail: event?.detail || {} })],
      ["empire:action-result", (event) => {
        const detail = safeObject(event?.detail);
        if (hasBuildingActionFeedback(detail)) {
          update({ type: "building-action:feedback", detail });
        }
      }],
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
