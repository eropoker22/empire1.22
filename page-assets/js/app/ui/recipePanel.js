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

function formatDuration(value, options = {}) {
  return typeof options.formatDurationLabel === "function"
    ? options.formatDurationLabel(value)
    : `${Math.max(0, Math.ceil(Number(value || 0) / 1000))}s`;
}

function formatMoney(value, options = {}) {
  return typeof options.formatCurrency === "function"
    ? options.formatCurrency(value)
    : `$${Math.max(0, Math.floor(Number(value || 0))).toLocaleString("cs-CZ")}`;
}

function getResourceLabel(itemId, options = {}) {
  return typeof options.getResourceLabel === "function"
    ? options.getResourceLabel(itemId)
    : String(itemId || "").trim() || "Materiál";
}

function normalizeResourceColor(itemId, options = {}) {
  return typeof options.normalizeResourceColorKey === "function"
    ? options.normalizeResourceColorKey(itemId)
    : String(itemId || "").trim();
}

function getInputAmount(itemId, viewModel = {}) {
  return Math.max(0, Number(viewModel.inputAmounts?.[itemId] ?? viewModel.inventory?.[itemId] ?? 0));
}

function getSlotState(job = null) {
  if (!job) {
    return { label: "Připraveno", isActive: false };
  }
  if (job.status === "running") {
    return { label: "Výroba", isActive: true };
  }
  return { label: "Hotovo", isActive: true };
}

function createMetricBlock(scopeElement, { label, value, inline = false } = {}) {
  const metric = createElement(scopeElement, "div", inline
    ? "drug-production-slot__metric drug-production-slot__metric--inline"
    : "drug-production-slot__metric");
  const labelElement = createElement(scopeElement, "span", "drug-production-slot__metric-label");
  if (!metric || !labelElement) {
    return null;
  }
  labelElement.textContent = label || "";

  if (inline) {
    const valueElement = createElement(scopeElement, "span", "drug-production-slot__metric-inline-value");
    if (!valueElement) return metric;
    valueElement.textContent = value || "";
    metric.append(labelElement, valueElement);
    return metric;
  }

  const valueElement = createElement(scopeElement, "strong", "drug-production-slot__metric-value");
  if (!valueElement) return metric;
  valueElement.textContent = value || "";
  metric.append(labelElement, valueElement);
  return metric;
}

function createPharmacyMetricBlock(scopeElement, label, value) {
  const metric = createElement(scopeElement, "div", "pharmacy-slot__metric");
  const labelElement = createElement(scopeElement, "span", "pharmacy-slot__metric-label");
  const valueElement = createElement(scopeElement, "strong", "pharmacy-slot__metric-value");
  if (!metric || !labelElement || !valueElement) {
    return null;
  }
  labelElement.textContent = label || "";
  valueElement.textContent = value || "";
  metric.append(labelElement, valueElement);
  return metric;
}

function setMetricValue(metric, value) {
  const target = metric?.querySelector?.(".drug-production-slot__metric-value,.drug-production-slot__metric-inline-value,.pharmacy-slot__metric-value");
  if (target) {
    target.replaceChildren(getDocument(metric).createTextNode(value));
  }
}

function appendChildren(parent, children = []) {
  for (const child of children) {
    if (child) {
      parent.append(child);
    }
  }
}

function renderDrugSupplyRow(viewModel = {}, options = {}) {
  const wrap = createElement(options.mount, "div", "drug-production-slot__metric drug-production-slot__metric--supplies");
  const label = createElement(options.mount, "span", "drug-production-slot__metric-label");
  const row = createElement(options.mount, "div", "drug-production-slot__supply-row");
  if (!wrap || !label || !row) {
    return null;
  }
  label.textContent = "Vstupy";

  for (const [itemId, amount] of Object.entries(viewModel.recipe?.inputs || {})) {
    const pill = createElement(options.mount, "div");
    const name = createElement(options.mount, "span", "drug-production-slot__supply-name");
    const value = createElement(options.mount, "strong", "drug-production-slot__supply-value");
    if (!pill || !name || !value) continue;
    pill.dataset.resourceColor = normalizeResourceColor(itemId, options);
    const variant = itemId === "chemicals"
      ? "drug-production-slot__supply-pill--chemicals"
      : itemId === "biomass"
        ? "drug-production-slot__supply-pill--biomass"
        : "drug-production-slot__supply-pill--stim";
    pill.className = `drug-production-slot__supply-pill ${variant}`;
    name.textContent = getResourceLabel(itemId, options);
    value.textContent = `${getInputAmount(itemId, viewModel)}/${amount}`;
    pill.append(name, value);
    row.append(pill);
  }

  wrap.append(label, row);
  return wrap;
}

