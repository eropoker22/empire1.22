function createElement(scope, tag, className = "") {
  const documentRef = scope?.ownerDocument || (typeof document !== "undefined" ? document : null);
  if (!documentRef?.createElement) return null;
  const element = documentRef.createElement(tag);
  if (className) element.className = className;
  return element;
}

function formatDuration(value, options = {}) {
  const totalSeconds = Math.max(0, Math.ceil(Number(value || 0) / 1000));
  if (typeof options.formatDurationLabel === "function") return options.formatDurationLabel(totalSeconds * 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? String(minutes) + "m " + String(seconds).padStart(2, "0") + "s" : String(seconds) + "s";
}

function metric(mount, label, value, inline = false) {
  const wrap = createElement(mount, "div", inline
    ? "drug-production-slot__metric drug-production-slot__metric--inline"
    : "drug-production-slot__metric");
  const key = createElement(mount, "span", "drug-production-slot__metric-label");
  const amount = createElement(mount, inline ? "span" : "strong", inline
    ? "drug-production-slot__metric-inline-value"
    : "drug-production-slot__metric-value");
  if (!wrap || !key || !amount) return null;
  key.textContent = label;
  amount.textContent = value;
  wrap.append(key, amount);
  return wrap;
}

const STATUS_LABELS = Object.freeze({
  ready: "Připraveno",
  processing: "Výroba",
  waiting: "Čeká",
  full: "Plná kapacita",
  over_capacity: "Překročená kapacita",
  completed: "Hotovo"
});

const formatMoney = (value, options) => typeof options.formatCurrency === "function"
  ? options.formatCurrency(Math.max(0, Math.floor(Number(value || 0))))
  : "$" + Math.max(0, Math.floor(Number(value || 0))).toLocaleString("cs-CZ");

export function renderServerDrugLabRecipeCard(viewModel = {}, callbacks = {}, options = {}) {
  const line = viewModel.serverLine || {};
  const visual = viewModel.visual || {};
  const isArmory = viewModel.buildingName === "armory";
  const armoryCategory = line.category === "defense" ? "defense" : "attack";
  const card = createElement(options.mount, "article");
  if (!card) return null;
  const active = line.status === "processing";
  card.className = [
    "drug-production-slot",
    isArmory ? "armory-slot armory-slot--" + armoryCategory : "",
    active ? "drug-production-slot--active" : "",
    active && isArmory ? "armory-slot--active" : ""
  ].filter(Boolean).join(" ");
  card.dataset.resourceColor = line.resourceKey || viewModel.recipeId || "";

  const head = createElement(options.mount, "div", "drug-production-slot__head");
  const titleWrap = createElement(options.mount, "div", "drug-production-slot__title-wrap");
  const icon = createElement(options.mount, "span", "drug-production-slot__icon " + (visual.iconToneClass || "drug-production-slot__icon--violet") + " " + (visual.iconGlyphClass || "drug-production-slot__icon--crystal"));
  const titles = createElement(options.mount, "div", "drug-production-slot__titles");
  const title = createElement(options.mount, "strong", "drug-production-slot__title");
  const state = createElement(options.mount, "span", "drug-production-slot__state");
  const metrics = createElement(options.mount, "div", "drug-production-slot__metrics");
  const supplyMetric = createElement(options.mount, "div", "drug-production-slot__metric drug-production-slot__metric--supplies");
  const supplyLabel = createElement(options.mount, "span", "drug-production-slot__metric-label");
  const supplyRow = createElement(options.mount, "div", "drug-production-slot__supply-row");
  const actions = createElement(options.mount, "div", "drug-production-slot__controls");
  const quantity = createElement(options.mount, "div", isArmory ? "armory-slot__quantity" : "drug-production-slot__quantity");
  const minus = createElement(options.mount, "button", isArmory ? "armory-slot__quantity-btn" : "drug-production-slot__quantity-btn");
  const value = createElement(options.mount, "strong", isArmory ? "armory-slot__quantity-value" : "drug-production-slot__quantity-value");
  const plus = createElement(options.mount, "button", isArmory ? "armory-slot__quantity-btn" : "drug-production-slot__quantity-btn");
  const start = createElement(options.mount, "button", "button drug-lab-mini-btn");
  const cancel = createElement(options.mount, "button", "button drug-lab-mini-btn");
  if (![head, titleWrap, icon, titles, title, state, metrics, supplyMetric, supplyLabel, supplyRow, actions, quantity, minus, value, plus, start, cancel].every(Boolean)) return card;

  let selected = 1;
  const maxStart = Math.max(0, Math.floor(Number(line.maxStartQuantity || 0)));
  const inputValues = [];
  const inputs = [
    ...(isArmory || Number(line.unitCleanCashCost || 0) <= 0
      ? []
      : [{ label: "Clean Cash", requiredAmount: line.unitCleanCashCost, availableAmount: viewModel.cleanCashAmount, resourceKey: "cash" }]),
    ...(Array.isArray(line.inputAvailability) ? line.inputAvailability : [])
  ].slice(0, 3);
  if (isArmory) {
    supplyRow.className = "armory-slot__materials-row";
  } else {
    supplyRow.classList.add("drug-production-slot__supply-row--count-" + String(inputs.length));
  }
  for (const input of inputs) {
    const materialClass = input.resourceKey === "metal-parts"
      ? " armory-slot__material-pill--metal"
      : input.resourceKey === "tech-core"
        ? " armory-slot__material-pill--tech"
        : "";
    const pill = createElement(options.mount, "div", isArmory
      ? "armory-slot__material-pill" + materialClass
      : "drug-production-slot__supply-pill");
    const name = createElement(options.mount, "span", isArmory ? "armory-slot__material-name" : "drug-production-slot__supply-name");
    const amount = createElement(options.mount, "strong", isArmory ? "armory-slot__material-value" : "drug-production-slot__supply-value");
    if (!pill || !name || !amount) continue;
    pill.dataset.resourceColor = input.resourceKey || "";
    name.textContent = input.label || input.resourceKey || "";
    pill.append(name, amount);
    supplyRow.append(pill);
    inputValues.push({ amount, required: Math.max(0, Number(input.requiredAmount || 0)), available: Math.max(0, Number(input.availableAmount || 0)) });
  }
  const refresh = () => {
    selected = Math.max(1, Math.min(selected, Math.max(1, maxStart)));
    value.textContent = String(selected);
    minus.disabled = selected <= 1 || maxStart <= 0;
    plus.disabled = selected >= maxStart || maxStart <= 0;
    start.disabled = line.canStart !== true || maxStart <= 0;
    for (const input of inputValues) {
      input.amount.textContent = String(input.required * selected) + "/" + String(input.available);
      input.amount.parentElement?.classList.toggle("is-insufficient", input.available < input.required * selected);
    }
  };

  icon.setAttribute("aria-hidden", "true");
  title.textContent = line.label || "";
  title.title = line.description || "";
  state.textContent = STATUS_LABELS[line.status] || "Připraveno";
  titles.append(title);
  titleWrap.append(icon, titles);
  head.append(titleWrap, state);
  metrics.append(
    metric(options.mount, "Vyrobeno", String(line.producedAmount || 0) + "/" + String(line.producedCapacity || 0) + " ks"),
    metric(options.mount, "Čas", line.status === "processing"
      ? formatDuration(line.remainingMs, options)
      : formatDuration(Number(line.effectiveUnitDurationTicks || 0) * Number(viewModel.tickRateMs || 5000), options)),
    metric(options.mount, "Ve skladu", String(line.playerStoredAmount || 0) + "/" + String(line.playerStoredCapacity || 0) + " ks", true),
    metric(options.mount, "Ve frontě", String(line.queuedAmount || 0) + "/" + String(line.queueCapacity || 0) + " ks", true)
  );
  supplyLabel.textContent = "Vstupy";
  supplyMetric.append(supplyLabel, supplyRow);
  metrics.append(supplyMetric);
  minus.type = "button";
  plus.type = "button";
  minus.textContent = "−";
  plus.textContent = "+";
  minus.setAttribute("aria-label", "Ubrat výrobu " + (line.label || ""));
  plus.setAttribute("aria-label", "Přidat výrobu " + (line.label || ""));
  minus.addEventListener("click", () => { selected -= 1; refresh(); });
  plus.addEventListener("click", () => { selected += 1; refresh(); });
  quantity.append(minus, value, plus);
  start.type = "button";
  start.textContent = "Spustit";
  if (isArmory) start.dataset.armorySlotStart = "";
  start.title = line.disabledReason || "";
  start.addEventListener("click", () => callbacks.onStart?.({ ...viewModel, batchCount: selected }));
  cancel.type = "button";
  cancel.textContent = "Zrušit";
  if (isArmory) cancel.dataset.armorySlotStop = "";
  cancel.disabled = line.canCancelWaiting !== true;
  cancel.title = "Zrušit čekající kusy a vrátit rezervované vstupy";
  cancel.addEventListener("click", () => callbacks.onStop?.(viewModel));
  actions.append(quantity, start, cancel);
  card.append(head, metrics, actions);
  refresh();
  return card;
}
