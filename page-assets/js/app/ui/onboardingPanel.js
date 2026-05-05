export const FREE_SESSION_ONBOARDING_STEPS = Object.freeze([
  Object.freeze({
    id: "open-own-district",
    label: "Otevři svůj district",
    hint: "Klikni na svůj obsazený district na mapě."
  }),
  Object.freeze({
    id: "open-first-building",
    label: "Otevři první budovu",
    hint: "V detailu vlastního districtu otevři některou budovu."
  }),
  Object.freeze({
    id: "collect-production",
    label: "Seber první produkci",
    hint: "Vyber připravenou produkci nebo výstup budovy."
  }),
  Object.freeze({
    id: "check-storage",
    label: "Zkontroluj sklad",
    hint: "Otevři sklad v horní liště a ověř zásoby."
  }),
  Object.freeze({
    id: "prepare-equipment",
    label: "Vyrob nebo připrav základní vybavení",
    hint: "Použij zbrojovku, továrnu nebo startovní výbavu."
  }),
  Object.freeze({
    id: "select-enemy-district",
    label: "Vyber cizí district",
    hint: "Klikni na sousední district, který není tvůj."
  }),
  Object.freeze({
    id: "run-spy",
    label: "Proveď špehování",
    hint: "V detailu cizího districtu spusť spy akci."
  }),
  Object.freeze({
    id: "run-attack",
    label: "Spusť první útok",
    hint: "Po přípravě výbavy otevři attack panel a potvrď útok."
  }),
  Object.freeze({
    id: "read-battle-report",
    label: "Přečti battle report",
    hint: "Po doběhnutí útoku otevři výsledek útoku."
  }),
  Object.freeze({
    id: "watch-heat-police",
    label: "Sleduj heat a police warning",
    hint: "Zkontroluj heat panel a police feed."
  })
]);

