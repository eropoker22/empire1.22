import { getRecipeCardInteractionFingerprint, renderRecipeCard } from "./recipePanel.js";
import { bindSharedCountdown } from "./sharedCountdownTicker.js";
import { FREE_GAMEPLAY_TICK_MS } from "../../../../packages/game-config/src/legacy-page/economy-config.js";
import {
  clearProductionQuantitySelection,
  readProductionQuantitySelection,
  writeProductionQuantitySelection
} from "./productionQuantitySelection.js";
import {
  applyPendingProductionSlotStartEffect,
  triggerProductionSlotStartEffect
} from "./productionSlotStartEffect.js";

const factorySlotListStateByMount = new WeakMap();
const productionPanelStateByMount = new WeakMap();

const getFactoryBatchSelectionKey = (slotView, slot, options) => [
  String(options?.selectionScopeKey || "factory"),
  String(
    slotView?.recipeId
    || slot?.id
    || slot?.resourceKey
    || "factory-slot"
  )
].join(":");

function resolveFactorySlotBinding(mount, bindingKey, slotView, callbacks) {
  return factorySlotListStateByMount.get(mount)?.bindings?.get(bindingKey) || {
    callbacks,
    slotView
  };
}

function getComparableEntries(value) {
  if (value instanceof Map) {
    return [...value.entries()].map(([key, entryValue]) => [String(key), String(entryValue)]).sort();
  }
  return Object.entries(value || {}).map(([key, entryValue]) => [key, String(entryValue)]).sort();
}

function haveEquivalentProductionNodes(currentNode, nextNode) {
  if (!currentNode || !nextNode) return currentNode === nextNode;
  if (typeof currentNode.isEqualNode === "function") {
    return currentNode.isEqualNode(nextNode);
  }
  if (
    currentNode.tagName !== nextNode.tagName
    || currentNode.className !== nextNode.className
    || currentNode.textContent !== nextNode.textContent
    || currentNode.hidden !== nextNode.hidden
    || currentNode.disabled !== nextNode.disabled
    || currentNode.type !== nextNode.type
    || currentNode.title !== nextNode.title
    || JSON.stringify(getComparableEntries(currentNode.dataset)) !== JSON.stringify(getComparableEntries(nextNode.dataset))
    || JSON.stringify(getComparableEntries(currentNode.attributes)) !== JSON.stringify(getComparableEntries(nextNode.attributes))
    || JSON.stringify(getComparableEntries(currentNode.style?.values)) !== JSON.stringify(getComparableEntries(nextNode.style?.values))
  ) {
    return false;
  }
  const currentChildren = Array.from(currentNode.children || []);
  const nextChildren = Array.from(nextNode.children || []);
  return currentChildren.length === nextChildren.length
    && currentChildren.every((child, index) => haveEquivalentProductionNodes(child, nextChildren[index]));
}

function getProductionInteractionKey(node) {
  const recipeFingerprint = getRecipeCardInteractionFingerprint(node);
  if (typeof recipeFingerprint === "string") return recipeFingerprint;
  if (recipeFingerprint === null) return null;
  return node?.querySelector?.("button") ? null : "static";
}

function replaceProductionChildrenIfChanged(mount, nextChildren, contextKey, stateByMount) {
  const previousState = stateByMount.get(mount);
  const currentChildren = Array.from(mount.children || []);
  const interactionKeys = nextChildren.map(getProductionInteractionKey);
  const interactionsAreStable = interactionKeys.every((key) => typeof key === "string");
  const priorInteractionKeys = previousState?.interactionKeys || [];
  const presentationIsUnchanged = interactionsAreStable
    && previousState?.contextKey === contextKey
    && priorInteractionKeys.length === interactionKeys.length
    && priorInteractionKeys.every((key, index) => key === interactionKeys[index])
    && currentChildren.length === nextChildren.length
    && currentChildren.every((child, index) => haveEquivalentProductionNodes(child, nextChildren[index]));
  stateByMount.set(mount, {
    contextKey,
    interactionKeys: interactionsAreStable ? interactionKeys : []
  });
  if (!presentationIsUnchanged) {
    mount.replaceChildren(...nextChildren);
  }
  return true;
}

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

