import {
  isOnboardingDefeated,
  resolveOnboardingStepState
} from "../runtime/onboardingReadModel.js";
import {
  ONBOARDING_STEPS,
  ONBOARDING_VERSION,
  getOnboardingStepIndex,
  getOnboardingTargetSelector
} from "../runtime/onboardingStepRegistry.js";

export { ONBOARDING_STEPS, ONBOARDING_VERSION };
export const FREE_SESSION_ONBOARDING_STEPS = ONBOARDING_STEPS;

const panelState = {
  mount: null,
  highlight: null,
  hidden: false,
  currentStepId: "welcome"
};

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function getOwnerDocument(element) {
  return element?.ownerDocument || (typeof document !== "undefined" ? document : null);
}

function createElement(ownerDocument, tagName, className = "") {
  const element = ownerDocument?.createElement?.(tagName);
  if (element && className) {
    element.className = className;
  }
  return element || null;
}

function stepIndexById(stepId) {
  return getOnboardingStepIndex(stepId);
}

function resolveCurrentStepId(progress = {}) {
  const explicit = String(progress.currentStepId || "").trim();
  if (ONBOARDING_STEPS.some((step) => step.id === explicit)) {
    return explicit;
  }
  const completed = new Set(asArray(progress.completedStepIds || progress.completed).map(String));
  return ONBOARDING_STEPS.find((step) => !completed.has(step.id))?.id || "win-condition";
}

export function normalizeOnboardingProgress(progress = {}) {
  const completedStepIds = asArray(progress.completedStepIds)
    .map(String)
    .filter(Boolean);
  const completedSet = new Set(completedStepIds);
  const currentStepId = progress.completed
    ? (String(progress.currentStepId || "completed").trim() || "completed")
    : resolveCurrentStepId({ ...progress, completedStepIds });
  const currentStep = ONBOARDING_STEPS.find((step) => step.id === currentStepId) || null;
  const currentIndex = currentStep ? stepIndexById(currentStep.id) : ONBOARDING_STEPS.length - 1;
  const steps = ONBOARDING_STEPS.map((step) => ({
    ...step,
    done: progress.completed || completedSet.has(step.id) || stepIndexById(step.id) < currentIndex
  }));
  const completedCount = progress.completed
    ? ONBOARDING_STEPS.length
    : steps.filter((step) => step.done).length;

  return {
    completed: Boolean(progress.completed),
    skipped: Boolean(progress.skipped),
    dismissedAt: progress.dismissedAt ? String(progress.dismissedAt) : null,
    version: String(progress.version || ONBOARDING_VERSION),
    completedStepIds: steps.filter((step) => step.done).map((step) => step.id),
    currentStepId,
    currentStep,
    currentIndex,
    steps,
    completedCount,
    totalCount: ONBOARDING_STEPS.length,
    nextStep: currentStep,
    status: progress.completed ? "complete" : "active",
    hidden: Boolean(progress.hidden)
  };
}

export function markOnboardingStepDone(stepId, progress = {}) {
  const normalized = normalizeOnboardingProgress(progress);
  const completed = new Set(normalized.completedStepIds);
  const id = String(stepId || normalized.currentStepId || "").trim();
  if (id && ONBOARDING_STEPS.some((step) => step.id === id)) {
    completed.add(id);
  }
  const nextIndex = Math.min(ONBOARDING_STEPS.length - 1, stepIndexById(id) + 1);
  const isComplete = id === ONBOARDING_STEPS[ONBOARDING_STEPS.length - 1].id;
  return normalizeOnboardingProgress({
    ...normalized,
    completed: isComplete,
    skipped: false,
    dismissedAt: isComplete ? (normalized.dismissedAt || new Date().toISOString()) : normalized.dismissedAt,
    version: ONBOARDING_VERSION,
    currentStepId: isComplete ? "completed" : ONBOARDING_STEPS[nextIndex].id,
    completedStepIds: Array.from(completed)
  });
}

export function completeOnboardingProgress(progress = {}, currentStepId = "completed", options = {}) {
  return normalizeOnboardingProgress({
    ...progress,
    completed: true,
    skipped: Boolean(options.skipped ?? progress.skipped),
    dismissedAt: options.dismissedAt || progress.dismissedAt || new Date().toISOString(),
    version: ONBOARDING_VERSION,
    currentStepId,
    completedStepIds: ONBOARDING_STEPS.map((step) => step.id)
  });
}

export function moveOnboardingProgress(progress = {}, delta = 0) {
  const normalized = normalizeOnboardingProgress(progress);
  const nextIndex = Math.max(0, Math.min(ONBOARDING_STEPS.length - 1, normalized.currentIndex + Number(delta || 0)));
  return normalizeOnboardingProgress({
    ...normalized,
    completed: false,
    skipped: false,
    currentStepId: ONBOARDING_STEPS[nextIndex].id,
    version: ONBOARDING_VERSION
  });
}