function renderArmoryMaterialsRow(viewModel = {}, options = {}) {
  const row = createElement(options.mount, "div", "armory-slot__materials-row");
  if (!row) return null;

  for (const [itemId, amount] of Object.entries(viewModel.recipe?.inputs || {})) {
    const pill = createElement(options.mount, "div");
    const name = createElement(options.mount, "span", "armory-slot__material-name");
    const value = createElement(options.mount, "strong", "armory-slot__material-value");
    if (!pill || !name || !value) continue;
    pill.dataset.resourceColor = normalizeResourceColor(itemId, options);
    pill.className = `armory-slot__material-pill ${itemId === "metal-parts" ? "armory-slot__material-pill--metal" : "armory-slot__material-pill--tech"}`;
    name.textContent = getResourceLabel(itemId, options);
    value.textContent = `${getInputAmount(itemId, viewModel)}/${amount}`;
    pill.append(name, value);
    row.append(pill);
  }

  return row;
}

function renderQuantityControl(viewModel = {}, callbacks = {}, options = {}) {
  const recipe = viewModel.recipe || {};
  const job = viewModel.job || null;
  const startButton = options.startButton;
  const timeMetric = options.timeMetric;
  const queueMetric = options.queueMetric;
  const costMetric = options.costMetric || null;
  const effectiveDurationMs = Math.max(1000, Number(viewModel.effectiveDurationMs || recipe.durationMs || 1000));
  const queueAsBatches = Boolean(options.queueAsBatches);
  const resetQuantityOnJob = Boolean(options.resetQuantityOnJob);
  const extraClass = String(options.extraClass || "");

  let selectedBatches = 1;
  const control = createElement(options.mount, "div", `armory-slot__quantity${extraClass ? ` ${extraClass}` : ""}`);
  const minusButton = createElement(options.mount, "button", `armory-slot__quantity-btn${extraClass ? ` ${extraClass}-btn` : ""}`);
  const plusButton = createElement(options.mount, "button", `armory-slot__quantity-btn${extraClass ? ` ${extraClass}-btn` : ""}`);
  const quantityValue = createElement(options.mount, "strong", `armory-slot__quantity-value${extraClass ? ` ${extraClass}-value` : ""}`);
  if (!control || !minusButton || !plusButton || !quantityValue) {
    return { control: null, getStartBatchCount: () => 1, refresh: () => {} };
  }

  minusButton.type = "button";
  plusButton.type = "button";
  minusButton.textContent = "−";
  plusButton.textContent = "+";
  minusButton.setAttribute("aria-label", `Ubrat výrobu ${recipe.name || "receptu"}`);
  plusButton.setAttribute("aria-label", `Přidat výrobu ${recipe.name || "receptu"}`);
  control.append(minusButton, quantityValue, plusButton);

  const cleanCost = Math.max(0, Number(recipe.cleanMoneyCost || 0));
  const getMaxBatches = () => Math.max(0, Number(
    typeof callbacks.getMaxBatches === "function" ? callbacks.getMaxBatches(recipe, viewModel) : viewModel.maxBatches ?? 99
  ));

  const refresh = () => {
    const maxBatches = getMaxBatches();
    const outputAmount = Math.max(1, Number(recipe.output?.amount || 1));
    selectedBatches = Math.min(Math.max(1, selectedBatches), Math.max(1, maxBatches));
    const queuedAmount = Number(job?.output?.amount || outputAmount * selectedBatches || 0);
    const visibleBatches = job ? Math.max(1, Math.ceil(queuedAmount / outputAmount)) : selectedBatches;
    quantityValue.textContent = String(job && resetQuantityOnJob ? 0 : visibleBatches);
    minusButton.disabled = Boolean(job) || selectedBatches <= 1;
    plusButton.disabled = Boolean(job) || selectedBatches >= maxBatches;
    if (startButton) {
      startButton.disabled = Boolean(job) || selectedBatches > maxBatches || maxBatches <= 0;
    }
    setMetricValue(timeMetric, formatDuration(Number(job?.durationMs || effectiveDurationMs * selectedBatches), options));
    setMetricValue(queueMetric, queueAsBatches ? String(job ? Math.max(1, Math.floor(Number(job.quantity || visibleBatches))) : 0) : `${queuedAmount} ks`);
    if (costMetric) {
      setMetricValue(costMetric, cleanCost ? `${formatMoney(cleanCost * visibleBatches, options)} clean` : "-");
    }
  };

  minusButton.addEventListener("click", () => {
    selectedBatches -= 1;
    refresh();
  });
  plusButton.addEventListener("click", () => {
    selectedBatches += 1;
    refresh();
  });

  return { control, getStartBatchCount: () => selectedBatches, refresh };
}

