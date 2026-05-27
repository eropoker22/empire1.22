import { renderRecipeCard, renderRecipeList } from "./recipePanel.js";

function getDocument(scopeElement = null) {
  return scopeElement?.ownerDocument || (typeof document !== "undefined" ? document : null);
}

function createElement(scopeElement, tagName, className = "") {
  const scope = getDocument(scopeElement);
  if (!scope || typeof scope.createElement !== "function") {
    return null;
  }
  const element = scope.createElement(tagName);
  if (className) {
    element.className = className;
  }
  return element;
}

function formatMoney(value, options = {}) {
  return typeof options.formatCurrency === "function"
    ? options.formatCurrency(value)
    : `$${Math.max(0, Math.floor(Number(value || 0))).toLocaleString("cs-CZ")}`;
}

function formatDuration(value, options = {}) {
  if (typeof options.formatDurationLabel === "function") {
    return options.formatDurationLabel(value);
  }

  const totalSeconds = Math.max(0, Math.ceil(Number(value || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${String(seconds).padStart(2, "0")}s` : `${seconds}s`;
}

function createInfoLine(scopeElement, label, value) {
  const row = createElement(scopeElement, "div", "district-building-detail-mechanic-row");
  const rowLabel = createElement(scopeElement, "span");
  const rowValue = createElement(scopeElement, "strong");
  if (!row || !rowLabel || !rowValue) {
    return null;
  }
  rowLabel.textContent = label || "";
  rowValue.textContent = value || "";
  row.append(rowLabel, rowValue);
  return row;
}

function appendChildren(parent, children = []) {
  for (const child of children) {
    if (child) parent.append(child);
  }
}

function getOutputRows(outputs = [], options = {}) {
  return (Array.isArray(outputs) ? outputs : []).map((output) => ({
    label: output.label || (typeof options.getResourceLabel === "function" ? options.getResourceLabel(output.itemId) : output.itemId) || "Výstup",
    amount: Math.max(0, Number(output.amount || 0))
  }));
}

export function renderProductionOutputs(outputs = [], options = {}) {
  const list = createElement(options.mount, "div", "drug-production-slot__supply-row");
  if (!list) return null;
  for (const output of getOutputRows(outputs, options)) {
    const pill = createElement(options.mount, "div", "drug-production-slot__supply-pill");
    const label = createElement(options.mount, "span", "drug-production-slot__supply-name");
    const value = createElement(options.mount, "strong", "drug-production-slot__supply-value");
    if (!pill || !label || !value) continue;
    label.textContent = output.label;
    value.textContent = String(output.amount);
    pill.append(label, value);
    list.append(pill);
  }
  return list;
}

export function renderProductionInputs(inputs = {}, options = {}) {
  const list = createElement(options.mount, "div", "drug-production-slot__supply-row");
  if (!list) return null;
  for (const [itemId, amount] of Object.entries(inputs || {})) {
    const pill = createElement(options.mount, "div", "drug-production-slot__supply-pill");
    const label = createElement(options.mount, "span", "drug-production-slot__supply-name");
    const value = createElement(options.mount, "strong", "drug-production-slot__supply-value");
    if (!pill || !label || !value) continue;
    label.textContent = typeof options.getResourceLabel === "function" ? options.getResourceLabel(itemId) : itemId;
    value.textContent = String(amount);
    pill.append(label, value);
    list.append(pill);
  }
  return list;
}

export function renderProductionProgress(productionState = {}, options = {}) {
  const progress = createElement(options.mount, "span", "drug-production-slot__state");
  if (!progress) return null;
  const status = String(productionState.status || "").trim();
  if (status === "running") {
    progress.textContent = options.runningLabel || "Výroba";
  } else if (status === "ready") {
    progress.textContent = options.readyLabel || "Hotovo";
  } else {
    progress.textContent = options.idleLabel || "Připraveno";
  }
  return progress;
}

export function renderCollectProductionButton(productionState = {}, callbacks = {}, options = {}) {
  const button = createElement(options.mount, "button", options.className || "button drug-lab-mini-btn");
  if (!button) return null;
  button.type = "button";
  button.textContent = options.text || "Vybrat";
  button.disabled = Boolean(options.disabled ?? productionState.status !== "ready");
  if (options.title) {
    button.title = options.title;
    button.setAttribute("aria-label", options.title);
  }
  button.addEventListener("click", () => {
    if (typeof callbacks.onCollect === "function") {
      callbacks.onCollect(productionState, options);
    }
  });
  return button;
}

export function renderProductionPreview(productionViewModel = {}, options = {}) {
  const preview = createElement(options.mount, "div", "building-detail-mechanics district-building-detail-mechanics district-building-detail-info-grid");
  if (!preview) return null;
  const rows = Array.isArray(productionViewModel.rows) ? productionViewModel.rows : [];
  for (const row of rows) {
    preview.append(createInfoLine(options.mount, row.label, row.value));
  }
  if (rows.length === 0) {
    preview.append(createInfoLine(options.mount, "Výroba", productionViewModel.emptyText || "Bez produkce."));
  }
  return preview;
}

export function renderProductionBuildingInfo(viewModel = {}, callbacks = {}, options = {}) {
  const {
    infoTextElement,
    infoEffectsElement,
    infoActionsElement,
    config = {},
    buildingName = "",
    recipes = {},
    state = {},
    readyCount = 0,
    upgradeCost = 0,
    maxLevel = 14,
    multiplier = 1,
    nextMultiplier = multiplier,
    effectsLabel = ""
  } = viewModel || {};

  const recipeLines = Array.isArray(viewModel.recipeLines) ? viewModel.recipeLines : [];

  if (infoTextElement) {
    infoTextElement.textContent = [
      config.infoText || "",
      `Level ${state.level}: rychlost x${Number(multiplier || 1).toFixed(2)}.`,
      state.level < maxLevel
        ? `Upgrade stojí ${formatMoney(upgradeCost, options)} a zvedne rychlost na x${Number(nextMultiplier || multiplier || 1).toFixed(2)}.`
        : "Budova je na maximálním levelu.",
      `Hotovo k vyzvednutí: ${readyCount} receptů.`
    ].filter(Boolean).join(" ");
  }

  if (infoEffectsElement) {
    infoEffectsElement.textContent = [
      effectsLabel || `${config.label || "Budova"} · základní produkční rychlost`,
      state.level < maxLevel ? `Další level: +10 % rychlost craftu.` : "Další upgrade už není dostupný.",
      "Vyzvednutí přesune hotové kusy do skladu hráče."
    ].join(" · ");
  }

  if (infoActionsElement) {
    infoActionsElement.replaceChildren();
    const lines = [
      `+ Vybrat hotové: přesune ${readyCount > 0 ? `${readyCount} hotových receptů` : "hotové recepty"} do skladu.`,
      state.level < maxLevel
        ? `⇪ Upgrade: cena ${formatMoney(upgradeCost, options)}, nový multiplier x${Number(nextMultiplier || multiplier || 1).toFixed(2)}.`
        : "⇪ Upgrade: max level.",
      ...recipeLines
    ];
    for (const entry of lines) {
      const item = createElement(infoActionsElement, "li");
      if (!item) continue;
      item.textContent = entry;
      infoActionsElement.append(item);
    }
  }

  return Boolean(buildingName || Object.keys(recipes || {}).length >= 0);
}

export function renderFactoryBuildingInfo(infoPanel, viewModel = {}, options = {}) {
  if (!infoPanel) {
    return false;
  }

  const card = createElement(infoPanel, "div", "building-info-card building-info-card--compact-tech");
  const head = createElement(infoPanel, "div", "building-info-card__head");
  const title = createElement(infoPanel, "h4", "building-info-card__title");
  const subtitle = createElement(infoPanel, "p", "building-info-card__subtitle");
  const overview = createElement(infoPanel, "div", "building-detail-mechanics district-building-detail-mechanics district-building-detail-info-grid");
  const actionsTitle = createElement(infoPanel, "h5");
  const actions = createElement(infoPanel, "div", "building-info-card__actions district-building-detail-actions district-building-detail-info-actions");
  if (!card || !head || !title || !subtitle || !overview || !actionsTitle || !actions) {
    return false;
  }

  title.textContent = "Co hráč musí vědět";
  subtitle.textContent = "Továrna vyrábí Metal Parts, Tech Core a Combat Module pro další bojové systémy.";
  head.append(title, subtitle);

  for (const row of Array.isArray(viewModel.rows) ? viewModel.rows : []) {
    overview.append(createInfoLine(infoPanel, row.label, row.value));
  }

  actionsTitle.textContent = "Akce";
  for (const rowView of Array.isArray(viewModel.actions) ? viewModel.actions : []) {
    const row = createElement(infoPanel, "div", "building-info-action-row");
    const rowTitle = createElement(infoPanel, "strong", "building-info-action-row__title");
    const rowDesc = createElement(infoPanel, "span", "building-info-action-row__desc");
    if (!row || !rowTitle || !rowDesc) continue;
    rowTitle.textContent = rowView.title || "";
    rowDesc.textContent = rowView.description || "";
    row.append(rowTitle, rowDesc);
    actions.append(row);
  }

  card.append(head, overview, actionsTitle, actions);
  infoPanel.replaceChildren(card);
  return true;
}

export function renderFactorySlotCard(slotView = {}, callbacks = {}, options = {}) {
  const slot = slotView.slot || {};
  const card = createElement(options.mount, "article");
  if (!card) return null;
  card.dataset.resourceColor = slotView.resourceColor || slot.resourceKey || "";
  card.className = slot.isProducing
    ? "factory-slot drug-production-slot factory-slot--active drug-production-slot--active"
    : "factory-slot drug-production-slot";

  const head = createElement(options.mount, "div", "factory-slot__head drug-production-slot__head");
  const titleWrap = createElement(options.mount, "div", "factory-slot__title-wrap drug-production-slot__title-wrap");
  const icon = createElement(options.mount, "span", `drug-production-slot__icon ${slotView.iconToneClass || ""} ${slotView.iconGlyphClass || ""}`);
  const labelWrap = createElement(options.mount, "div", "drug-production-slot__titles");
  const eyebrow = createElement(options.mount, "span", "drug-production-slot__product");
  const title = createElement(options.mount, "strong", "drug-production-slot__title");
  const status = createElement(options.mount, "span", "drug-production-slot__state");
  const metrics = createElement(options.mount, "div", "drug-production-slot__metrics");
  const actions = createElement(options.mount, "div", "factory-slot__actions");
  if (!head || !titleWrap || !icon || !labelWrap || !eyebrow || !title || !status || !metrics || !actions) {
    return card;
  }

  icon.setAttribute("aria-hidden", "true");
  eyebrow.textContent = slotView.typeLabel || "";
  title.textContent = slotView.title || slot.resourceKey || "";
  status.textContent = slot.isProducing ? "Aktivní" : "Pauza";
  labelWrap.append(eyebrow, title);
  titleWrap.append(icon, labelWrap);
  head.append(titleWrap, status);

  const outputMetric = createElement(options.mount, "div", "drug-production-slot__metric");
  const outputLabel = createElement(options.mount, "span", "drug-production-slot__metric-label");
  const outputValue = createElement(options.mount, "strong", "drug-production-slot__metric-value");
  if (outputMetric && outputLabel && outputValue) {
    outputLabel.textContent = "Výstup";
    outputValue.textContent = `${Number(slotView.perHour || 0).toFixed(2)} / h`;
    outputMetric.append(outputLabel, outputValue);
    metrics.append(outputMetric);
  }

  const profileMetric = createElement(options.mount, "div", "drug-production-slot__metric");
  const profileLabel = createElement(options.mount, "span", "drug-production-slot__metric-label");
  const profileValue = createElement(options.mount, "div", "factory-slot__recipe-value");
  const profilePrimary = createElement(options.mount, "span", "factory-slot__recipe-line");
  const profileSecondary = createElement(options.mount, "span", "factory-slot__recipe-line factory-slot__recipe-line--secondary");
  if (profileMetric && profileLabel && profileValue && profilePrimary && profileSecondary) {
    profileLabel.textContent = slotView.profileLabel || "Profil";
    profilePrimary.textContent = slotView.primaryLine || "";
    profileSecondary.textContent = slotView.secondaryLine || "";
    profileValue.append(profilePrimary, profileSecondary);
    profileMetric.append(profileLabel, profileValue);
    metrics.append(profileMetric);
  }

  const storageMetric = createElement(options.mount, "div", "drug-production-slot__metric drug-production-slot__metric--inline");
  const storageLabel = createElement(options.mount, "span", "drug-production-slot__metric-label");
  const storageValue = createElement(options.mount, "span", "drug-production-slot__metric-inline-value factory-slot__price-value");
  if (storageMetric && storageLabel && storageValue) {
    storageLabel.textContent = "Ve slotu";
    storageValue.textContent = `${slot.producedAmount}/${slotView.slotStorageCap}`;
    storageMetric.append(storageLabel, storageValue);
    metrics.append(storageMetric);
  }

  const pauseButton = createElement(options.mount, "button", "button drug-lab-mini-btn factory-slot-button");
  const startButton = createElement(options.mount, "button", "button drug-lab-mini-btn factory-slot-button");
  if (pauseButton && startButton) {
    pauseButton.type = "button";
    pauseButton.dataset.factorySlotToggleState = "stop";
    pauseButton.textContent = "Pozastavit";
    pauseButton.disabled = !slot.isProducing;
    pauseButton.addEventListener("click", () => {
      if (typeof callbacks.onPauseSlot === "function") callbacks.onPauseSlot(slotView);
    });
    startButton.type = "button";
    startButton.dataset.factorySlotToggleState = "start";
    startButton.textContent = "Spustit";
    startButton.disabled = Boolean(slot.isProducing);
    startButton.addEventListener("click", () => {
      if (typeof callbacks.onStartSlot === "function") callbacks.onStartSlot(slotView);
    });
    actions.append(pauseButton, startButton);
  }

  card.append(head, metrics, actions);
  return card;
}

export function renderFactorySlotList(mount, slots = [], callbacks = {}, options = {}) {
  if (!mount) return false;
  mount.replaceChildren();
  mount.classList?.add?.("factory-slot-grid");
  for (const slotView of Array.isArray(slots) ? slots : []) {
    const card = renderFactorySlotCard(slotView, callbacks, { ...options, mount });
    if (card) mount.append(card);
  }
  return true;
}

export function renderProductionPanel(productionViewModel = {}, callbacks = {}, options = {}) {
  const mount = productionViewModel.mount || options.mount || null;
  if (!mount) {
    return false;
  }
  mount.replaceChildren();
  const recipes = Array.isArray(productionViewModel.recipes) ? productionViewModel.recipes : [];
  if (recipes.length === 0) {
    const empty = createElement(mount, "div", options.emptyClassName || "buildings-popup__empty");
    if (empty) {
      empty.textContent = productionViewModel.emptyText || "Bez produkce.";
      mount.append(empty);
    }
    return true;
  }
  if (recipes.some((recipe) => recipe?.prebuiltCard)) {
    for (const recipe of recipes) {
      if (recipe?.prebuiltCard) mount.append(recipe.prebuiltCard);
    }
    return true;
  }
  const fragment = renderRecipeList(recipes, callbacks, { ...options, mount });
  if (fragment) {
    mount.append(fragment);
  } else {
    for (const recipe of recipes) {
      if (recipe?.prebuiltCard) {
        mount.append(recipe.prebuiltCard);
        continue;
      }
      const card = renderRecipeCard(recipe, callbacks, { ...options, mount });
      if (card) mount.append(card);
    }
  }
  return true;
}

if (typeof window !== "undefined") {
  window.EmpireProductionPanel = {
    renderProductionPanel,
    renderProductionPreview,
    renderProductionProgress,
    renderProductionOutputs,
    renderProductionInputs,
    renderCollectProductionButton,
    renderProductionBuildingInfo,
    renderFactoryBuildingInfo,
    renderFactorySlotCard,
    renderFactorySlotList
  };
}