const panelState = {
  hidden: false,
  minimized: false,
  mount: null,
  completedStepIds: new Set()
};

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asCompletedSet(progress = {}) {
  const completed = progress.completedStepIds || progress.completed || [];
  return new Set(asArray(completed).map((stepId) => String(stepId || "").trim()).filter(Boolean));
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

function setButtonCallback(button, callback) {
  if (!button || typeof callback !== "function") {
    return;
  }
  button.addEventListener("click", callback);
}

export function normalizeOnboardingProgress(progress = {}) {
  const completedStepIds = asCompletedSet(progress);
  const steps = FREE_SESSION_ONBOARDING_STEPS.map((step) => ({
    ...step,
    done: completedStepIds.has(step.id)
  }));
  const completedCount = steps.filter((step) => step.done).length;
  const totalCount = steps.length;
  const nextStep = steps.find((step) => !step.done) || null;

  return {
    completedStepIds: Array.from(completedStepIds),
    steps,
    completedCount,
    totalCount,
    nextStep,
    status: completedCount >= totalCount ? "complete" : "active",
    hidden: Boolean(progress.hidden),
    minimized: Boolean(progress.minimized)
  };
}

export function markOnboardingStepDone(stepId) {
  const normalizedStepId = String(stepId || "").trim();
  if (!normalizedStepId) {
    return Array.from(panelState.completedStepIds);
  }
  panelState.completedStepIds.add(normalizedStepId);
  return Array.from(panelState.completedStepIds);
}

export function getNextOnboardingHint(context = {}) {
  const progress = normalizeOnboardingProgress(context.progress || context);
  return progress.nextStep?.hint || "Free loop je dokončený. Vyber další cíl na mapě.";
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

export function renderOnboardingPanel(progress = {}, callbacks = {}, options = {}) {
  const mount = options.mount || panelState.mount;
  if (!mount) {
    return false;
  }

  const ownerDocument = getOwnerDocument(mount);
  const normalizedProgress = normalizeOnboardingProgress({
    completedStepIds: [
      ...panelState.completedStepIds,
      ...asArray(progress.completedStepIds || progress.completed)
    ],
    hidden: panelState.hidden || progress.hidden,
    minimized: panelState.minimized || progress.minimized
  });

  panelState.mount = mount;
  panelState.hidden = normalizedProgress.hidden;
  panelState.minimized = normalizedProgress.minimized;
  mount.hidden = normalizedProgress.hidden;
  mount.classList?.add?.("free-onboarding-panel");
  mount.classList?.toggle?.("is-minimized", normalizedProgress.minimized);
  mount.replaceChildren?.();

  const header = createElement(ownerDocument, "div", "free-onboarding-panel__header");
  const titleWrap = createElement(ownerDocument, "div", "free-onboarding-panel__title");
  const eyebrow = createElement(ownerDocument, "span", "free-onboarding-panel__eyebrow");
  const title = createElement(ownerDocument, "strong");
  const controls = createElement(ownerDocument, "div", "free-onboarding-panel__controls");
  const minimizeButton = createElement(ownerDocument, "button", "button free-onboarding-panel__button");
  const hideButton = createElement(ownerDocument, "button", "button free-onboarding-panel__button");

  if (!header || !titleWrap || !eyebrow || !title || !controls || !minimizeButton || !hideButton) {
    return false;
  }

  eyebrow.textContent = "FREE SESSION";
  title.textContent = `${normalizedProgress.completedCount}/${normalizedProgress.totalCount}`;
  minimizeButton.type = "button";
  minimizeButton.textContent = normalizedProgress.minimized ? "+" : "-";
  minimizeButton.setAttribute("aria-label", normalizedProgress.minimized ? "Rozbalit onboarding" : "Minimalizovat onboarding");
  hideButton.type = "button";
  hideButton.textContent = "x";
  hideButton.setAttribute("aria-label", "Skrýt onboarding");
  setButtonCallback(minimizeButton, () => {
    panelState.minimized = !panelState.minimized;
    callbacks.onMinimize?.(panelState.minimized);
  });
  setButtonCallback(hideButton, () => {
    hideOnboardingPanel();
    callbacks.onHide?.();
  });

  titleWrap.append(eyebrow, title);
  controls.append(minimizeButton, hideButton);
  header.append(titleWrap, controls);
  mount.append(header);

  if (normalizedProgress.minimized) {
    return true;
  }

  const list = createElement(ownerDocument, "ol", "free-onboarding-panel__steps");
  if (!list) {
    return false;
  }

  for (const step of normalizedProgress.steps) {
    const item = createElement(ownerDocument, "li", `free-onboarding-panel__step ${step.done ? "is-done" : ""}`);
    const marker = createElement(ownerDocument, "span", "free-onboarding-panel__marker");
    const copy = createElement(ownerDocument, "span", "free-onboarding-panel__copy");
    if (!item || !marker || !copy) {
      continue;
    }
    marker.textContent = step.done ? "✓" : "•";
    copy.textContent = step.label;
    item.append(marker, copy);
    list.append(item);
  }
  mount.append(list);

  const hint = createElement(ownerDocument, "p", "free-onboarding-panel__hint");
  if (hint) {
    hint.textContent = normalizedProgress.nextStep?.hint || "Free loop je dokončený. Pokračuj expanzí na další district.";
    mount.append(hint);
  }

  return true;
}

export function initOnboardingPanel(context = {}, options = {}) {
  const ownerDocument = options.documentRef || (typeof document !== "undefined" ? document : null);
  const container = options.container || options.root || ownerDocument?.body || null;
  const mount = options.mount || ownerDocument?.querySelector?.("[data-free-onboarding-panel]");
  const resolvedMount = mount || createElement(ownerDocument, "section", "free-onboarding-panel");

  if (!resolvedMount || !container) {
    return null;
  }

  resolvedMount.setAttribute?.("data-free-onboarding-panel", "");
  resolvedMount.setAttribute?.("aria-label", "Free session onboarding");
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
    getNextOnboardingHint,
    hideOnboardingPanel,
    initOnboardingPanel,
    markOnboardingStepDone,
    normalizeOnboardingProgress,
    renderOnboardingPanel,
    showOnboardingPanel
  };
}