export function renderRecipeRequirements(recipe = {}, inventory = {}, options = {}) {
  const wrap = createElement(options.mount, "div", "drug-production-slot__supply-row");
  if (!wrap) return null;
  for (const [itemId, amount] of Object.entries(recipe.inputs || {})) {
    const pill = createElement(options.mount, "div", "drug-production-slot__supply-pill");
    const name = createElement(options.mount, "span", "drug-production-slot__supply-name");
    const value = createElement(options.mount, "strong", "drug-production-slot__supply-value");
    if (!pill || !name || !value) continue;
    name.textContent = getResourceLabel(itemId, options);
    value.textContent = `${Math.max(0, Number(inventory?.[itemId] || 0))}/${amount}`;
    pill.append(name, value);
    wrap.append(pill);
  }
  return wrap;
}

export function renderCraftButton(recipe = {}, callbacks = {}, options = {}) {
  const button = createElement(options.mount, "button", options.className || "button drug-lab-mini-btn");
  if (!button) return null;
  button.type = "button";
  button.textContent = options.text || "Spustit";
  button.disabled = Boolean(options.disabled);
  button.addEventListener("click", () => {
    if (typeof callbacks.onCraft === "function") {
      callbacks.onCraft(recipe, options);
    }
  });
  return button;
}