function setTextContentIfChanged(element, value) {
  const normalizedValue = String(value ?? "");
  if (!element || element.textContent === normalizedValue) return false;
  element.textContent = normalizedValue;
  return true;
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

function appendDurationBonus(value, durationBonusLabel = "") {
  return durationBonusLabel ? `${value} (${durationBonusLabel})` : value;
}

function formatProductionSpeedBonus(multiplier) {
  const numeric = Number(multiplier || 1);
  const bonusPct = Math.max(0, Math.round((numeric - 1) * 100));
  return bonusPct > 0 ? `+${bonusPct} %` : "základní rychlost";
}

function getCurrentTimeMs(options = {}) {
  const now = Number(options.now);
  return Number.isFinite(now) ? now : Date.now();
}

function parseDurationLabelMs(value = "") {
  const text = String(value || "").trim();
  const minuteMatch = text.match(/^(\d+(?:[.,]\d+)?)\s*(?:m|min)/i);
  if (minuteMatch) {
    return Math.max(1000, Math.round(Number(minuteMatch[1].replace(",", ".")) * 60000));
  }
  const secondMatch = text.match(/^(\d+(?:[.,]\d+)?)\s*s/i);
  if (secondMatch) {
    return Math.max(1000, Math.round(Number(secondMatch[1].replace(",", ".")) * 1000));
  }
  return 0;
}

function getPositiveDurationMs(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number) && number > 0) {
      return Math.max(1000, number);
    }
  }
  return 1000;
}

function formatFactorySlotTime(slotView = {}, options = {}) {
  const slot = slotView.slot || {};
  if (!slot.isProducing) {
    const value = slotView.durationBonusLabel
      ? formatDuration(slotView.durationMs, options)
      : slotView.secondaryLine || formatDuration(slotView.durationMs, options);
    return appendDurationBonus(value, slotView.durationBonusLabel);
  }

  const slotCap = Math.max(0, Number(slotView.slotOutputCap ?? slot.slotCap ?? slotView.slotStorageCap ?? slot.slotStorageCap ?? 0));
  const producedAmount = Math.max(0, Number(slot.producedAmount || 0));
  if (slotCap > 0 && producedAmount >= slotCap) {
    return appendDurationBonus(slotView.secondaryLine || formatDuration(slotView.durationMs, options), slotView.durationBonusLabel);
  }

  const durationMs = getPositiveDurationMs(slotView.durationMs, slot.durationMs, parseDurationLabelMs(slotView.secondaryLine));
  const lastTickMs = Number(slot.lastTick || 0);
  const elapsedSinceTickMs = lastTickMs > 0 ? Math.max(0, getCurrentTimeMs(options) - lastTickMs) : 0;
  const progress = Math.max(0, Number(slot.productionRemainder || 0)) + elapsedSinceTickMs / durationMs;
  const progressInCycle = progress - Math.floor(progress);
  const remainingMs = progressInCycle > 0 ? durationMs * (1 - progressInCycle) : durationMs;
  return appendDurationBonus(formatDuration(remainingMs, options), slotView.durationBonusLabel);
}

