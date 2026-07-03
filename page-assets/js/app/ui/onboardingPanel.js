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
import { isModalScrollLocked } from "./modalScrollLock.js";

export { ONBOARDING_STEPS, ONBOARDING_VERSION };
export const FREE_SESSION_ONBOARDING_STEPS = ONBOARDING_STEPS;

const panelState = {
  mount: null,
  highlight: null,
  highlightLabel: null,
  hidden: false,
  currentStepId: "welcome",
  lastFocusedStepId: null
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

function setElementStyle(element, property, value) {
  if (element?.style && property) {
    element.style[property] = value;
  }
}

function resolveStepKind(step = {}) {
  return String(step.kind || step.highlightType || "dirty").trim() || "dirty";
}

function resolveStepPhase(step = {}, index = 0) {
  if (step.phase) {
    return String(step.phase);
  }
  if (index < 4) {
    return "Základy";
  }
  if (index < 8) {
    return "Ekonomika";
  }
  if (index < 11) {
    return "Riziko";
  }
  if (index < 18) {
    return "Expanze";
  }
  return "Endgame";
}

function resolveStepBadge(step = {}) {
  return String(step.badge || step.eyebrow || "STREET").trim() || "STREET";
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function safeScrollIntoView(target) {
  if (!target?.scrollIntoView) {
    return;
  }
  if (isModalScrollLocked(target.ownerDocument)) {
    return;
  }
  try {
    target.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
  } catch {
    try {
      target.scrollIntoView();
    } catch {
      // UI-only helper: missing browser support must not break onboarding.
    }
  }
}

function safeFocus(element) {
  if (!element?.focus) {
    return;
  }
  try {
    element.focus({ preventScroll: true });
  } catch {
    element.focus();
  }
}

function scheduleFocus(mount, stepId) {
  if (!mount || panelState.lastFocusedStepId === stepId) {
    return;
  }
  panelState.lastFocusedStepId = stepId;
  const callback = () => safeFocus(mount.querySelector?.("[data-onboarding-primary-action]") || mount);
  const win = mount.ownerDocument?.defaultView;
  if (win?.requestAnimationFrame) {
    win.requestAnimationFrame(callback);
    return;
  }
  callback();
}

function resetPanelPlacement(mount) {
  if (!mount?.style) {
    return;
  }
  mount.style.left = "";
  mount.style.top = "";
  mount.style.right = "";
  mount.style.bottom = "";
  mount.dataset.placementMode = "default";
}

function positionPanelNearTarget(mount, target, step = {}) {
  const win = mount?.ownerDocument?.defaultView;
  if (!mount?.style || !target?.getBoundingClientRect || !win || win.innerWidth <= 900 || step.highlightType === "map") {
    resetPanelPlacement(mount);
    return;
  }
  const rect = target.getBoundingClientRect();
  const width = mount.offsetWidth || 390;
  const height = mount.offsetHeight || 420;
  const gap = 16;
  const viewportWidth = win.innerWidth || 1024;
  const viewportHeight = win.innerHeight || 768;
  let left = rect.right + gap;
  if (left + width > viewportWidth - gap) {
    left = rect.left - width - gap;
  }
  if (left < gap || left + width > viewportWidth - gap) {
    resetPanelPlacement(mount);
    return;
  }
  const top = clamp(rect.top, gap, Math.max(gap, viewportHeight - height - gap));
  mount.style.left = `${left}px`;
  mount.style.top = `${top}px`;
  mount.style.right = "auto";
  mount.style.bottom = "auto";
  mount.dataset.placementMode = "anchored";
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
    panelState.mount.onkeydown = null;
    resetPanelPlacement(panelState.mount);
  }
  if (panelState.highlight) {
    panelState.highlight.hidden = true;
  }
  if (panelState.highlightLabel) {
    panelState.highlightLabel.hidden = true;
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

function getBattleRoyaleOperatorRows(readModel = {}) {
  const finalLockdown = readModel.finalLockdown || {};
  if (finalLockdown.active) {
    return [
      ["Fáze", "Final Lockdown"],
      ["Čas", finalLockdown.remainingLabel || "čeká se"],
      ["Rank", finalLockdown.rankLabel || "-"],
      ["Top 3", finalLockdown.top3Gap || "-"],
      ["Plán", finalLockdown.top3Gap === "drž pozici" ? "Udrž score, neplýtvej riskem." : "Zvyš Final Empire Score a přibliž se Top 3."]
    ];
  }

  const elimination = readModel.elimination || {};
  const activePlayers = elimination.activePlayersRemaining
    ? `${elimination.activePlayersRemaining}/${elimination.maxPlayersPerServer || 20}`
    : "-";
  const nextLabel = elimination.eliminationsStopped
    ? "zastaveno, čeká se na finále"
    : elimination.nextEliminationLabel || "čeká se";
  const plan = elimination.currentPlayerStatus === "critical"
    ? "Okamžitě zvedni score: district, influence, budovy."
    : elimination.currentPlayerStatus === "danger"
      ? "Zvedni score před další očistou."
      : "Drž tempo a sleduj další očistu.";

  return [
    ["Fáze", "Free Battle Royale"],
    ["Očista", nextLabel],
    ["Stav", String(elimination.currentPlayerStatus || "safe").toUpperCase()],
    ["Hráči", activePlayers],
    ["Danger", elimination.dangerZoneLabel || "čeká na server"],
    ["Plán", plan]
  ];
}

function updateHighlight(ownerDocument, target, step = {}) {
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
  let label = panelState.highlightLabel || ownerDocument.querySelector?.("[data-onboarding-target-label]");
  if (!label) {
    label = createElement(ownerDocument, "div", "empire-onboarding-target-label");
    label?.setAttribute?.("data-onboarding-target-label", "");
    if (label) {
      body.append(label);
    }
  }
  panelState.highlightLabel = label;
  if (!target?.getBoundingClientRect) {
    highlight.hidden = true;
    if (label) {
      label.hidden = true;
    }
    return highlight;
  }
  safeScrollIntoView(target);
  const rect = target.getBoundingClientRect();
  const viewportWidth = ownerDocument.defaultView?.innerWidth || 1024;
  const viewportHeight = ownerDocument.defaultView?.innerHeight || 768;
  const padding = viewportWidth <= 720 ? 6 : 8;
  const left = clamp(rect.left - padding, 6, Math.max(6, viewportWidth - 42));
  const top = clamp(rect.top - padding, 6, Math.max(6, viewportHeight - 42));
  const width = Math.min(Math.max(38, rect.width + padding * 2), Math.max(42, viewportWidth - left - 6));
  const height = Math.min(Math.max(38, rect.height + padding * 2), Math.max(42, viewportHeight - top - 6));
  highlight.hidden = false;
  highlight.dataset.highlightKind = resolveStepKind(step);
  setElementStyle(highlight, "left", `${left}px`);
  setElementStyle(highlight, "top", `${top}px`);
  setElementStyle(highlight, "width", `${width}px`);
  setElementStyle(highlight, "height", `${height}px`);
  if (label) {
    label.hidden = false;
    label.textContent = step.targetLabel || "Tady, ty génie";
    label.dataset.highlightKind = resolveStepKind(step);
    setElementStyle(label, "left", `${clamp(left, 8, Math.max(8, viewportWidth - 158))}px`);
    setElementStyle(label, "top", `${clamp(top - 30, 8, Math.max(8, viewportHeight - 34))}px`);
  }
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
  const stepNumber = Math.min(normalized.currentIndex + 1, normalized.totalCount);
  const progressPercent = normalized.totalCount > 0 ? Math.round((stepNumber / normalized.totalCount) * 100) : 0;
  const stepKind = isDefeated ? "defeated" : resolveStepKind(step);
  const phaseLabel = isDefeated ? "Defeated" : resolveStepPhase(step, normalized.currentIndex);
  const badgeLabel = isDefeated ? "OUT" : resolveStepBadge(step);

  panelState.mount = mount;
  panelState.currentStepId = normalized.currentStepId;
  panelState.hidden = normalized.hidden;
  mount.hidden = normalized.hidden || normalized.completed;
  mount.classList?.add?.("empire-onboarding");
  mount.classList?.add?.("free-onboarding-panel");
  mount.classList?.toggle?.("is-defeated", isDefeated);
  mount.classList?.toggle?.("is-fallback", Boolean(state.missingTarget));
  mount.classList?.toggle?.("has-target", Boolean(state.target));
  mount.dataset.kind = stepKind;
  mount.setAttribute?.("role", "dialog");
  mount.setAttribute?.("aria-modal", "false");
  mount.setAttribute?.("aria-live", "polite");
  mount.setAttribute?.("tabindex", "-1");
  if (typeof mount.replaceChildren === "function") {
    mount.replaceChildren();
  } else {
    mount.textContent = "";
  }

  if (mount.hidden) {
    updateHighlight(ownerDocument, null);
    resetPanelPlacement(mount);
    return true;
  }

  const header = createElement(ownerDocument, "header", "empire-onboarding__header");
  const identity = createElement(ownerDocument, "div", "empire-onboarding__identity");
  const eyebrow = createElement(ownerDocument, "span", "empire-onboarding__eyebrow");
  const phase = createElement(ownerDocument, "span", "empire-onboarding__phase");
  const progressLabel = createElement(ownerDocument, "span", "empire-onboarding__progress");
  const progressTrack = createElement(ownerDocument, "div", "empire-onboarding__progress-track");
  const progressFill = createElement(ownerDocument, "span", "empire-onboarding__progress-fill");
  const badgeRow = createElement(ownerDocument, "div", "empire-onboarding__badge-row");
  const badge = createElement(ownerDocument, "span", "empire-onboarding__badge");
  const statusChip = createElement(ownerDocument, "span", "empire-onboarding__status-chip");
  const title = createElement(ownerDocument, "h2", "empire-onboarding__title");
  const subtitle = createElement(ownerDocument, "p", "empire-onboarding__subtitle");
  const content = createElement(ownerDocument, "div", "empire-onboarding__content");
  const body = createElement(ownerDocument, "p", "empire-onboarding__body");
  const fallback = createElement(ownerDocument, "div", "empire-onboarding__fallback");
  const fallbackTitle = createElement(ownerDocument, "strong", "empire-onboarding__fallback-title");
  const fallbackBody = createElement(ownerDocument, "span", "empire-onboarding__fallback-copy");
  const task = createElement(ownerDocument, "p", "empire-onboarding__task");
  const detail = createElement(ownerDocument, "div", "empire-onboarding__detail");
  const warning = createElement(ownerDocument, "div", "empire-onboarding__warning");
  const actions = createElement(ownerDocument, "div", "empire-onboarding__actions");
  const backButton = createElement(ownerDocument, "button", "button empire-onboarding__button empire-onboarding__button--ghost");
  const skipButton = createElement(ownerDocument, "button", "button empire-onboarding__button empire-onboarding__button--ghost");
  const neverButton = createElement(ownerDocument, "button", "button empire-onboarding__button empire-onboarding__button--danger");
  const nextButton = createElement(ownerDocument, "button", "button empire-onboarding__button empire-onboarding__button--primary");

  if (!header || !identity || !eyebrow || !phase || !progressLabel || !progressTrack || !progressFill || !badgeRow || !badge || !statusChip || !title || !subtitle || !content || !body || !fallback || !fallbackTitle || !fallbackBody || !task || !detail || !warning || !actions || !backButton || !skipButton || !neverButton || !nextButton) {
    return false;
  }

  mount.setAttribute?.("aria-describedby", "empire-onboarding-copy");
  eyebrow.textContent = isDefeated ? "OPERATOR OFFLINE" : "KANÁLOVÝ OPERÁTOR";
  phase.textContent = phaseLabel;
  identity.append(eyebrow, phase);
  progressLabel.textContent = isDefeated ? "DEF" : `Krok ${stepNumber} / ${normalized.totalCount}`;
  setElementStyle(progressFill, "width", isDefeated ? "100%" : `${progressPercent}%`);
  progressTrack.append(progressFill);
  header.append(identity, progressLabel);
  badge.textContent = badgeLabel;
  statusChip.textContent = state.missingTarget ? "Fallback" : (state.target ? "Target locked" : "Info");
  badgeRow.append(badge, statusChip);

  if (isDefeated) {
    title.textContent = "Server tě vyplivl";
    subtitle.textContent = "Jsi mimo hru, králi popelnice.";
    body.textContent = "Tenhle server tě vyplivl a ještě si otřel boty. Tutorial tě nebude tahat za mrtvolu po mapě.";
    task.textContent = state.fallback;
  } else {
    title.textContent = step.title;
    subtitle.textContent = step.subtitle || step.optionalActionHint || "";
    body.textContent = step.body;
    task.textContent = state.missingTarget
      ? (step.task || step.optionalActionHint || "")
      : (step.task || step.taskLabel || step.optionalActionHint || "");
  }

  body.id = "empire-onboarding-copy";
  content.append(body);

  if (!isDefeated && state.missingTarget) {
    fallbackTitle.textContent = state.fallbackTitle || step.fallbackTitle || "Target se schoval.";
    fallbackBody.textContent = state.fallback || step.fallbackBody || "Tahle část UI teď není dostupná. Pokračuj dál, core pravidla se nemění.";
    fallback.append(fallbackTitle, fallbackBody);
    content.append(fallback);
  }

  if (task.textContent) {
    const taskLabel = createElement(ownerDocument, "span", "empire-onboarding__task-label");
    if (taskLabel) {
      taskLabel.textContent = isDefeated ? "Verdikt" : (step.taskLabel || "Teď udělej");
      task.prepend?.(taskLabel);
    }
    content.append(task);
  }

  mount.append(header, progressTrack, badgeRow, title, subtitle, content);

  if (!isDefeated && (step.detail || step.tip || step.optionalActionHint)) {
    const detailLabel = createElement(ownerDocument, "span", "empire-onboarding__detail-label");
    const detailCopy = createElement(ownerDocument, "span", "empire-onboarding__detail-copy");
    if (detailLabel && detailCopy) {
      detailLabel.textContent = "Co si zapamatovat";
      detailCopy.textContent = step.detail || step.tip || step.optionalActionHint || "";
      detail.append(detailLabel, detailCopy);
      content.append(detail);
    }
  }

  if (!isDefeated && step.warning) {
    warning.textContent = step.warning;
    content.append(warning);
  }

  if ((step.id === "elimination" || step.id === "danger-zone") && readModel.elimination) {
    const meta = createElement(ownerDocument, "div", "empire-onboarding__meta");
    if (meta) {
      for (const [label, value] of getBattleRoyaleOperatorRows(readModel)) {
        const row = appendTextElement(ownerDocument, meta, "span", "empire-onboarding__meta-row", "");
        if (row) {
          appendTextElement(ownerDocument, row, "strong", "empire-onboarding__meta-label", label);
          appendTextElement(ownerDocument, row, "span", "empire-onboarding__meta-value", value);
        }
      }
      content.append(meta);
    }
  }

  backButton.type = "button";
  backButton.textContent = "Zpět";
  backButton.setAttribute("aria-label", "Vrátit onboarding o krok zpět");
  backButton.disabled = normalized.currentIndex <= 0 || isDefeated;
  backButton.addEventListener?.("click", () => callbacks.onBack?.());

  skipButton.type = "button";
  skipButton.textContent = "Přeskočit";
  skipButton.setAttribute("aria-label", "Přeskočit onboarding");
  skipButton.disabled = step.canSkip === false;
  skipButton.addEventListener?.("click", () => callbacks.onSkip?.());

  neverButton.type = "button";
  neverButton.textContent = "Už nezobrazovat";
  neverButton.setAttribute("aria-label", "Dokončit onboarding a už ho automaticky nezobrazovat");
  neverButton.addEventListener?.("click", () => callbacks.onDismiss?.());

  nextButton.type = "button";
  nextButton.textContent = isDefeated ? "Zavřít" : (step.cta || "Další");
  nextButton.setAttribute("aria-label", isDefeated ? "Zavřít defeated hlášku" : "Pokračovat na další onboarding krok");
  nextButton.setAttribute("data-onboarding-primary-action", "");
  nextButton.addEventListener?.("click", () => {
    if (isDefeated) {
      callbacks.onSkip?.();
      return;
    }
    callbacks.onNext?.(step.id);
  });

  if (isDefeated) {
    actions.append(neverButton, nextButton);
  } else {
    actions.append(backButton, skipButton, neverButton, nextButton);
  }
  mount.append(actions);
  mount.onkeydown = (event) => {
    if (event?.key !== "Escape") {
      return;
    }
    if (!isDefeated && step.canSkip === false) {
      return;
    }
    event.preventDefault?.();
    callbacks.onSkip?.();
  };

  const target = state.target || null;
  const targetSelector = state.targetSelector || getOnboardingTargetSelector(step.id, readModel);
  mount.dataset.onboardingStep = step.id;
  mount.dataset.highlight = step.highlightType || "none";
  if (targetSelector) {
    mount.dataset.onboardingTarget = targetSelector;
  } else if (mount.dataset.onboardingTarget) {
    delete mount.dataset.onboardingTarget;
  }
  updateHighlight(ownerDocument, target, step);
  positionPanelNearTarget(mount, target, step);
  scheduleFocus(mount, normalized.currentStepId);

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