export function renderRecipeCard(viewModel = {}, callbacks = {}, options = {}) {
  const recipe = viewModel.recipe || {};
  const job = viewModel.job || null;
  const buildingName = String(viewModel.buildingName || "");
  const recipeId = String(viewModel.recipeId || "");
  const visual = viewModel.visual || null;
  const slotState = viewModel.slotState || getSlotState(job);
  const effectiveDurationMs = Math.max(1000, Number(viewModel.effectiveDurationMs || recipe.durationMs || 1000));
  const outputInventoryAmount = Math.max(0, Number(viewModel.outputInventoryAmount || 0));
  const card = createElement(options.mount, "article");
  const startButton = createElement(options.mount, "button");
  const collectButton = createElement(options.mount, "button");
  if (!card || !startButton || !collectButton || !recipe) {
    return card;
  }

  let getStartBatchCount = () => 1;
  let refreshQuantityControl = () => {};
  card.dataset.resourceColor = normalizeResourceColor(recipe.output?.itemId || recipeId, options);

  if (buildingName === "pharmacy") {
    card.className = ["pharmacy-slot", visual?.slotClass || "", slotState.isActive ? "pharmacy-slot--active" : "pharmacy-slot--idle"].filter(Boolean).join(" ");
    const head = createElement(options.mount, "div", "pharmacy-slot__head");
    const titleLine = createElement(options.mount, "div", "pharmacy-slot__title-line");
    const icon = createElement(options.mount, "span", `pharmacy-slot__icon ${visual?.iconToneClass || "pharmacy-slot__icon--cyan"} ${visual?.iconGlyphClass || "pharmacy-slot__icon--flask"}`);
    const titleWrap = createElement(options.mount, "div", "pharmacy-slot__title-wrap");
    const title = createElement(options.mount, "strong", "pharmacy-slot__title");
    const product = createElement(options.mount, "span", "pharmacy-slot__product");
    const state = createElement(options.mount, "span", "pharmacy-slot__state");
    const metrics = createElement(options.mount, "div", "pharmacy-slot__metrics");
    const actions = createElement(options.mount, "div", "pharmacy-slot__actions");
    if (icon) icon.setAttribute("aria-hidden", "true");
    if (title) title.textContent = recipe.name || "";
    if (product) product.textContent = visual?.productLabel || "Materiál";
    if (state) state.textContent = slotState.label;
    appendChildren(titleWrap, [title, product]);
    appendChildren(titleLine, [icon, titleWrap]);
    appendChildren(head, [titleLine, state]);
    const timeMetric = createPharmacyMetricBlock(options.mount, "Čas", formatDuration(Number(job?.durationMs || effectiveDurationMs), options));
    const queueMetric = createPharmacyMetricBlock(options.mount, "Ve frontě", "0");
    const costMetric = createPharmacyMetricBlock(options.mount, "Cena", formatMoney(Number(recipe.cleanMoneyCost || 0), options));
    appendChildren(metrics, [
      createPharmacyMetricBlock(options.mount, "Výstup", `${recipe.output?.amount || 0} ks`),
      timeMetric,
      costMetric,
      queueMetric
    ]);
    const quantityControl = renderQuantityControl(viewModel, callbacks, { ...options, startButton, timeMetric, queueMetric, effectiveDurationMs, costMetric, queueAsBatches: true, resetQuantityOnJob: true, extraClass: "pharmacy-slot__quantity" });
    getStartBatchCount = quantityControl.getStartBatchCount;
    refreshQuantityControl = quantityControl.refresh;
    startButton.className = "button pharmacy-slot__btn pharmacy-slot__btn--start";
    collectButton.className = "button pharmacy-slot__btn pharmacy-slot__btn--stop";
    appendChildren(actions, [quantityControl.control, startButton, collectButton]);
    appendChildren(card, [head, metrics, actions]);
  } else {
    const isArmory = buildingName !== "druglab";
    card.className = isArmory
      ? (slotState.isActive ? "armory-slot drug-production-slot armory-slot--active drug-production-slot--active" : "armory-slot drug-production-slot")
      : (slotState.isActive ? "drug-production-slot drug-production-slot--active" : "drug-production-slot");
    const head = createElement(options.mount, "div", isArmory ? "armory-slot__head drug-production-slot__head" : "drug-production-slot__head");
    const titleWrap = createElement(options.mount, "div", isArmory ? "armory-slot__title-wrap drug-production-slot__title-wrap" : "drug-production-slot__title-wrap");
    const icon = createElement(options.mount, "span", `drug-production-slot__icon ${visual?.iconToneClass || (isArmory ? "drug-production-slot__icon--red" : "drug-production-slot__icon--violet")} ${visual?.iconGlyphClass || (isArmory ? "drug-production-slot__icon--crosshair" : "drug-production-slot__icon--crystal")}`);
    const titles = createElement(options.mount, "div", "drug-production-slot__titles");
    const product = createElement(options.mount, "span", "drug-production-slot__product");
    const title = createElement(options.mount, "strong", "drug-production-slot__title");
    const state = createElement(options.mount, "span", "drug-production-slot__state");
    const metrics = createElement(options.mount, "div", "drug-production-slot__metrics");
    const actions = createElement(options.mount, "div", "drug-production-slot__controls");
    if (icon) icon.setAttribute("aria-hidden", "true");
    if (product) product.textContent = visual?.productLabel || (isArmory ? "Attack" : "Drug balík");
    if (title) title.textContent = recipe.name || "";
    if (state) state.textContent = slotState.label;
    appendChildren(titles, [product, title]);
    appendChildren(titleWrap, [icon, titles]);
    appendChildren(head, [titleWrap, state]);
    const timeMetric = createMetricBlock(options.mount, { label: "Čas", value: formatDuration(Number(job?.durationMs || effectiveDurationMs), options) });
    const queueMetric = createMetricBlock(options.mount, { label: "Ve frontě", value: `${Number(job?.output?.amount || recipe.output?.amount || 0)} ks`, inline: true });
    appendChildren(metrics, [
      createMetricBlock(options.mount, { label: "Výstup", value: `${recipe.output?.amount || 0} ks` }),
      timeMetric,
      createMetricBlock(options.mount, { label: "Ve skladu", value: `${outputInventoryAmount} ks`, inline: true }),
      queueMetric
    ]);
    if (isArmory) {
      const supplyMetric = createElement(options.mount, "div", "drug-production-slot__metric drug-production-slot__metric--supplies");
      const supplyLabel = createElement(options.mount, "span", "drug-production-slot__metric-label");
      if (supplyMetric && supplyLabel) {
        supplyLabel.textContent = "Materiál";
        supplyMetric.append(supplyLabel, renderArmoryMaterialsRow(viewModel, options));
        metrics.append(supplyMetric);
      }
    } else {
      metrics.append(renderDrugSupplyRow(viewModel, options));
    }
    const quantityControl = renderQuantityControl(viewModel, callbacks, { ...options, startButton, timeMetric, queueMetric, effectiveDurationMs, extraClass: isArmory ? "" : "drug-production-slot__quantity" });
    getStartBatchCount = quantityControl.getStartBatchCount;
    refreshQuantityControl = quantityControl.refresh;
    startButton.className = "button drug-lab-mini-btn";
    collectButton.className = "button drug-lab-mini-btn";
    if (isArmory) {
      startButton.dataset.armorySlotStart = "true";
      collectButton.dataset.armorySlotStop = "true";
    } else {
      startButton.dataset.drugLabSlotStart = "true";
      collectButton.dataset.drugLabSlotStop = "true";
    }
    appendChildren(actions, [quantityControl.control, startButton, collectButton]);
    appendChildren(card, [head, metrics, actions]);
  }

  startButton.type = "button";
  startButton.textContent = !job ? "Spustit" : job.status === "running" ? "Běží" : "Čeká";
  startButton.disabled = Boolean(job) || viewModel.canStart === false;
  startButton.addEventListener("click", () => {
    if (typeof callbacks.onStart === "function") {
      callbacks.onStart({ ...viewModel, batchCount: Math.max(1, getStartBatchCount()) });
    }
  });
  refreshQuantityControl();

  collectButton.type = "button";
  if (buildingName === "druglab") {
    collectButton.textContent = "Zastavit";
    collectButton.disabled = !job || job.status !== "running";
    collectButton.title = "Zastavit výrobu";
    collectButton.setAttribute("aria-label", `Zastavit výrobu ${recipe.name || ""}`);
    collectButton.addEventListener("click", () => {
      if (typeof callbacks.onStop === "function") callbacks.onStop(viewModel);
    });
  } else {
    collectButton.textContent = "Vybrat";
    collectButton.disabled = !job || job.status !== "ready";
    collectButton.addEventListener("click", () => {
      if (typeof callbacks.onCollect === "function") callbacks.onCollect(viewModel);
    });
  }

  return card;
}

export function renderRecipeList(recipes = [], callbacks = {}, options = {}) {
  const fragment = getDocument(options.mount)?.createDocumentFragment?.();
  if (!fragment) return null;
  for (const recipe of Array.isArray(recipes) ? recipes : []) {
    const card = renderRecipeCard(recipe, callbacks, options);
    if (card) fragment.append(card);
  }
  return fragment;
}

export function renderRecipePanel(recipeViewModel = {}, callbacks = {}, options = {}) {
  const mount = recipeViewModel.mount || options.mount || null;
  if (!mount) return false;
  const list = renderRecipeList(recipeViewModel.recipes || [], callbacks, { ...options, mount });
  mount.replaceChildren();
  if (list) mount.append(list);
  return true;
}

if (typeof window !== "undefined") {
  window.EmpireRecipePanel = {
    renderRecipePanel,
    renderRecipeList,
    renderRecipeCard,
    renderRecipeRequirements,
    renderCraftButton
  };
}