function bindFactoryMetricCountdown(valueElement, getValue, options = {}) {
  bindSharedCountdown(valueElement, getValue, options);
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

function getFactoryMaterialRequirements(slotView = {}, batchCount = 1) {
  const quantity = Math.max(1, Math.floor(Number(batchCount || 1)));
  const displayCost = slotView.displayCost || {};
  const inputAmounts = slotView.inputAmounts || {};
  return [
    { key: "metalParts", label: "Metal Parts", required: Number(displayCost.metalParts || 0), available: inputAmounts.metalParts },
    { key: "techCore", label: "Tech Core", required: Number(displayCost.techCore || 0), available: inputAmounts.techCore }
  ]
    .map((row) => ({
      ...row,
      required: Math.max(0, Math.floor(row.required * quantity)),
      available: Number.isFinite(Number(row.available)) ? Math.max(0, Math.floor(Number(row.available))) : null
    }))
    .filter((row) => row.required > 0);
}

function createFactoryMaterialRequirements(scopeElement, slotView = {}) {
  if (getFactoryMaterialRequirements(slotView).length === 0) {
    return { element: null, refresh: () => {} };
  }

  const container = createElement(scopeElement, "div", "drug-production-slot__metric drug-production-slot__metric--supplies factory-slot__materials");
  const row = createElement(scopeElement, "div", "drug-production-slot__supply-row factory-slot__material-row");
  if (!container || !row) return { element: null, refresh: () => {} };
  container.append(row);

  const refresh = (batchCount = 1) => {
    row.replaceChildren();
    const requirements = getFactoryMaterialRequirements(slotView, batchCount);
    row.classList.toggle("drug-production-slot__supply-row--count-2", requirements.length === 2);
    for (const requirement of requirements) {
      const isMetalParts = requirement.key === "metalParts" || requirement.key === "metal-parts";
      const resourceColor = isMetalParts ? "metal-parts" : "tech-core";
      const pill = createElement(scopeElement, "div", `drug-production-slot__supply-pill factory-slot__material-pill factory-slot__material-pill--${isMetalParts ? "metal" : "tech"}`);
      const label = createElement(scopeElement, "span", "drug-production-slot__supply-name");
      const value = createElement(scopeElement, "strong", "drug-production-slot__supply-value");
      if (!pill || !label || !value) continue;
      pill.dataset.resourceColor = resourceColor;
      label.textContent = requirement.label;
      value.textContent = requirement.available === null
        ? `${requirement.required}×`
        : `${requirement.required}/${requirement.available}`;
      pill.append(label, value);
      row.append(pill);
    }
  };

  refresh();
  return { element: container, refresh };
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
  const isPharmacy = buildingName === "pharmacy";
  const isDrugLab = buildingName === "druglab";
  const isArmory = buildingName === "armory";
  const isCompactProductionInfo = isPharmacy || isDrugLab || isArmory;

  if (infoTextElement) {
    setTextContentIfChanged(infoTextElement, isCompactProductionInfo
      ? (config.infoText || "Budova vyrábí materiály pro další produkci.")
      : [
          config.infoText || "",
          `Level ${state.level}: rychlost ${formatProductionSpeedBonus(multiplier)}.`,
          state.level < maxLevel
            ? `Upgrade stojí ${formatMoney(upgradeCost, options)} a zvedne rychlost na ${formatProductionSpeedBonus(nextMultiplier || multiplier || 1)}.`
            : "Budova je na maximálním levelu.",
          `Hotovo k vyzvednutí: ${readyCount} receptů.`
        ].filter(Boolean).join(" "));
  }

  if (infoEffectsElement) {
    setTextContentIfChanged(infoEffectsElement, isPharmacy
      ? (effectsLabel || "Lékárna · základní produkční rychlost")
      : isDrugLab
        ? (effectsLabel || "Lab · základní produkční rychlost")
      : isArmory
        ? (effectsLabel || "Zbrojovka · základní produkční rychlost")
      : [
          effectsLabel || `${config.label || "Budova"} · základní produkční rychlost`,
          state.level < maxLevel ? `Další level: +10 % rychlost craftu.` : "Další upgrade už není dostupný.",
          "Vyzvednutí přesune hotové kusy do skladu hráče."
        ].join(" · "));
  }

  if (infoActionsElement) {
    if (Array.from(infoActionsElement.children || []).length > 0) {
      infoActionsElement.replaceChildren();
    }
    if (isCompactProductionInfo) {
      return Boolean(buildingName || Object.keys(recipes || {}).length >= 0);
    }
    const lines = [
      `+ Vybrat hotové: přesune ${readyCount > 0 ? `${readyCount} hotových receptů` : "hotové recepty"} do skladu.`,
      state.level < maxLevel
        ? `⇪ Upgrade: cena ${formatMoney(upgradeCost, options)}, nová rychlost ${formatProductionSpeedBonus(nextMultiplier || multiplier || 1)}.`
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

  const card = createElement(infoPanel, "div", "building-info-card building-info-card--compact-tech building-info-card--factory-info");
  const head = createElement(infoPanel, "div", "building-info-card__head");
  const title = createElement(infoPanel, "h4", "building-info-card__title");
  const subtitle = createElement(infoPanel, "p", "building-info-card__subtitle");
  const mechanicsSection = createElement(infoPanel, "section", "building-info-card__section");
  const mechanicsTitle = createElement(infoPanel, "h5");
  const mechanicsText = createElement(infoPanel, "p", "building-info-card__effects");
  const upgradeSection = createElement(infoPanel, "section", "building-info-card__section building-info-card__section--factory-upgrade-compact");
  const upgradeTitle = createElement(infoPanel, "h5");
  const upgradeGrid = createElement(infoPanel, "div", "building-info-upgrade-mini building-info-upgrade-mini--compact");
  const productsSection = createElement(infoPanel, "section", "building-info-card__section");
  const productsTitle = createElement(infoPanel, "h5");
  const productsList = createElement(infoPanel, "div", "pharmacy-info-output-list pharmacy-info-output-list--factory");
  if (!card || !head || !title || !subtitle || !mechanicsSection || !mechanicsTitle || !mechanicsText || !upgradeSection || !upgradeTitle || !upgradeGrid || !productsSection || !productsTitle || !productsList) {
    return false;
  }

  title.textContent = "Továrna";
  subtitle.textContent = viewModel.description || "Výroba komponentů pro zbraně, obranu a high-tech výbavu.";
  head.append(title, subtitle);

  mechanicsTitle.textContent = "Aktivní mechaniky";
  mechanicsText.textContent = viewModel.effectsLabel || "Základní rychlost · další level +10 %";
  mechanicsSection.append(mechanicsTitle, mechanicsText);

  upgradeTitle.textContent = "Další level";
  const upgrade = viewModel.upgrade || {};
  for (const item of [
    { label: "Cena", value: upgrade.costLabel || "-" },
    { label: "Získáš", value: upgrade.benefitLabel || "-" }
  ]) {
    const upgradeItem = createElement(infoPanel, "div", "building-info-upgrade-mini__item");
    const label = createElement(infoPanel, "span");
    const value = createElement(infoPanel, "strong");
    if (!upgradeItem || !label || !value) continue;
    label.textContent = item.label;
    value.textContent = item.value;
    upgradeItem.append(label, value);
    upgradeGrid.append(upgradeItem);
  }
  upgradeSection.append(upgradeTitle, upgradeGrid);

  productsTitle.textContent = "Výroba";
  const products = Array.isArray(viewModel.products) ? viewModel.products : [];
  if (products.length <= 0) {
    const empty = createElement(infoPanel, "p", "building-detail-info-text");
    if (empty) {
      empty.textContent = "Výrobní data se načítají.";
      productsSection.append(productsTitle, empty);
    }
  } else {
    for (const product of products) {
      const productCard = createElement(infoPanel, "article", "pharmacy-info-output factory-info-output");
      const productTitle = createElement(infoPanel, "strong");
      const productDescription = createElement(infoPanel, "span");
      const meta = createElement(infoPanel, "div", "factory-info-output__meta");
      if (!productCard || !productTitle || !productDescription || !meta) continue;
      productCard.dataset.resourceColor = product.id || "";
      productTitle.textContent = product.title || "Surovina";
      productDescription.textContent = product.description || "";
      for (const item of [
        { label: "Čas", value: product.durationLabel || "-" },
        { label: "Cena", value: product.costLabel || "-" }
      ]) {
        const metaItem = createElement(infoPanel, "div", "factory-info-output__meta-item");
        const label = createElement(infoPanel, "span");
        const value = createElement(infoPanel, "strong");
        if (!metaItem || !label || !value) continue;
        label.textContent = item.label;
        value.textContent = item.value;
        metaItem.append(label, value);
        meta.append(metaItem);
      }
      productCard.append(productTitle, productDescription, meta);
      productsList.append(productCard);
    }
    productsSection.append(productsTitle, productsList);
  }

  card.append(head, mechanicsSection, upgradeSection, productsSection);
  infoPanel.replaceChildren(card);
  return true;
}

export function renderFactorySlotCard(slotView = {}, callbacks = {}, options = {}) {
  const slot = slotView.slot || {};
  const batchSelectionKey = getFactoryBatchSelectionKey(slotView, slot, options);
  const card = createElement(options.mount, "article");
  if (!card) return null;
  card.dataset.resourceColor = slotView.resourceColor || slot.resourceKey || "";
  const cardClassName = slot.isProducing
    ? "factory-slot drug-production-slot factory-slot--active drug-production-slot--active production-slot--running"
    : "factory-slot drug-production-slot";
  card.className = slotView.loading ? `${cardClassName} factory-slot--loading` : cardClassName;

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
  status.textContent = slotView.status
    ? getFactoryStatusLabel(slotView.status)
    : slot.isProducing
      ? "Výroba"
      : Number(slot.producedAmount || 0) > Number(slot.slotCap || slotView.slotOutputCap || 0) && Number(slot.slotCap || slotView.slotOutputCap || 0) > 0
        ? "Překročená kapacita"
        : Number(slot.producedAmount || 0) === Number(slot.slotCap || slotView.slotOutputCap || 0) && Number(slot.slotCap || slotView.slotOutputCap || 0) > 0
          ? "Plná kapacita"
          : Number(slot.queuedAmount || 0) > 0
            ? "Čeká"
            : Number(slot.producedAmount || 0) > 0 ? "Hotovo" : "Připraveno";
  if (slotView.typeLabel) {
    labelWrap.append(eyebrow);
  }
  labelWrap.append(title);
  titleWrap.append(icon, labelWrap);
  head.append(titleWrap, status);

  const appendMetric = (labelText, valueText, inline = false) => {
    const metric = createElement(options.mount, "div", inline ? "drug-production-slot__metric drug-production-slot__metric--inline" : "drug-production-slot__metric");
    const metricLabel = createElement(options.mount, "span", "drug-production-slot__metric-label");
    const metricValue = createElement(options.mount, inline ? "span" : "strong", inline ? "drug-production-slot__metric-inline-value factory-slot__price-value" : "drug-production-slot__metric-value");
    if (!metric || !metricLabel || !metricValue) return null;
    metricLabel.textContent = labelText;
    metricValue.textContent = valueText;
    metric.append(metricLabel, metricValue);
    metrics.append(metric);
    return metricValue;
  };

  const timeValue = appendMetric("Čas", slotView.loading
    ? "—"
    : slotView.usesAuthoritativeCountdown
      ? formatDuration(Number(slotView.remainingMs || 0) > 0 ? slotView.remainingMs : slotView.durationMs, options)
      : formatFactorySlotTime(slotView, options));
  if (!slotView.usesAuthoritativeCountdown && slot.isProducing) {
    bindFactoryMetricCountdown(timeValue, () => formatFactorySlotTime(slotView, options), options);
  }
  const priceValue = appendMetric("Cena", formatFactoryCleanCashCost(slotView, 1));
  const producedAmount = Math.max(0, Math.floor(Number(slot.producedAmount ?? 0)));
  const producedCapacity = Math.max(0, Math.floor(Number(slotView.slotOutputCap ?? slot.slotCap ?? 0)));
  appendMetric("Vyrobeno", slotView.loading
    ? "—"
    : producedCapacity > 0 ? `${producedAmount}/${producedCapacity} ks` : `${producedAmount} ks`, true);
  const queuedAmount = Math.max(0, Math.floor(Number(slotView.queuedAmount || slot.queuedAmount || 0)));
  const queueCap = Math.max(0, Math.floor(Number(slotView.queueCap || slot.queueCap || slotView.slotStorageCap || slot.slotCap || 0)));
  appendMetric("Ve frontě", slotView.loading
    ? "—"
    : queueCap > 0 ? `${queuedAmount}/${queueCap} ks` : `${queuedAmount} ks`, true);
  const materialRequirements = createFactoryMaterialRequirements(options.mount, slotView);
  if (materialRequirements.element) {
    metrics.append(materialRequirements.element);
  }

  let selectedBatches = Math.max(
    1,
    readProductionQuantitySelection(options.mount, batchSelectionKey)
  );
  const updatePrice = () => {
    if (!priceValue) return;
    if (slotView.displayCost) {
      priceValue.textContent = formatFactoryCleanCashCost(slotView, selectedBatches);
      materialRequirements.refresh(selectedBatches);
      return;
    }
    if (slot.mode === "craft" || slot.resourceKey === "combatModule") {
      priceValue.textContent = "bez ceny";
      materialRequirements.refresh(selectedBatches);
      return;
    }
    priceValue.textContent = "bez ceny";
    materialRequirements.refresh(selectedBatches);
  };

  const quantityControl = createElement(options.mount, "div", "armory-slot__quantity factory-slot__quantity");
  const minusButton = createElement(options.mount, "button", "armory-slot__quantity-btn factory-slot__quantity-btn");
  const plusButton = createElement(options.mount, "button", "armory-slot__quantity-btn factory-slot__quantity-btn");
  const quantityValue = createElement(options.mount, "strong", "armory-slot__quantity-value factory-slot__quantity-value");
  if (quantityControl && minusButton && plusButton && quantityValue) {
    minusButton.type = "button";
    plusButton.type = "button";
    minusButton.textContent = "−";
    plusButton.textContent = "+";
    minusButton.setAttribute("aria-label", `Ubrat výrobu ${slotView.title || slot.resourceKey || "slotu"}`);
    plusButton.setAttribute("aria-label", `Přidat výrobu ${slotView.title || slot.resourceKey || "slotu"}`);
    const refreshQuantity = () => {
      const queueSpace = queueCap > 0 ? Math.max(0, queueCap - queuedAmount) : Number.POSITIVE_INFINITY;
      const serverLimit = Math.max(0, Number(slotView.maxStartQuantity ?? Number.POSITIVE_INFINITY));
      const selectionLimit = Math.min(
        Number.isFinite(queueSpace) ? Math.max(1, queueSpace) : Number.POSITIVE_INFINITY,
        serverLimit > 0 ? serverLimit : 1
      );
      selectedBatches = Math.max(1, Math.min(selectedBatches, selectionLimit));
      writeProductionQuantitySelection(options.mount, batchSelectionKey, selectedBatches);
      quantityValue.textContent = String(selectedBatches);
      minusButton.disabled = selectedBatches <= 1 || !slotView.canStart;
      plusButton.disabled = !slotView.canStart
        || Number.isFinite(selectionLimit) && selectedBatches >= selectionLimit;
      updatePrice();
    };
    minusButton.addEventListener("click", () => {
      selectedBatches -= 1;
      refreshQuantity();
    });
    plusButton.addEventListener("click", () => {
      selectedBatches += 1;
      refreshQuantity();
    });
    quantityControl.append(minusButton, quantityValue, plusButton);
    refreshQuantity();
  }

  const startButton = createElement(options.mount, "button", "button drug-lab-mini-btn factory-slot-button");
  const pauseButton = createElement(options.mount, "button", "button drug-lab-mini-btn factory-slot-button");
  if (startButton && pauseButton) {
    startButton.type = "button";
    startButton.dataset.factorySlotToggleState = "start";
    startButton.textContent = "Spustit";
    startButton.disabled = !slotView.canStart;
    startButton.title = startButton.disabled
      ? (slotView.disabledReason || "Chybí vstupy, místo ve frontě nebo volná lokální kapacita.")
      : "Spustit výrobu.";
    startButton.addEventListener("click", () => {
      clearProductionQuantitySelection(options.mount, batchSelectionKey);
      const binding = resolveFactorySlotBinding(options.mount, batchSelectionKey, slotView, callbacks);
      if (typeof binding.callbacks?.onStartSlot === "function") {
        triggerProductionSlotStartEffect(options.mount, batchSelectionKey, card);
        binding.callbacks.onStartSlot(binding.slotView, { batchCount: selectedBatches });
      }
    });
    pauseButton.type = "button";
    pauseButton.dataset.factorySlotToggleState = "stop";
    pauseButton.textContent = "Zrušit";
    pauseButton.setAttribute(
      "aria-label",
      `Zrušit čekající výrobu ${slotView.title || slot.resourceKey || ""}`
    );
    pauseButton.disabled = typeof slotView.canCancelWaiting === "boolean"
      ? !slotView.canCancelWaiting
      : Math.max(0, Math.floor(Number(slot.queuedAmount ?? slotView.queuedAmount ?? 0)))
        - (slot.isProducing ? 1 : 0) <= 0;
    pauseButton.title = pauseButton.disabled
      ? "Není co zrušit: aktivní kus nelze zrušit."
      : "Zrušit čekající kusy a vrátit jejich náklady.";
    pauseButton.addEventListener("click", () => {
      const binding = resolveFactorySlotBinding(options.mount, batchSelectionKey, slotView, callbacks);
      if (typeof binding.callbacks?.onPauseSlot === "function") {
        binding.callbacks.onPauseSlot(binding.slotView);
      }
    });
    actions.append(quantityControl, startButton, pauseButton);
  }

  card.append(head, metrics, actions);
  applyPendingProductionSlotStartEffect(options.mount, batchSelectionKey, card);
  return card;
}

export function renderFactorySlotList(mount, slots = [], callbacks = {}, options = {}) {
  if (!mount) return false;
  const slotViews = Array.isArray(slots) ? slots : [];
  const contextKey = String(options.selectionScopeKey || "factory");
  const previousState = factorySlotListStateByMount.get(mount);
  const bindings = new Map(slotViews.map((slotView) => {
    const slot = slotView?.slot || {};
    return [getFactoryBatchSelectionKey(slotView, slot, options), { callbacks, slotView }];
  }));
  factorySlotListStateByMount.set(mount, { bindings, contextKey });
  mount.classList?.add?.("factory-slot-grid");
  const nextCards = [];
  for (const slotView of slotViews) {
    const card = renderFactorySlotCard(slotView, callbacks, { ...options, mount });
    if (card) nextCards.push(card);
  }
  const currentCards = Array.from(mount.children || []);
  const previousBindingKeys = [...(previousState?.bindings?.keys?.() || [])];
  const nextBindingKeys = [...bindings.keys()];
  const presentationIsUnchanged = previousState?.contextKey === contextKey
    && previousBindingKeys.length === nextBindingKeys.length
    && previousBindingKeys.every((key, index) => key === nextBindingKeys[index])
    && currentCards.length === nextCards.length
    && currentCards.every((card, index) => haveEquivalentProductionNodes(card, nextCards[index]));
  if (!presentationIsUnchanged) {
    mount.replaceChildren(...nextCards);
  }
  return true;
}

export function renderServerFactorySlotList(mount, lines = [], callbacks = {}, options = {}) {
  if (!mount) return false;
  const slotViews = (Array.isArray(lines) ? lines : []).map((line) => {
    const displayCost = { cleanCash: 0, metalParts: 0, techCore: 0 };
    const inputAmounts = { metalParts: 0, techCore: 0 };
    for (const row of Array.isArray(line?.costDisplayRows) ? line.costDisplayRows : []) {
      const resourceKey = String(row?.resourceKey || "");
      if (resourceKey === "cash") {
        displayCost.cleanCash = Math.max(0, Number(row.amount || 0));
        continue;
      }
      const legacyResourceKey = getFactoryLegacyResourceKey(resourceKey);
      if (legacyResourceKey !== "metalParts" && legacyResourceKey !== "techCore") continue;
      displayCost[legacyResourceKey] = Math.max(0, Number(row.amount || 0));
      inputAmounts[legacyResourceKey] = Math.max(0, Number(row.availableAmount ?? 0));
    }
    const durationMs = Math.max(0, Number(line?.effectiveUnitDurationTicks || 0) * Number(options.tickRateMs || FREE_GAMEPLAY_TICK_MS));
    return {
      recipeId: line.recipeId,
      status: line.status || "ready",
      loading: line.loading === true,
      remainingMs: Math.max(0, Number(line.remainingMs || 0)),
      usesAuthoritativeCountdown: line.status === "processing" || Number(line.remainingMs || 0) > 0,
      slot: {
        resourceKey: getFactoryLegacyResourceKey(line.resourceKey),
        isProducing: line.status === "processing",
        producedAmount: line.producedAmount,
        queuedAmount: line.queuedAmount,
        queueCap: line.queueCapacity,
        slotCap: line.producedCapacity
      },
      title: line.label,
      resourceColor: line.resourceKey,
      durationMs,
      queuedAmount: line.queuedAmount,
      queueCap: line.queueCapacity,
      slotOutputCap: line.producedCapacity,
      displayCost,
      inputAmounts,
      canStart: line.canStart === true,
      canCancelWaiting: line.canCancelWaiting === true,
      maxStartQuantity: Math.max(0, Number(line.maxStartQuantity || 0)),
      disabledReason: line.disabledReason || null,
      ...getFactoryServerVisual(line.resourceKey)
    };
  });
  return renderFactorySlotList(mount, slotViews, callbacks, options);
}

function formatFactoryCleanCashCost(slotView, quantity) {
  if (slotView?.loading) return "—";
  const cleanCash = Math.max(0, Number(slotView?.displayCost?.cleanCash || 0) * Math.max(1, Number(quantity || 1)));
  return cleanCash > 0 ? `$${cleanCash} clean` : "bez ceny";
}

function getFactoryStatusLabel(status) {
  return {
    loading: "Načítání",
    ready: "Připraveno",
    processing: "Výroba",
    waiting: "Čeká",
    full: "Plná kapacita",
    over_capacity: "Překročená kapacita",
    completed: "Hotovo"
  }[status] || "Připraveno";
}

function getFactoryLegacyResourceKey(resourceKey) {
  return resourceKey === "metal-parts" ? "metalParts" : resourceKey === "tech-core" ? "techCore" : "combatModule";
}

function getFactoryServerVisual(resourceKey) {
  return resourceKey === "metal-parts"
    ? { iconToneClass: "drug-production-slot__icon--amber", iconGlyphClass: "drug-production-slot__icon--crate" }
    : resourceKey === "tech-core"
      ? { iconToneClass: "drug-production-slot__icon--cyan", iconGlyphClass: "drug-production-slot__icon--chip" }
      : { iconToneClass: "drug-production-slot__icon--red", iconGlyphClass: "drug-production-slot__icon--crosshair" };
}

export function renderProductionPanel(productionViewModel = {}, callbacks = {}, options = {}) {
  const mount = productionViewModel.mount || options.mount || null;
  if (!mount) {
    return false;
  }
  const contextKey = String(options.presentationScopeKey || "production");
  const recipes = Array.isArray(productionViewModel.recipes) ? productionViewModel.recipes : [];
  if (recipes.length === 0) {
    const empty = createElement(mount, "div", options.emptyClassName || "buildings-popup__empty");
    if (empty) {
      empty.textContent = productionViewModel.emptyText || "Bez produkce.";
      return replaceProductionChildrenIfChanged(mount, [empty], contextKey, productionPanelStateByMount);
    }
    return replaceProductionChildrenIfChanged(mount, [], contextKey, productionPanelStateByMount);
  }
  const nextCards = [];
  const usesPrebuiltCards = recipes.some((recipe) => recipe?.prebuiltCard);
  for (const recipe of recipes) {
    if (usesPrebuiltCards && !recipe?.prebuiltCard) continue;
    const card = recipe?.prebuiltCard || renderRecipeCard(recipe, callbacks, { ...options, mount });
    if (card) nextCards.push(card);
  }
  return replaceProductionChildrenIfChanged(mount, nextCards, contextKey, productionPanelStateByMount);
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
