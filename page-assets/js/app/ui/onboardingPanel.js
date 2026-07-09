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

const ONBOARDING_WELCOME_SCROLL_CLASS = "is-onboarding-welcome-scroll";
const ONBOARDING_GUIDED_SCROLL_CLASS = "is-onboarding-guided-scroll";
const ONBOARDING_LOCKED_SCROLL_CLASS = "is-onboarding-scroll-locked";
const ONBOARDING_FOCUS_TARGET_CLASS = "is-onboarding-focus-target";

const panelState = {
  mount: null,
  backdrop: null,
  highlight: null,
  extraHighlights: [],
  mapHighlights: [],
  mapHighlightLayer: null,
  highlightLabel: null,
  focusTargets: [],
  hidden: false,
  currentStepId: "welcome",
  lastFocusedStepId: null,
  lastPageTopStepId: null
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

function createSvgElement(ownerDocument, tagName, className = "") {
  const element = ownerDocument?.createElementNS?.("http://www.w3.org/2000/svg", tagName);
  if (element && className) {
    element.setAttribute("class", className);
  }
  return element || null;
}

function setElementStyle(element, property, value) {
  if (element?.style && property) {
    element.style[property] = value;
  }
}

function setDocumentScrollMode(ownerDocument, mode = "none") {
  const root = ownerDocument?.documentElement || null;
  const body = ownerDocument?.body || null;
  for (const element of [root, body]) {
    if (!element?.classList) {
      continue;
    }
    element.classList.toggle(ONBOARDING_WELCOME_SCROLL_CLASS, mode === "page");
    element.classList.toggle(ONBOARDING_GUIDED_SCROLL_CLASS, mode === "guided");
    element.classList.toggle(ONBOARDING_LOCKED_SCROLL_CLASS, mode === "locked");
    if (mode === "none") {
      delete element.dataset.onboardingScroll;
    } else {
      element.dataset.onboardingScroll = mode;
    }
  }
}

function setDocumentOnboardingStep(ownerDocument, stepId = "") {
  const root = ownerDocument?.documentElement || null;
  const body = ownerDocument?.body || null;
  const safeStepId = String(stepId || "").trim();
  for (const element of [root, body]) {
    if (!element?.dataset) {
      continue;
    }
    if (safeStepId) {
      element.dataset.onboardingStep = safeStepId;
    } else {
      delete element.dataset.onboardingStep;
    }
  }
}

function setDocumentOnboardingMapMode(ownerDocument, mode = "") {
  const root = ownerDocument?.documentElement || null;
  const body = ownerDocument?.body || null;
  const safeMode = String(mode || "").trim();
  for (const element of [root, body]) {
    if (!element?.dataset) {
      continue;
    }
    if (safeMode) {
      element.dataset.onboardingMapMode = safeMode;
    } else {
      delete element.dataset.onboardingMapMode;
    }
  }
}

function resolveStepKind(step = {}) {
  return String(step.kind || step.highlightType || "dirty").trim() || "dirty";
}

function isManualCompletionStep(step = {}) {
  return !step.completionCondition || step.completionCondition === "manual";
}

function shouldRenderPrimaryAction(step = {}, isDefeated = false) {
  return isDefeated || !["spy", "attack-order"].includes(step.id);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function safeScrollIntoView(target, options = {}) {
  if (!target?.scrollIntoView) {
    return;
  }
  if (isModalScrollLocked(target.ownerDocument)) {
    return;
  }
  const prefersReducedMotion = Boolean(target.ownerDocument?.defaultView?.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
  try {
    target.scrollIntoView({
      block: options.block || "center",
      inline: options.inline || "center",
      behavior: options.behavior || (prefersReducedMotion ? "auto" : "smooth")
    });
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

function safeScrollPageToTop(ownerDocument, options = {}) {
  const win = ownerDocument?.defaultView;
  if (!ownerDocument || isModalScrollLocked(ownerDocument)) {
    return false;
  }
  const prefersReducedMotion = Boolean(win?.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
  const behavior = options.behavior || (prefersReducedMotion ? "auto" : "smooth");
  const scrollTo = win?.scrollTo;
  const canUseWindowScrollTo = typeof scrollTo === "function" && !String(scrollTo).includes("notImplementedMethod");
  if (canUseWindowScrollTo) {
    try {
      scrollTo.call(win, { top: 0, left: 0, behavior });
    } catch {
      try {
        scrollTo.call(win, 0, 0);
      } catch {
        // UI-only helper: scroll restoration must not break onboarding rendering.
      }
    }
  }

  for (const element of [ownerDocument.scrollingElement, ownerDocument.documentElement, ownerDocument.body]) {
    if (!element) {
      continue;
    }
    try {
      element.scrollTop = 0;
      element.scrollLeft = 0;
    } catch {
      // Some browser/document shims expose read-only scroll positions.
    }
  }
  return true;
}

function shouldScrollFocusIntoView(ownerDocument, step = {}) {
  const maxWidth = Number(step.scrollFocusMaxWidth || 0);
  if (!Number.isFinite(maxWidth) || maxWidth <= 0) {
    return true;
  }
  const viewportWidth = ownerDocument?.defaultView?.innerWidth || 1024;
  return viewportWidth <= maxWidth;
}

function clearFocusTargets() {
  for (const target of panelState.focusTargets || []) {
    target?.classList?.remove?.(ONBOARDING_FOCUS_TARGET_CLASS);
  }
  panelState.focusTargets = [];
}

function resolveTargetElement(ownerDocument, root, selector = "") {
  const safeSelector = String(selector || "").trim();
  if (!safeSelector) {
    return null;
  }
  try {
    return root?.querySelector?.(safeSelector) || ownerDocument?.querySelector?.(safeSelector) || null;
  } catch {
    return null;
  }
}

function resolveTargetElements(ownerDocument, root, selector = "") {
  const safeSelector = String(selector || "").trim();
  if (!safeSelector) {
    return [];
  }
  const targets = [];
  for (const scope of [root, ownerDocument]) {
    try {
      for (const target of scope?.querySelectorAll?.(safeSelector) || []) {
        if (target && !targets.includes(target)) {
          targets.push(target);
        }
      }
    } catch {
      // UI-only helper: an invalid optional selector must not break onboarding.
    }
  }
  return targets;
}

function resolveFocusTargets(ownerDocument, root, step = {}, primaryTarget = null) {
  const selectors = asArray(step.focusSelectors).map((selector) => String(selector || "").trim()).filter(Boolean);
  const targets = [];
  if (selectors.length === 0 && primaryTarget) {
    targets.push(primaryTarget);
  }
  for (const selector of selectors) {
    for (const target of resolveTargetElements(ownerDocument, root, selector)) {
      if (target && !targets.includes(target)) {
        targets.push(target);
      }
    }
  }
  return targets;
}

function updateFocusTargetClasses(targets = [], step = {}) {
  clearFocusTargets();
  if (!step.raiseFocusTargets) {
    return;
  }
  panelState.focusTargets = asArray(targets).filter(Boolean);
  for (const target of panelState.focusTargets) {
    target.classList?.add?.(ONBOARDING_FOCUS_TARGET_CLASS);
  }
}

function positionHighlightElement(ownerDocument, highlight, target, step = {}) {
  if (!highlight || !target?.getBoundingClientRect) {
    return false;
  }
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
  return { left, top, width, height, viewportWidth, viewportHeight };
}

function renderStepTitle(titleElement, ownerDocument, step = {}) {
  const titleText = String(step.title || "").trim();
  if (step.id !== "welcome" || !titleText || typeof titleElement?.replaceChildren !== "function") {
    titleElement.textContent = titleText;
    return;
  }
  const accentText = "streets";
  const accentIndex = titleText.toLowerCase().lastIndexOf(accentText);
  if (accentIndex < 0) {
    titleElement.textContent = titleText;
    return;
  }
  const accent = createElement(ownerDocument, "span", "empire-onboarding__title-accent");
  if (!accent) {
    titleElement.textContent = titleText;
    return;
  }
  accent.textContent = titleText.slice(accentIndex);
  titleElement.replaceChildren(
    ownerDocument.createTextNode(titleText.slice(0, accentIndex)),
    accent
  );
}

function appendTextWithHighlights(ownerDocument, parent, text = "", highlights = []) {
  const safeText = String(text || "");
  const appendText = (value) => {
    const textValue = String(value || "");
    if (typeof ownerDocument?.createTextNode === "function") {
      parent.append(ownerDocument.createTextNode(textValue));
      return;
    }
    parent.append(textValue);
  };
  const entries = asArray(highlights)
    .map((entry) => ({
      text: String(entry?.text || "").trim(),
      tone: String(entry?.tone || "gold").trim() || "gold"
    }))
    .filter((entry) => entry.text);

  if (entries.length === 0) {
    appendText(safeText);
    return;
  }

  let cursor = 0;
  while (cursor < safeText.length) {
    let nextMatch = null;
    for (const entry of entries) {
      const index = safeText.toLocaleLowerCase("cs-CZ").indexOf(entry.text.toLocaleLowerCase("cs-CZ"), cursor);
      if (index < 0) {
        continue;
      }
      if (!nextMatch || index < nextMatch.index || (index === nextMatch.index && entry.text.length > nextMatch.entry.text.length)) {
        nextMatch = { index, entry };
      }
    }

    if (!nextMatch) {
      appendText(safeText.slice(cursor));
      break;
    }

    if (nextMatch.index > cursor) {
      appendText(safeText.slice(cursor, nextMatch.index));
    }

    const accent = createElement(ownerDocument, "span", "empire-onboarding__body-accent");
    if (!accent) {
      appendText(safeText.slice(nextMatch.index, nextMatch.index + nextMatch.entry.text.length));
    } else {
      accent.dataset.tone = nextMatch.entry.tone;
      accent.textContent = safeText.slice(nextMatch.index, nextMatch.index + nextMatch.entry.text.length);
      parent.append(accent);
    }
    cursor = nextMatch.index + nextMatch.entry.text.length;
  }
}

function renderStepBody(bodyElement, ownerDocument, step = {}, fallbackText = "") {
  if (!bodyElement || !ownerDocument) {
    return false;
  }
  const paragraphs = asArray(step.bodyParagraphs)
    .map((paragraph) => String(paragraph || "").trim())
    .filter(Boolean);
  const resolvedParagraphs = paragraphs.length > 0
    ? paragraphs
    : [String(fallbackText || step.body || "").trim()].filter(Boolean);
  if (typeof bodyElement.replaceChildren === "function") {
    bodyElement.replaceChildren();
  } else {
    bodyElement.textContent = "";
  }

  for (const [index, paragraphText] of resolvedParagraphs.entries()) {
    const paragraph = createElement(ownerDocument, "p", "empire-onboarding__body-paragraph");
    if (!paragraph) {
      continue;
    }
    appendTextWithHighlights(ownerDocument, paragraph, paragraphText, step.bodyHighlights);
    bodyElement.append(paragraph);
    if (index < resolvedParagraphs.length - 1) {
      if (typeof ownerDocument.createTextNode === "function") {
        bodyElement.append(ownerDocument.createTextNode("\n"));
      } else {
        bodyElement.append("\n");
      }
    }
  }
  return true;
}

function scheduleFocus(mount, stepId) {
  if (!mount || panelState.lastFocusedStepId === stepId) {
    return;
  }
  panelState.lastFocusedStepId = stepId;
  const callback = () => safeFocus(
    mount.querySelector?.("[data-onboarding-primary-action]")
    || mount.querySelector?.("[data-onboarding-back-action]")
    || mount.querySelector?.("[data-onboarding-skip-action]")
    || mount
  );
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
  if (!mount?.style || !target?.getBoundingClientRect || !win || win.innerWidth <= 900 || step.highlightType === "map" || step.placement === "center") {
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
  return ONBOARDING_STEPS.find((step) => !completed.has(step.id))?.id || "welcome";
}

export function normalizeOnboardingProgress(progress = {}) {
  const completedStepIds = asArray(progress.completedStepIds)
    .map(String)
    .filter(Boolean);
  const observedStepIds = asArray(progress.observedStepIds)
    .map(String)
    .filter((stepId) => ONBOARDING_STEPS.some((step) => step.id === stepId));
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
    observedStepIds: Array.from(new Set(observedStepIds)),
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
    completedStepIds: Array.from(completed),
    observedStepIds: normalized.observedStepIds
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
    completedStepIds: ONBOARDING_STEPS.map((step) => step.id),
    observedStepIds: ONBOARDING_STEPS.map((step) => step.id)
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
    version: ONBOARDING_VERSION,
    observedStepIds: normalized.observedStepIds
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
    setDocumentScrollMode(panelState.mount.ownerDocument, "none");
    setDocumentOnboardingStep(panelState.mount.ownerDocument, "");
    setDocumentOnboardingMapMode(panelState.mount.ownerDocument, "");
    resetPanelPlacement(panelState.mount);
  }
  if (panelState.highlight) {
    panelState.highlight.hidden = true;
  }
  for (const highlight of panelState.extraHighlights || []) {
    if (highlight) {
      highlight.hidden = true;
    }
  }
  clearFocusTargets();
  if (panelState.highlightLabel) {
    panelState.highlightLabel.hidden = true;
  }
  hideMapDistrictHighlights(panelState.mount?.ownerDocument || null);
  if (panelState.backdrop) {
    panelState.backdrop.hidden = true;
    panelState.backdrop.classList?.remove?.("is-visible");
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

function updateHighlight(ownerDocument, target, step = {}) {
  const body = ownerDocument?.body;
  if (!body) {
    return null;
  }
  let highlight = panelState.highlight?.ownerDocument === ownerDocument ? panelState.highlight : null;
  highlight ||= ownerDocument.querySelector?.("[data-onboarding-highlight]");
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
  let label = panelState.highlightLabel?.ownerDocument === ownerDocument ? panelState.highlightLabel : null;
  label ||= ownerDocument.querySelector?.("[data-onboarding-target-label]");
  if (!label) {
    label = createElement(ownerDocument, "div", "empire-onboarding-target-label");
    label?.setAttribute?.("data-onboarding-target-label", "");
    label?.setAttribute?.("data-onboarding-highlight-label", "");
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
  if (!step.focusSelectors) {
    safeScrollIntoView(target);
  }
  const rect = positionHighlightElement(ownerDocument, highlight, target, step);
  if (!rect) {
    highlight.hidden = true;
    if (label) {
      label.hidden = true;
    }
    return highlight;
  }
  if (label) {
    label.hidden = false;
    label.textContent = step.targetLabel || "Tady začni";
    label.dataset.highlightKind = resolveStepKind(step);
    setElementStyle(label, "left", `${clamp(rect.left, 8, Math.max(8, rect.viewportWidth - 158))}px`);
    setElementStyle(label, "top", `${clamp(rect.top - 30, 8, Math.max(8, rect.viewportHeight - 34))}px`);
  }
  return highlight;
}

function updateExtraHighlights(ownerDocument, targets = [], step = {}) {
  const body = ownerDocument?.body;
  if (!body) {
    return [];
  }
  const safeTargets = asArray(targets).filter((target) => target?.getBoundingClientRect);
  const highlights = panelState.extraHighlights || [];
  while (highlights.length < safeTargets.length) {
    const highlight = createElement(ownerDocument, "div", "empire-onboarding-highlight empire-onboarding-highlight--multi");
    highlight?.setAttribute?.("data-onboarding-highlight-extra", "");
    if (highlight) {
      body.append(highlight);
      highlights.push(highlight);
    } else {
      break;
    }
  }
  for (const [index, highlight] of highlights.entries()) {
    const target = safeTargets[index] || null;
    if (!target) {
      highlight.hidden = true;
      continue;
    }
    positionHighlightElement(ownerDocument, highlight, target, step);
  }
  panelState.extraHighlights = highlights;
  return highlights;
}

function hideMapDistrictHighlights(ownerDocument = null) {
  const knownHighlights = asArray(panelState.mapHighlights).filter(Boolean);
  const documentHighlights = ownerDocument
    ? Array.from(ownerDocument.querySelectorAll?.("[data-onboarding-map-district-highlight]") || [])
    : [];
  for (const highlight of [...knownHighlights, ...documentHighlights]) {
    if (highlight) {
      highlight.hidden = true;
    }
  }
  const layer = panelState.mapHighlightLayer?.ownerDocument === ownerDocument
    ? panelState.mapHighlightLayer
    : ownerDocument?.querySelector?.("[data-onboarding-map-district-highlight-layer]");
  if (layer) {
    layer.hidden = true;
    if (typeof layer.replaceChildren === "function") {
      layer.replaceChildren();
    } else {
      layer.textContent = "";
    }
  }
  panelState.mapHighlights = knownHighlights;
}

function resolveMapNavigationController(ownerDocument, root) {
  const win = ownerDocument?.defaultView || null;
  return win?.empireStreetsMapNavigation
    || root?.empireStreetsMapNavigation
    || resolveTargetElement(ownerDocument, root, "[data-map-viewport]")?.empireStreetsMapNavigation
    || resolveTargetElement(ownerDocument, root, "[data-map-canvas]")?.empireStreetsMapNavigation
    || null;
}

function applyMapViewMode(ownerDocument, root, step = {}) {
  const mode = String(step.mapViewMode || "").trim();
  setDocumentOnboardingMapMode(ownerDocument, mode);
  if (mode !== "zoom-out") {
    return false;
  }
  const controller = resolveMapNavigationController(ownerDocument, root);
  if (typeof controller?.resetZoom === "function") {
    return controller.resetZoom();
  }
  return false;
}

function resolveMapCanvas(ownerDocument, root) {
  return resolveTargetElement(
    ownerDocument,
    root,
    "[data-district-canvas], [data-testid=\"district-canvas\"], .map-district-canvas"
  );
}

function resolveMapDistrict(ownerDocument, districtId) {
  const normalizedDistrictId = Number(districtId);
  if (!Number.isFinite(normalizedDistrictId)) {
    return null;
  }
  const api = ownerDocument?.defaultView?.empireStreetsDistrictState || null;
  if (typeof api?.getDistrictById === "function") {
    const district = api.getDistrictById(normalizedDistrictId);
    if (district) {
      return district;
    }
  }
  if (typeof api?.getAllDistricts === "function") {
    return asArray(api.getAllDistricts()).find((district) => Number(district?.id) === normalizedDistrictId) || null;
  }
  return null;
}

function getDistrictPolygonPoints(district = {}) {
  return asArray(district.polygon)
    .map((point) => {
      const x = Number(point?.x);
      const y = Number(point?.y);
      return Number.isFinite(x) && Number.isFinite(y) ? `${x},${y}` : "";
    })
    .filter(Boolean)
    .join(" ");
}

function ensureMapHighlightLayer(ownerDocument, body) {
  let layer = panelState.mapHighlightLayer?.ownerDocument === ownerDocument
    ? panelState.mapHighlightLayer
    : null;
  layer ||= ownerDocument.querySelector?.("[data-onboarding-map-district-highlight-layer]");
  if (!layer) {
    layer = createSvgElement(ownerDocument, "svg", "empire-onboarding-map-highlight-layer");
    layer?.setAttribute?.("data-onboarding-map-district-highlight-layer", "");
    layer?.setAttribute?.("aria-hidden", "true");
    layer?.setAttribute?.("focusable", "false");
    if (layer) {
      body.append(layer);
    }
  }
  panelState.mapHighlightLayer = layer;
  return layer;
}

function updateMapDistrictHighlights(ownerDocument, root, step = {}) {
  const entries = asArray(step.mapDistrictHighlights)
    .filter((entry) => Number.isFinite(Number(entry?.districtId)));
  if (entries.length === 0) {
    hideMapDistrictHighlights(ownerDocument);
    return [];
  }

  const body = ownerDocument?.body || null;
  const canvas = resolveMapCanvas(ownerDocument, root);
  if (!body || !canvas?.getBoundingClientRect) {
    hideMapDistrictHighlights(ownerDocument);
    return [];
  }

  const rect = canvas.getBoundingClientRect();
  const canvasWidth = Math.max(1, Number(canvas.width || rect.width || 1600));
  const canvasHeight = Math.max(1, Number(canvas.height || rect.height || 980));
  const layer = ensureMapHighlightLayer(ownerDocument, body);
  if (!layer) {
    hideMapDistrictHighlights(ownerDocument);
    return [];
  }

  layer.hidden = false;
  layer.setAttribute("viewBox", `0 0 ${canvasWidth} ${canvasHeight}`);
  layer.setAttribute("preserveAspectRatio", "none");
  layer.dataset.mapCanvasWidth = String(canvasWidth);
  layer.dataset.mapCanvasHeight = String(canvasHeight);
  layer.dataset.mapCanvasLeft = String(rect.left);
  layer.dataset.mapCanvasTop = String(rect.top);
  layer.dataset.mapCanvasRectWidth = String(rect.width);
  layer.dataset.mapCanvasRectHeight = String(rect.height);
  setElementStyle(layer, "left", `${rect.left}px`);
  setElementStyle(layer, "top", `${rect.top}px`);
  setElementStyle(layer, "width", `${Math.max(1, rect.width)}px`);
  setElementStyle(layer, "height", `${Math.max(1, rect.height)}px`);
  if (typeof layer.replaceChildren === "function") {
    layer.replaceChildren();
  } else {
    layer.textContent = "";
  }

  const highlights = [];
  for (const entry of entries) {
    const district = resolveMapDistrict(ownerDocument, entry.districtId);
    const points = getDistrictPolygonPoints(district);
    if (!district || !points) {
      continue;
    }

    const tone = String(entry.tone || "neon").trim().toLowerCase() === "pulse" ? "pulse" : "neon";
    const group = createSvgElement(ownerDocument, "g", `empire-onboarding-map-highlight empire-onboarding-map-highlight--${tone}`);
    const glow = createSvgElement(ownerDocument, "polygon", "empire-onboarding-map-highlight__glow");
    const line = createSvgElement(ownerDocument, "polygon", "empire-onboarding-map-highlight__line");
    if (!group || !glow || !line) {
      continue;
    }

    group.setAttribute("data-onboarding-map-district-highlight", "");
    group.setAttribute("data-onboarding-map-district-id", String(entry.districtId));
    group.setAttribute("data-tone", tone);
    group.setAttribute("data-label", String(entry.label || `District ${entry.districtId}`));
    group.setAttribute("aria-hidden", "true");
    group.hidden = false;
    for (const polygon of [glow, line]) {
      polygon.setAttribute("points", points);
      polygon.setAttribute("vector-effect", "non-scaling-stroke");
    }
    group.append(glow, line);
    layer.append(group);
    highlights.push(group);
  }

  panelState.mapHighlights = highlights;
  return highlights;
}

function getFocusBackdropRect(ownerDocument, root, step = {}, focusTargets = []) {
  const selector = String(step.focusBackdropHoleSelector || "").trim();
  if (!selector) {
    return null;
  }
  const target = selector ? resolveTargetElement(ownerDocument, root, selector) : null;
  const fallbackTarget = asArray(focusTargets).find((entry) => entry?.getBoundingClientRect) || null;
  const source = target || fallbackTarget;
  if (!source?.getBoundingClientRect) {
    return null;
  }
  const rect = source.getBoundingClientRect();
  const viewportWidth = ownerDocument?.defaultView?.innerWidth || 1024;
  const viewportHeight = ownerDocument?.defaultView?.innerHeight || 768;
  const padding = Math.max(0, Number(step.focusBackdropPadding ?? 10) || 0);
  const left = clamp(rect.left - padding, 0, viewportWidth);
  const top = clamp(rect.top - padding, 0, viewportHeight);
  const right = clamp(rect.right + padding, 0, viewportWidth);
  const bottom = clamp(rect.bottom + padding, 0, viewportHeight);
  if (right - left <= 0 || bottom - top <= 0) {
    return null;
  }
  return { left, top, right, bottom, width: right - left, height: bottom - top, viewportWidth, viewportHeight };
}

function ensureBackdropMasks(ownerDocument, backdrop) {
  if (!ownerDocument || !backdrop) {
    return [];
  }
  const masks = Array.from(backdrop.querySelectorAll?.("[data-onboarding-backdrop-mask]") || []);
  while (masks.length < 4) {
    const mask = createElement(ownerDocument, "div", "empire-onboarding-backdrop__mask");
    mask?.setAttribute?.("data-onboarding-backdrop-mask", "");
    mask?.setAttribute?.("aria-hidden", "true");
    if (!mask) {
      break;
    }
    backdrop.append(mask);
    masks.push(mask);
  }
  return masks.slice(0, 4);
}

function hideBackdropMasks(backdrop) {
  for (const mask of Array.from(backdrop?.querySelectorAll?.("[data-onboarding-backdrop-mask]") || [])) {
    mask.hidden = true;
  }
}

function positionBackdropMasks(ownerDocument, backdrop, rect = null) {
  if (!rect) {
    hideBackdropMasks(backdrop);
    return false;
  }
  const masks = ensureBackdropMasks(ownerDocument, backdrop);
  const segments = [
    { left: 0, top: 0, width: rect.viewportWidth, height: rect.top },
    { left: 0, top: rect.bottom, width: rect.viewportWidth, height: Math.max(0, rect.viewportHeight - rect.bottom) },
    { left: 0, top: rect.top, width: rect.left, height: rect.height },
    { left: rect.right, top: rect.top, width: Math.max(0, rect.viewportWidth - rect.right), height: rect.height }
  ];
  for (const [index, mask] of masks.entries()) {
    const segment = segments[index];
    if (!mask || !segment) {
      continue;
    }
    mask.hidden = segment.width <= 0 || segment.height <= 0;
    setElementStyle(mask, "left", `${segment.left}px`);
    setElementStyle(mask, "top", `${segment.top}px`);
    setElementStyle(mask, "width", `${segment.width}px`);
    setElementStyle(mask, "height", `${segment.height}px`);
  }
  return true;
}

function updateStepBackdrop(ownerDocument, mode = "none", focusRect = null) {
  const body = ownerDocument?.body;
  if (!body) {
    return null;
  }
  let backdrop = panelState.backdrop?.ownerDocument === ownerDocument ? panelState.backdrop : null;
  backdrop ||= ownerDocument.querySelector?.("[data-onboarding-backdrop]");
  if (!backdrop) {
    backdrop = createElement(ownerDocument, "div", "empire-onboarding-backdrop");
    backdrop?.setAttribute?.("data-onboarding-backdrop", "");
    backdrop?.setAttribute?.("aria-hidden", "true");
    if (backdrop) {
      body.append(backdrop);
    }
  }
  panelState.backdrop = backdrop;
  if (!backdrop) {
    return null;
  }
  const visible = mode === "welcome" || mode === "focus";
  const cutout = mode === "focus" && Boolean(focusRect);
  backdrop.hidden = !visible;
  backdrop.classList?.toggle?.("is-visible", visible);
  backdrop.classList?.toggle?.("is-welcome", mode === "welcome");
  backdrop.classList?.toggle?.("is-focus", mode === "focus");
  backdrop.classList?.toggle?.("is-cutout", cutout);
  backdrop.dataset.onboardingMode = mode;
  backdrop.dataset.onboardingScroll = mode === "welcome" ? "page" : "guided";
  if (!visible || !cutout) {
    hideBackdropMasks(backdrop);
  } else {
    positionBackdropMasks(ownerDocument, backdrop, focusRect);
  }
  return backdrop;
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
  const target = state.target || null;
  const targetSelector = state.targetSelector || getOnboardingTargetSelector(step.id, readModel);
  const manualCompletion = isManualCompletionStep(step);
  const renderPrimaryAction = shouldRenderPrimaryAction(step, isDefeated);
  const welcomePageScroll = !isDefeated && step.id === "welcome";
  const focusBackdrop = !isDefeated && Boolean(step.focusBackdrop);
  const lockBackgroundScroll = !isDefeated && Boolean(step.lockBackgroundScroll);
  const scrollMode = lockBackgroundScroll ? "locked" : (welcomePageScroll ? "page" : "guided");
  const showTargetRing = !isDefeated && step.showTargetRing !== false;
  const enteredStep = panelState.currentStepId !== normalized.currentStepId;

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
  mount.dataset.onboardingStep = step.id;
  mount.dataset.onboardingScroll = scrollMode;
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
    updateExtraHighlights(ownerDocument, [], step);
    updateFocusTargetClasses([], step);
    updateStepBackdrop(ownerDocument, "none");
    setDocumentScrollMode(ownerDocument, "none");
    setDocumentOnboardingStep(ownerDocument, "");
    setDocumentOnboardingMapMode(ownerDocument, "");
    updateMapDistrictHighlights(ownerDocument, root, {});
    resetPanelPlacement(mount);
    return true;
  }

  setDocumentScrollMode(ownerDocument, scrollMode);
  setDocumentOnboardingStep(ownerDocument, step.id);
  applyMapViewMode(ownerDocument, root, step);
  if (!isDefeated && enteredStep && step.scrollPageTopOnEnter && panelState.lastPageTopStepId !== step.id) {
    safeScrollPageToTop(ownerDocument, { behavior: "auto" });
    panelState.lastPageTopStepId = step.id;
  } else if (enteredStep && panelState.lastPageTopStepId !== null && panelState.lastPageTopStepId !== step.id) {
    panelState.lastPageTopStepId = null;
  }

  const header = createElement(ownerDocument, "header", "empire-onboarding__header");
  const signal = createElement(ownerDocument, "span", "empire-onboarding__signal");
  const progressLabel = createElement(ownerDocument, "span", "empire-onboarding__progress");
  const progressTrack = createElement(ownerDocument, "div", "empire-onboarding__progress-track");
  const progressFill = createElement(ownerDocument, "span", "empire-onboarding__progress-fill");
  const title = createElement(ownerDocument, "h2", "empire-onboarding__title");
  const content = createElement(ownerDocument, "div", "empire-onboarding__content");
  const body = createElement(ownerDocument, "div", "empire-onboarding__body");
  const summary = createElement(ownerDocument, "ul", "empire-onboarding__summary");
  const fallback = createElement(ownerDocument, "div", "empire-onboarding__fallback");
  const fallbackTitle = createElement(ownerDocument, "strong", "empire-onboarding__fallback-title");
  const fallbackBody = createElement(ownerDocument, "span", "empire-onboarding__fallback-copy");
  const actions = createElement(ownerDocument, "div", "empire-onboarding__actions");
  const skipButton = createElement(ownerDocument, "button", "button empire-onboarding__button empire-onboarding__button--ghost");
  const backButton = createElement(ownerDocument, "button", "button empire-onboarding__button empire-onboarding__button--back");
  const nextButton = createElement(ownerDocument, "button", "button empire-onboarding__button empire-onboarding__button--primary");

  if (!header || !signal || !progressLabel || !progressTrack || !progressFill || !title || !content || !body || !summary || !fallback || !fallbackTitle || !fallbackBody || !actions || !skipButton || !backButton || !nextButton) {
    return false;
  }

  mount.setAttribute?.("aria-describedby", "empire-onboarding-copy");
  signal.setAttribute("aria-hidden", "true");
  progressLabel.textContent = isDefeated ? "DEF" : `Krok ${stepNumber} / ${normalized.totalCount}`;
  setElementStyle(progressFill, "width", isDefeated ? "100%" : `${progressPercent}%`);
  progressTrack.append(progressFill);
  header.append(signal, progressLabel);

  if (isDefeated) {
    title.textContent = "Vyřazen ze hry";
    renderStepBody(body, ownerDocument, {}, "Tvoje demo smyčka skončila. Vrať se do lobby.");
  } else {
    renderStepTitle(title, ownerDocument, step);
    renderStepBody(body, ownerDocument, step, step.body);
  }

  body.id = "empire-onboarding-copy";
  content.append(body);

  const summaryItems = asArray(step.summaryItems).slice(0, 5);
  if (!isDefeated && summaryItems.length > 0) {
    for (const item of summaryItems) {
      const summaryItem = createElement(ownerDocument, "li", "empire-onboarding__summary-item");
      if (summaryItem) {
        summaryItem.textContent = String(item || "").trim();
        summary.append(summaryItem);
      }
    }
    content.append(summary);
  }

  if (!isDefeated && state.missingTarget) {
    fallbackTitle.textContent = state.fallbackTitle || step.fallbackTitle || "Cíl teď není dostupný.";
    fallbackBody.textContent = state.fallback || step.fallbackBody || "Tahle část UI teď není dostupná. Pokračuj dál, pravidla hry se nemění.";
    fallback.append(fallbackTitle, fallbackBody);
    content.append(fallback);
  }

  mount.append(header, progressTrack, title);
  mount.append(content);

  skipButton.type = "button";
  skipButton.textContent = "Přeskočit";
  skipButton.setAttribute("aria-label", "Přeskočit onboarding");
  skipButton.setAttribute("data-onboarding-skip-action", "");
  skipButton.disabled = step.canSkip === false;
  skipButton.addEventListener?.("click", () => callbacks.onSkip?.());

  backButton.type = "button";
  backButton.textContent = "Zpět";
  backButton.setAttribute("aria-label", "Vrátit se na předchozí onboarding krok");
  backButton.setAttribute("data-onboarding-back-action", "");
  backButton.disabled = isDefeated || normalized.currentIndex <= 0;
  backButton.addEventListener?.("click", () => callbacks.onBack?.(step.id));

  nextButton.type = "button";
  nextButton.textContent = isDefeated ? "Zavřít" : (step.cta || "Další");
  nextButton.setAttribute("aria-label", isDefeated
    ? "Zavřít defeated hlášku"
    : (manualCompletion ? "Pokračovat na další onboarding krok" : "Zaměřit aktuální onboarding cíl"));
  nextButton.setAttribute("data-onboarding-primary-action", "");
  nextButton.setAttribute("data-onboarding-primary-mode", manualCompletion ? "complete" : "guide");
  nextButton.addEventListener?.("click", () => {
    if (isDefeated) {
      callbacks.onSkip?.();
      return;
    }
    if (!manualCompletion) {
      if (target) {
        safeScrollIntoView(target);
        safeFocus(target);
      }
      return;
    }
    callbacks.onNext?.(step.id);
  });

  actions.append(skipButton);
  if (normalized.currentIndex > 0 || isDefeated) {
    actions.append(backButton);
  }
  if (renderPrimaryAction) {
    actions.append(nextButton);
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

  mount.dataset.highlight = step.highlightType || "none";
  if (targetSelector) {
    mount.dataset.onboardingTarget = targetSelector;
  } else if (mount.dataset.onboardingTarget) {
    delete mount.dataset.onboardingTarget;
  }
  const focusTargets = resolveFocusTargets(ownerDocument, root, step, target);
  const primaryTarget = focusTargets[0] || target;
  if (!lockBackgroundScroll && step.scrollFocusIntoView && shouldScrollFocusIntoView(ownerDocument, step)) {
    const scrollTarget = step.scrollFocusSelector
      ? resolveTargetElement(ownerDocument, root, step.scrollFocusSelector)
      : step.focusBackdropHoleSelector
      ? resolveTargetElement(ownerDocument, root, step.focusBackdropHoleSelector)
      : primaryTarget;
    safeScrollIntoView(scrollTarget, {
      behavior: "auto",
      block: step.scrollFocusBlock || "center",
      inline: step.scrollFocusInline || "nearest"
    });
  }
  const focusRect = focusBackdrop ? getFocusBackdropRect(ownerDocument, root, step, focusTargets) : null;
  updateStepBackdrop(ownerDocument, welcomePageScroll ? "welcome" : (focusBackdrop ? "focus" : "none"), focusRect);
  updateFocusTargetClasses(focusTargets, step);
  if (showTargetRing) {
    updateHighlight(ownerDocument, primaryTarget, step);
    updateExtraHighlights(ownerDocument, focusTargets.slice(1), step);
  } else {
    updateHighlight(ownerDocument, null, step);
    updateExtraHighlights(ownerDocument, [], step);
  }
  updateMapDistrictHighlights(ownerDocument, root, step);
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