export function getNextOnboardingHint(context = {}) {
  const progress = normalizeOnboardingProgress(context.progress || context);
  return progress.currentStep?.task || "Onboarding je dokončený. Město už čekat nebude.";
}

export function shouldAutoStartOnboarding(progress = {}, readModel = {}) {
  const normalized = normalizeOnboardingProgress(progress);
  return !normalized.completed && !isOnboardingDefeated(readModel);
}

export function hideOnboardingPanel() {
  panelState.hidden = true;
  if (panelState.mount) {
    panelState.mount.hidden = true;
  }
  return true;
}

export function showOnboardingPanel() {
  panelState.hidden = false;
  if (panelState.mount) {
    panelState.mount.hidden = false;
  }
  return true;
}

function appendTextElement(ownerDocument, parent, tagName, className, text) {
  const element = createElement(ownerDocument, tagName, className);
  if (!element) {
    return null;
  }
  element.textContent = text;
  parent.append(element);
  return element;
}

function updateHighlight(ownerDocument, target) {
  const body = ownerDocument?.body;
  if (!body) {
    return null;
  }
  let highlight = panelState.highlight || ownerDocument.querySelector?.("[data-onboarding-highlight]");
  if (!highlight) {
    highlight = createElement(ownerDocument, "div", "empire-onboarding-highlight");
    highlight?.setAttribute?.("data-onboarding-highlight", "");
    if (highlight) {
      body.append(highlight);
    }
  }
  panelState.highlight = highlight;
  if (!highlight) {
    return null;
  }
  if (!target?.getBoundingClientRect) {
    highlight.hidden = true;
    return highlight;
  }
  const rect = target.getBoundingClientRect();
  highlight.hidden = false;
  highlight.style.left = `${Math.max(8, rect.left - 8)}px`;
  highlight.style.top = `${Math.max(8, rect.top - 8)}px`;
  highlight.style.width = `${Math.max(34, rect.width + 16)}px`;
  highlight.style.height = `${Math.max(34, rect.height + 16)}px`;
  return highlight;
}

