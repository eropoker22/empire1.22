import { renderRecipeCard, renderRecipeList } from "./recipePanel.js";
import { bindSharedCountdown } from "./sharedCountdownTicker.js";

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
    infoTextElement.textContent = isCompactProductionInfo
      ? (config.infoText || "Budova vyrábí materiály pro další produkci.")
      : [
          config.infoText || "",
          `Level ${state.level}: rychlost ${formatProductionSpeedBonus(multiplier)}.`,
          state.level < maxLevel
            ? `Upgrade stojí ${formatMoney(upgradeCost, options)} a zvedne rychlost na ${formatProductionSpeedBonus(nextMultiplier || multiplier || 1)}.`
            : "Budova je na maximálním levelu.",
          `Hotovo k vyzvednutí: ${readyCount} receptů.`
        ].filter(Boolean).join(" ");
  }

  if (infoEffectsElement) {
    infoEffectsElement.textContent = isPharmacy
      ? (effectsLabel || "Lékárna · základní produkční rychlost")
      : isDrugLab
        ? (effectsLabel || "Lab · základní produkční rychlost")
      : isArmory
        ? (effectsLabel || "Zbrojovka · základní produkční rychlost")
      : [
          effectsLabel || `${config.label || "Budova"} · základní produkční rychlost`,
          state.level < maxLevel ? `Další level: +10 % rychlost craftu.` : "Další upgrade už není dostupný.",
          "Vyzvednutí přesune hotové kusy do skladu hráče."
        ].join(" · ");
  }

  if (infoActionsElement) {
    infoActionsElement.replaceChildren();
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
  const serverLine = slotView.serverLine || null;
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
  status.textContent = serverLine
    ? getFactoryServerStatusLabel(serverLine.status)
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

  const timeValue = appendMetric("Čas", serverLine
    ? formatFactoryServerTime(serverLine, options)
    : formatFactorySlotTime(slotView, options));
  if (!serverLine && slot.isProducing) {
    bindFactoryMetricCountdown(timeValue, () => formatFactorySlotTime(slotView, options), options);
  }
  const priceValue = appendMetric("Cena", serverLine
    ? formatFactoryServerCost(serverLine, 1)
    : slotView.priceLabel || "bez ceny");
  const queuedAmount = Math.max(0, Math.floor(Number(slotView.queuedAmount || slot.queuedAmount || 0)));
  const queueCap = Math.max(0, Math.floor(Number(slotView.queueCap || slot.queueCap || slotView.slotStorageCap || slot.slotCap || 0)));
  appendMetric("Ve frontě", serverLine?.loading
    ? "—"
    : queueCap > 0 ? `${queuedAmount}/${queueCap} ks` : `${queuedAmount} ks`, true);

  let selectedBatches = 1;
  const formatFactorySlotCost = (count = 1) => {
    const displayCost = slotView.displayCost || {};
    const cleanCash = Math.max(0, Math.floor(Number(displayCost.cleanCash || 0) * count));
    const techCore = Math.max(0, Math.floor(Number(displayCost.techCore || 0) * count));
    const metalParts = Math.max(0, Math.floor(Number(displayCost.metalParts || 0) * count));
    const parts = [
      cleanCash > 0 ? `$${cleanCash} clean` : "",
      metalParts > 0 ? `${metalParts}× Metal Parts` : "",
      techCore > 0 ? `${techCore} Tech Core` : ""
    ].filter(Boolean);
    return parts.join(" + ") || slotView.priceLabel || "bez ceny";
  };
  const updatePrice = () => {
    if (!priceValue) return;
    if (serverLine) {
      priceValue.textContent = formatFactoryServerCost(serverLine, selectedBatches);
      return;
    }
    if (slotView.displayCost) {
      priceValue.textContent = formatFactorySlotCost(selectedBatches);
      return;
    }
    if (slot.mode === "craft" || slot.resourceKey === "combatModule") {
      const metal = Math.max(0, Number(slotView.unitCost?.metalParts || 0) * selectedBatches);
      const tech = Math.max(0, Number(slotView.unitCost?.techCore || 0) * selectedBatches);
      priceValue.textContent = `${metal} MP + ${tech} TC`;
      return;
    }
    priceValue.textContent = "bez ceny";
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
      const serverLimit = serverLine
        ? Math.max(0, Number(serverLine.maxStartQuantity || 0))
        : Math.max(0, Number(slotView.maxStartQuantity ?? Number.POSITIVE_INFINITY));
      const selectionLimit = Math.min(
        Number.isFinite(queueSpace) ? Math.max(1, queueSpace) : Number.POSITIVE_INFINITY,
        serverLimit > 0 ? serverLimit : 1
      );
      selectedBatches = Math.max(1, Math.min(selectedBatches, selectionLimit));
      quantityValue.textContent = String(selectedBatches);
      minusButton.disabled = selectedBatches <= 1 || Boolean(serverLine ? !serverLine.canStart : !slotView.canStart);
      plusButton.disabled = Boolean(serverLine ? !serverLine.canStart : !slotView.canStart)
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
    startButton.disabled = serverLine ? !serverLine.canStart : !slotView.canStart;
    startButton.title = startButton.disabled
      ? (serverLine?.disabledReason || slotView.disabledReason || "Chybí vstupy, místo ve frontě nebo volná lokální kapacita.")
      : "Spustit výrobu.";
    startButton.addEventListener("click", () => {
      if (typeof callbacks.onStartSlot === "function") callbacks.onStartSlot(serverLine || slotView, { batchCount: selectedBatches });
    });
    pauseButton.type = "button";
    pauseButton.dataset.factorySlotToggleState = "stop";
    pauseButton.textContent = "Zrušit";
    pauseButton.disabled = serverLine
      ? !serverLine.canCancelWaiting
      : Math.max(0, Math.floor(Number(slot.queuedAmount ?? slotView.queuedAmount ?? 0)))
        - (slot.isProducing ? 1 : 0) <= 0;
    pauseButton.title = pauseButton.disabled
      ? "Není co zrušit: aktivní kus nelze zrušit."
      : "Zrušit čekající kusy a vrátit jejich náklady.";
    pauseButton.addEventListener("click", () => {
      if (typeof callbacks.onPauseSlot === "function") callbacks.onPauseSlot(serverLine || slotView);
    });
    actions.append(quantityControl, startButton, pauseButton);
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

export function renderServerFactorySlotList(mount, lines = [], callbacks = {}, options = {}) {
  if (!mount) return false;
  mount.replaceChildren();
  mount.classList?.add?.("factory-slot-grid");
  for (const line of Array.isArray(lines) ? lines : []) {
    const card = renderFactorySlotCard({
      serverLine: line,
      slot: {
        resourceKey: getFactoryLegacyResourceKey(line.resourceKey),
        isProducing: line.status === "processing",
        producedAmount: 0,
        queuedAmount: line.queuedAmount,
        queueCap: line.queueCapacity,
        slotCap: line.queueCapacity
      },
      title: line.label,
      resourceColor: line.resourceKey,
      queuedAmount: line.queuedAmount,
      queueCap: line.queueCapacity,
      slotOutputCap: line.queueCapacity,
      ...getFactoryServerVisual(line.resourceKey)
    }, callbacks, { ...options, mount });
    if (card) mount.append(card);
  }
  return true;
}

function formatFactoryServerTime(line, options) {
  if (line.loading) return "—";
  const duration = Number(line.remainingMs || 0) > 0
    ? Number(line.remainingMs)
    : Number(line.effectiveUnitDurationTicks || 0) * Number(options.tickRateMs || 5000);
  return formatDuration(duration, options);
}

function formatFactoryServerCost(line, quantity) {
  if (line.loading) return "—";
  return (line.costDisplayRows || []).map((row) => {
    const amount = Math.max(0, Number(row.amount || 0) * quantity);
    return row.resourceKey === "cash" ? "$" + amount + " clean" : amount + "× " + row.label;
  }).join(" · ");
}

function getFactoryServerStatusLabel(status) {
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
