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
  if (typeof options.formatDurationLabel === "function") {
    return options.formatDurationLabel(value);
  }

  const totalSeconds = Math.max(0, Math.ceil(Number(value || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${String(seconds).padStart(2, "0")}s` : `${seconds}s`;
}

function getCurrentTimeMs(options = {}) {
  const now = Number(options.now);
  return Number.isFinite(now) ? now : Date.now();
}

function getRunningJobCountdownMs(job = null, unitDurationMs = 1000, options = {}) {
  if (!job || job.status !== "running") {
    return null;
  }

  const unitMs = Math.max(1000, Number(unitDurationMs || job.durationMs || 1000));
  const totalDurationMs = Math.max(unitMs, Number(job.durationMs || unitMs));
  const readyAtMs = new Date(job.readyAt || 0).getTime();
  if (!Number.isFinite(readyAtMs) || readyAtMs <= 0) {
    return Math.min(unitMs, totalDurationMs);
  }

  const remainingTotalMs = Math.max(0, readyAtMs - getCurrentTimeMs(options));
  if (remainingTotalMs <= 0) {
    return 0;
  }

  const startedAtMs = readyAtMs - totalDurationMs;
  const elapsedMs = Math.max(0, getCurrentTimeMs(options) - startedAtMs);
  const elapsedInUnitMs = elapsedMs % unitMs;
  const remainingUnitMs = elapsedInUnitMs > 0 ? unitMs - elapsedInUnitMs : unitMs;
  return Math.min(remainingTotalMs, remainingUnitMs);
}

function formatRecipeSlotTime(job = null, effectiveDurationMs = 1000, selectedBatches = 1, options = {}) {
  const countdownMs = getRunningJobCountdownMs(job, effectiveDurationMs, options);
  if (countdownMs !== null) {
    return formatDuration(countdownMs, options);
  }
  return formatDuration(Number(job?.durationMs || effectiveDurationMs * selectedBatches), options);
}

function bindMetricCountdown(metric, getValue, options = {}) {
  if (!metric || Number.isFinite(Number(options.now))) {
    return;
  }
  const timerApi = typeof window !== "undefined" ? window : null;
  if (typeof timerApi?.setInterval !== "function" || typeof timerApi?.clearInterval !== "function") {
    return;
  }
  const intervalId = timerApi.setInterval(() => {
    if (metric.isConnected === false) {
      timerApi.clearInterval(intervalId);
      return;
    }
    setMetricValue(metric, getValue());
  }, 1000);
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

function getRecipeOutputAmount(recipe = {}) {
  return Math.max(0, Number(recipe.output?.amount || 0));
}

function getQueuedOutputAmount(job = null, recipe = {}, options = {}) {
  if (!job) return 0;
  if (options.useQuantityAsOutput) {
    const quantity = Number(job.quantity);
    if (Number.isFinite(quantity) && quantity > 0) {
      return Math.floor(quantity);
    }
  }
  const jobAmount = Number(job.output?.amount);
  if (Number.isFinite(jobAmount) && jobAmount > 0) {
    return Math.floor(jobAmount);
  }
  return getRecipeOutputAmount(recipe) * Math.max(1, Math.floor(Number(job.quantity || 1)));
}

function formatQueuedOutput(job = null, recipe = {}, options = {}) {
  const queueCap = Math.max(0, Math.floor(Number(options.queueCap || options.outputCap || 0)));
  if (job?.status === "ready") {
    return queueCap > 0 ? `0/${queueCap} ks` : "0 ks";
  }
  const queuedAmount = getQueuedOutputAmount(job, recipe, options);
  return queueCap > 0 ? `${Math.min(queueCap, queuedAmount)}/${queueCap} ks` : `${queuedAmount} ks`;
}

function formatReadyOutput(job = null, recipe = {}, options = {}) {
  return job?.status === "ready"
    ? `${getQueuedOutputAmount(job, recipe, options)} ks`
    : "0 ks";
}

function formatCapacityOutput(job = null, recipe = {}, options = {}) {
  const outputCap = Math.max(0, Math.floor(Number(options.outputCap || 0)));
  const readyAmount = job?.status === "ready"
    ? getQueuedOutputAmount(job, recipe, options)
    : 0;
  return outputCap > 0 ? `${Math.min(outputCap, readyAmount)}/${outputCap} ks` : `${readyAmount} ks`;
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
    return { element: null, refresh: () => {} };
  }
  label.textContent = "Vstupy";

  const inputs = Object.entries(viewModel.recipe?.inputs || {});
  row.classList.add(`drug-production-slot__supply-row--count-${Math.min(3, inputs.length)}`);
  const valueEntries = [];

  for (const [itemId, amount] of inputs) {
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
    const available = getInputAmount(itemId, viewModel);
    const baseRequired = Math.max(0, Number(amount || 0));
    value.textContent = `${baseRequired}/${available}`;
    valueEntries.push({ value, available, baseRequired });
    pill.append(name, value);
    row.append(pill);
  }

  wrap.append(label, row);
  return {
    element: wrap,
    refresh: (batchCount = 1) => {
      const safeBatchCount = Math.max(1, Math.floor(Number(batchCount || 1)));
      for (const entry of valueEntries) {
        entry.value.textContent = `${entry.baseRequired * safeBatchCount}/${entry.available}`;
      }
    }
  };
}

function renderArmoryMaterialsRow(viewModel = {}, options = {}) {
  const row = createElement(options.mount, "div", "armory-slot__materials-row");
  if (!row) return { element: null, refresh: () => {} };

  const valueEntries = [];

  for (const [itemId, amount] of Object.entries(viewModel.recipe?.inputs || {})) {
    const pill = createElement(options.mount, "div");
    const name = createElement(options.mount, "span", "armory-slot__material-name");
    const value = createElement(options.mount, "strong", "armory-slot__material-value");
    if (!pill || !name || !value) continue;
    pill.dataset.resourceColor = normalizeResourceColor(itemId, options);
    pill.className = `armory-slot__material-pill ${itemId === "metal-parts" ? "armory-slot__material-pill--metal" : "armory-slot__material-pill--tech"}`;
    name.textContent = getResourceLabel(itemId, options);
    const available = getInputAmount(itemId, viewModel);
    const baseRequired = Math.max(0, Number(amount || 0));
    value.textContent = `${baseRequired}/${available}`;
    valueEntries.push({ value, available, baseRequired });
    pill.append(name, value);
    row.append(pill);
  }

  return {
    element: row,
    refresh: (batchCount = 1) => {
      const safeBatchCount = Math.max(1, Math.floor(Number(batchCount || 1)));
      for (const entry of valueEntries) {
        entry.value.textContent = `${entry.baseRequired * safeBatchCount}/${entry.available}`;
      }
    }
  };
}

function getArmorySlotRole(recipeId = "", recipe = {}) {
  const itemId = String(recipe?.output?.itemId || recipeId || "");
  return ["vest", "barricades", "cameras", "defense-tower", "alarm"].includes(itemId)
    ? "defense"
    : "attack";
}

function createArmoryStrengthLabel(scopeElement, preview = null) {
  if (!preview || !preview.label || !Number.isFinite(Number(preview.basePower))) {
    return null;
  }
  const label = createElement(scopeElement, "span", "armory-slot__strength");
  if (!label) return null;
  label.append(getDocument(scopeElement).createTextNode(`${preview.label} ${preview.basePower}`));
  const bonusLabel = String(preview.bonusLabel || "").trim();
  if (bonusLabel) {
    const bonus = createElement(scopeElement, "span", "armory-slot__strength-bonus");
    if (bonus) {
      bonus.textContent = `(${bonusLabel})`;
      label.append(getDocument(scopeElement).createTextNode(" "), bonus);
    }
  }
  return label;
}

function renderQuantityControl(viewModel = {}, callbacks = {}, options = {}) {
  const recipe = viewModel.recipe || {};
  const job = viewModel.job || null;
  const startButton = options.startButton;
  const timeMetric = options.timeMetric;
  const queueMetric = options.queueMetric;
  const costMetric = options.costMetric || null;
  const effectiveDurationMs = Math.max(1000, Number(viewModel.effectiveDurationMs || recipe.durationMs || 1000));
  const resetQuantityOnJob = Boolean(options.resetQuantityOnJob);
  const useQuantityAsOutput = Boolean(options.useQuantityAsOutput);
  const onQuantityRefresh = typeof options.onQuantityRefresh === "function" ? options.onQuantityRefresh : null;
  const extraClass = String(options.extraClass || "");
  const canTryStartWithoutInputs = Boolean(viewModel.allowStartWithMissingInputs);

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
    const selectionLimitSource = viewModel.maxSelectableBatches ?? maxBatches;
    const selectionLimit = Math.max(1, Math.floor(Number(selectionLimitSource || 1)));
    const outputAmount = useQuantityAsOutput ? 1 : Math.max(1, Number(recipe.output?.amount || 1));
    const canQueueMore = !job || job.status === "running" || job.status === "ready";
    selectedBatches = Math.max(1, Math.min(Math.max(1, selectedBatches), selectionLimit));
    const visibleBatches = canQueueMore ? selectedBatches : Math.max(1, Math.ceil(getQueuedOutputAmount(job, recipe, { useQuantityAsOutput }) / outputAmount));
    quantityValue.textContent = String(job && !canQueueMore && resetQuantityOnJob ? 0 : visibleBatches);
    minusButton.disabled = !canQueueMore || selectedBatches <= 1;
    plusButton.disabled = !canQueueMore || selectedBatches >= selectionLimit;
    if (startButton) {
      startButton.disabled = (!canTryStartWithoutInputs && viewModel.canStart === false) || !canQueueMore;
    }
    setMetricValue(timeMetric, formatRecipeSlotTime(job, effectiveDurationMs, selectedBatches, options));
    setMetricValue(queueMetric, formatQueuedOutput(job, recipe, { useQuantityAsOutput, outputCap: viewModel.outputCap, queueCap: viewModel.queueCap }));
    if (costMetric) {
      const visibleCleanCost = job && !canQueueMore
        ? Math.max(0, Number(job.cleanMoneyCost ?? cleanCost * visibleBatches))
        : cleanCost * selectedBatches;
      setMetricValue(costMetric, cleanCost ? `${formatMoney(visibleCleanCost, options)} clean` : "-");
    }
    onQuantityRefresh?.({ selectedBatches, visibleBatches, job });
  };

  minusButton.addEventListener("click", () => {
    selectedBatches -= 1;
    refresh();
  });
  plusButton.addEventListener("click", () => {
    selectedBatches += 1;
    refresh();
  });

  if (job?.status === "running") {
    bindMetricCountdown(timeMetric, () => formatRecipeSlotTime(job, effectiveDurationMs, selectedBatches, options), options);
  }

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
    value.textContent = `${amount}/${Math.max(0, Number(inventory?.[itemId] || 0))}`;
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
    const state = createElement(options.mount, "span", "pharmacy-slot__state");
    const metrics = createElement(options.mount, "div", "pharmacy-slot__metrics");
    const actions = createElement(options.mount, "div", "pharmacy-slot__actions");
    if (icon) icon.setAttribute("aria-hidden", "true");
    if (title) title.textContent = recipe.name || "";
    if (state) state.textContent = slotState.label;
    appendChildren(titleWrap, [title]);
    appendChildren(titleLine, [icon, titleWrap]);
    appendChildren(head, [titleLine, state]);
    const timeMetric = createPharmacyMetricBlock(options.mount, "Čas", formatRecipeSlotTime(job, effectiveDurationMs, 1, options));
    const queueMetric = createPharmacyMetricBlock(options.mount, "Ve frontě", formatQueuedOutput(job, recipe, { useQuantityAsOutput: true, outputCap: viewModel.outputCap, queueCap: viewModel.queueCap }));
    const cleanCost = Math.max(0, Number(recipe.cleanMoneyCost || 0));
    const costMetric = createPharmacyMetricBlock(options.mount, "Cena", cleanCost ? `${formatMoney(cleanCost, options)} clean` : "-");
    appendChildren(metrics, [
      createPharmacyMetricBlock(options.mount, "Vyrobeno", formatCapacityOutput(job, recipe, { useQuantityAsOutput: true, outputCap: viewModel.outputCap })),
      timeMetric,
      costMetric,
      queueMetric
    ]);
    const quantityControl = renderQuantityControl(viewModel, callbacks, { ...options, startButton, timeMetric, queueMetric, effectiveDurationMs, costMetric, resetQuantityOnJob: true, useQuantityAsOutput: true, extraClass: "pharmacy-slot__quantity" });
    getStartBatchCount = quantityControl.getStartBatchCount;
    refreshQuantityControl = quantityControl.refresh;
    startButton.className = "button pharmacy-slot__btn pharmacy-slot__btn--start";
    collectButton.className = "button pharmacy-slot__btn pharmacy-slot__btn--stop";
    appendChildren(actions, [quantityControl.control, startButton, collectButton]);
    appendChildren(card, [head, metrics, actions]);
  } else {
    const isArmory = buildingName !== "druglab";
    const armoryRole = isArmory ? getArmorySlotRole(recipeId, recipe) : "";
    card.className = isArmory
      ? [
          "armory-slot",
          "drug-production-slot",
          armoryRole ? `armory-slot--${armoryRole}` : "",
          slotState.isActive ? "armory-slot--active drug-production-slot--active" : ""
        ].filter(Boolean).join(" ")
      : (slotState.isActive ? "drug-production-slot drug-production-slot--active" : "drug-production-slot");
    const head = createElement(options.mount, "div", isArmory ? "armory-slot__head drug-production-slot__head" : "drug-production-slot__head");
    const titleWrap = createElement(options.mount, "div", isArmory ? "armory-slot__title-wrap drug-production-slot__title-wrap" : "drug-production-slot__title-wrap");
    const icon = createElement(options.mount, "span", `drug-production-slot__icon ${visual?.iconToneClass || (isArmory ? "drug-production-slot__icon--red" : "drug-production-slot__icon--violet")} ${visual?.iconGlyphClass || (isArmory ? "drug-production-slot__icon--crosshair" : "drug-production-slot__icon--crystal")}`);
    const titles = createElement(options.mount, "div", "drug-production-slot__titles");
    const product = createElement(options.mount, "span", "drug-production-slot__product");
    const title = createElement(options.mount, "strong", "drug-production-slot__title");
    const strengthLabel = isArmory ? createArmoryStrengthLabel(options.mount, viewModel.armoryStrengthPreview) : null;
    const state = createElement(options.mount, "span", "drug-production-slot__state");
    const metrics = createElement(options.mount, "div", "drug-production-slot__metrics");
    const actions = createElement(options.mount, "div", "drug-production-slot__controls");
    if (icon) icon.setAttribute("aria-hidden", "true");
    const productLabel = isArmory ? "" : (visual?.productLabel ?? "");
    if (product && productLabel) product.textContent = productLabel;
    if (title) title.textContent = recipe.name || "";
    if (state) state.textContent = slotState.label;
    appendChildren(titles, [productLabel ? product : null, title, strengthLabel]);
    appendChildren(titleWrap, [icon, titles]);
    appendChildren(head, [titleWrap, state]);
    const timeMetric = createMetricBlock(options.mount, { label: "Čas", value: formatRecipeSlotTime(job, effectiveDurationMs, 1, options) });
    const queueMetric = createMetricBlock(options.mount, { label: "Ve frontě", value: formatQueuedOutput(job, recipe, { outputCap: viewModel.outputCap, queueCap: viewModel.queueCap }), inline: true });
    appendChildren(metrics, [
      createMetricBlock(options.mount, {
        label: "Vyrobeno",
        value: formatCapacityOutput(job, recipe, { outputCap: viewModel.outputCap })
      }),
      timeMetric,
      createMetricBlock(options.mount, { label: "Ve skladu", value: `${outputInventoryAmount} ks`, inline: true }),
      queueMetric
    ]);
    if (isArmory) {
      const supplyMetric = createElement(options.mount, "div", "drug-production-slot__metric drug-production-slot__metric--supplies");
      const supplyLabel = createElement(options.mount, "span", "drug-production-slot__metric-label");
      if (supplyMetric && supplyLabel) {
        const materialRow = renderArmoryMaterialsRow(viewModel, options);
        supplyLabel.textContent = "Materiál";
        appendChildren(supplyMetric, [supplyLabel, materialRow.element]);
        metrics.append(supplyMetric);
        viewModel.refreshInputRequirements = materialRow.refresh;
      }
    } else {
      const supplyRow = renderDrugSupplyRow(viewModel, options);
      metrics.append(supplyRow.element);
      viewModel.refreshInputRequirements = supplyRow.refresh;
    }
    const quantityControl = renderQuantityControl(viewModel, callbacks, {
      ...options,
      startButton,
      timeMetric,
      queueMetric,
      effectiveDurationMs,
      extraClass: isArmory ? "" : "drug-production-slot__quantity",
      onQuantityRefresh: ({ visibleBatches }) => {
        viewModel.refreshInputRequirements?.(visibleBatches);
      }
    });
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
  startButton.textContent = "Spustit";
  startButton.disabled = (Boolean(job) && job.status !== "running" && job.status !== "ready")
    || (viewModel.canStart === false && !viewModel.allowStartWithMissingInputs);
  startButton.addEventListener("click", () => {
    if (typeof callbacks.onStart === "function") {
      callbacks.onStart({ ...viewModel, batchCount: Math.max(1, getStartBatchCount()) });
    }
  });
  refreshQuantityControl();

  collectButton.type = "button";
  if (buildingName === "druglab" || buildingName === "pharmacy" || buildingName === "armory") {
    collectButton.textContent = "Zrušit";
    collectButton.disabled = !job || job.status !== "running";
    collectButton.title = "Zrušit výrobu a vrátit náklady";
    collectButton.setAttribute("aria-label", `Zrušit výrobu ${recipe.name || ""}`);
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