export function renderOnboardingPanel(progress = {}, callbacks = {}, options = {}) {
  const mount = options.mount || panelState.mount;
  if (!mount) {
    return false;
  }

  const ownerDocument = getOwnerDocument(mount);
  const normalized = normalizeOnboardingProgress(progress);
  const readModel = options.readModel || {};
  const root = options.root || mount.parentNode || ownerDocument?.body || null;
  const step = normalized.currentStep || ONBOARDING_STEPS[0];
  const state = resolveOnboardingStepState(step, readModel, root);
  const isDefeated = state.status === "defeated";

  panelState.mount = mount;
  panelState.currentStepId = normalized.currentStepId;
  panelState.hidden = normalized.hidden;
  mount.hidden = normalized.hidden || normalized.completed;
  mount.classList?.add?.("empire-onboarding");
  mount.classList?.add?.("free-onboarding-panel");
  mount.classList?.toggle?.("is-defeated", isDefeated);
  mount.replaceChildren?.();

  if (mount.hidden) {
    updateHighlight(ownerDocument, null);
    return true;
  }

  const header = createElement(ownerDocument, "header", "empire-onboarding__header");
  const eyebrow = createElement(ownerDocument, "span", "empire-onboarding__eyebrow");
  const progressLabel = createElement(ownerDocument, "span", "empire-onboarding__progress");
  const title = createElement(ownerDocument, "h2", "empire-onboarding__title");
  const body = createElement(ownerDocument, "p", "empire-onboarding__body");
  const task = createElement(ownerDocument, "p", "empire-onboarding__task");
  const detail = createElement(ownerDocument, "div", "empire-onboarding__detail");
  const actions = createElement(ownerDocument, "div", "empire-onboarding__actions");
  const backButton = createElement(ownerDocument, "button", "button empire-onboarding__button empire-onboarding__button--ghost");
  const skipButton = createElement(ownerDocument, "button", "button empire-onboarding__button empire-onboarding__button--ghost");
  const neverButton = createElement(ownerDocument, "button", "button empire-onboarding__button empire-onboarding__button--ghost");
  const nextButton = createElement(ownerDocument, "button", "button empire-onboarding__button empire-onboarding__button--primary");

  if (!header || !eyebrow || !progressLabel || !title || !body || !task || !detail || !actions || !backButton || !skipButton || !neverButton || !nextButton) {
    return false;
  }

  eyebrow.textContent = "OPERATOR";
  progressLabel.textContent = isDefeated ? "DEF" : `${Math.min(normalized.currentIndex + 1, normalized.totalCount)}/${normalized.totalCount}`;
  header.append(eyebrow, progressLabel);

  if (isDefeated) {
    title.textContent = "Server tě vyplivl";
    body.textContent = "Tenhle server tě vyplivl a ještě si odplivl. Prohra, ó tragický mistře špatného pořadí. Sleduj mapu jako mrtvý svědek, nebo běž na další server a tentokrát nebuď dole.";
    task.textContent = state.fallback;
  } else {
    title.textContent = step.title;
    body.textContent = step.body;
    task.textContent = state.missingTarget ? state.fallback : (step.task || step.optionalActionHint || "");
  }

  mount.append(header, title, body, task);

  if (!isDefeated && (step.detail || step.optionalActionHint)) {
    const detailLabel = createElement(ownerDocument, "span", "empire-onboarding__detail-label");
    const detailCopy = createElement(ownerDocument, "span", "empire-onboarding__detail-copy");
    if (detailLabel && detailCopy) {
      detailLabel.textContent = "Co si zapamatovat";
      detailCopy.textContent = step.detail || step.optionalActionHint || "";
      detail.append(detailLabel, detailCopy);
      mount.append(detail);
    }
  }

  if ((step.id === "elimination" || step.id === "danger-zone") && readModel.elimination) {
    const meta = createElement(ownerDocument, "div", "empire-onboarding__meta");
    if (meta) {
      appendTextElement(ownerDocument, meta, "span", "", `Další: ${readModel.elimination.nextEliminationLabel || "čeká"}`);
      appendTextElement(ownerDocument, meta, "span", "", readModel.elimination.dangerZoneLabel || "danger zone čeká");
      appendTextElement(ownerDocument, meta, "span", "", `Stav: ${readModel.elimination.currentPlayerStatus || "safe"}`);
      mount.append(meta);
    }
  }

  backButton.type = "button";
  backButton.textContent = "Zpět";
  backButton.disabled = normalized.currentIndex <= 0 || isDefeated;
  backButton.addEventListener?.("click", () => callbacks.onBack?.());

  skipButton.type = "button";
  skipButton.textContent = "Přeskočit";
  skipButton.disabled = step.canSkip === false;
  skipButton.addEventListener?.("click", () => callbacks.onSkip?.());

  neverButton.type = "button";
  neverButton.textContent = "Už nezobrazovat";
  neverButton.addEventListener?.("click", () => callbacks.onDismiss?.());

  nextButton.type = "button";
  nextButton.textContent = isDefeated ? "Zavřít" : (step.cta || "Další");
  nextButton.addEventListener?.("click", () => {
    if (isDefeated) {
      callbacks.onSkip?.();
      return;
    }
    callbacks.onNext?.(step.id);
  });

  actions.append(backButton, skipButton, neverButton, nextButton);
  mount.append(actions);

  const target = state.target || null;
  const targetSelector = state.targetSelector || getOnboardingTargetSelector(step.id, readModel);
  mount.dataset.onboardingStep = step.id;
  mount.dataset.highlight = step.highlightType || "none";
  if (targetSelector) {
    mount.dataset.onboardingTarget = targetSelector;
  }
  updateHighlight(ownerDocument, target);

  return true;
}

export function initOnboardingPanel(context = {}, options = {}) {
  const ownerDocument = options.documentRef || (typeof document !== "undefined" ? document : null);
  const container = options.container || options.root || ownerDocument?.body || null;
  const mount = options.mount || ownerDocument?.querySelector?.("[data-onboarding-panel]");
  const resolvedMount = mount || createElement(ownerDocument, "section", "empire-onboarding");

  if (!resolvedMount || !container) {
    return null;
  }

  resolvedMount.setAttribute?.("data-onboarding-panel", "");
  resolvedMount.setAttribute?.("data-free-onboarding-panel", "");
  resolvedMount.setAttribute?.("aria-label", "Empire Streets onboarding");
  if (!resolvedMount.parentNode && typeof container.append === "function") {
    container.append(resolvedMount);
  }

  panelState.mount = resolvedMount;
  renderOnboardingPanel(context.progress || context, options.callbacks || {}, {
    ...options,
    mount: resolvedMount
  });
  return resolvedMount;
}

if (typeof window !== "undefined") {
  window.EmpireOnboardingPanel = {
    FREE_SESSION_ONBOARDING_STEPS,
    ONBOARDING_STEPS,
    completeOnboardingProgress,
    getNextOnboardingHint,
    hideOnboardingPanel,
    initOnboardingPanel,
    markOnboardingStepDone,
    moveOnboardingProgress,
    normalizeOnboardingProgress,
    renderOnboardingPanel,
    shouldAutoStartOnboarding,
    showOnboardingPanel
  };
}
