function createElement(scopeElement, tagName, className = "") {
  const documentRef = scopeElement?.ownerDocument || (typeof document !== "undefined" ? document : null);
  if (!documentRef?.createElement) return null;
  const element = documentRef.createElement(tagName);
  if (className) element.className = className;
  return element;
}

function formatCurrency(value, options = {}) {
  const amount = Math.max(0, Math.floor(Number(value || 0)));
  return typeof options.formatCurrency === "function"
    ? options.formatCurrency(amount)
    : "$" + amount.toLocaleString("cs-CZ");
}

function formatDuration(value, options = {}) {
  const totalSeconds = Math.max(0, Math.ceil(Number(value || 0) / 1000));
  if (typeof options.formatDurationLabel === "function") return options.formatDurationLabel(totalSeconds * 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? String(minutes) + "m " + String(seconds).padStart(2, "0") + "s" : String(seconds) + "s";
}

const STATUS_LABELS = Object.freeze({
  ready: "Připraveno",
  processing: "Výroba",
  waiting: "Čeká",
  full: "Plná kapacita",
  completed: "Hotovo"
});

const metric = (mount, label, value) => {
  const wrap = createElement(mount, "div", "pharmacy-slot__metric");
  const key = createElement(mount, "span", "pharmacy-slot__metric-label");
  const amount = createElement(mount, "strong", "pharmacy-slot__metric-value");
  if (!wrap || !key || !amount) return null;
  key.textContent = label;
  amount.textContent = value;
  wrap.append(key, amount);
  return wrap;
};

export function renderServerPharmacyRecipeCard(viewModel = {}, callbacks = {}, options = {}) {
  const line = viewModel.serverLine || {};
  const visual = viewModel.visual || {};
  const card = createElement(options.mount, "article");
  if (!card) return null;
  const isActive = line.status === "processing";
  card.className = ["pharmacy-slot", visual.slotClass || "", isActive ? "pharmacy-slot--active" : "pharmacy-slot--idle"].filter(Boolean).join(" ");
  card.dataset.resourceColor = line.resourceKey || viewModel.recipeId || "";

  const head = createElement(options.mount, "div", "pharmacy-slot__head");
  const titleLine = createElement(options.mount, "div", "pharmacy-slot__title-line");
  const icon = createElement(options.mount, "span", "pharmacy-slot__icon " + (visual.iconToneClass || "pharmacy-slot__icon--cyan") + " " + (visual.iconGlyphClass || "pharmacy-slot__icon--flask"));
  const title = createElement(options.mount, "strong", "pharmacy-slot__title");
  const state = createElement(options.mount, "span", "pharmacy-slot__state");
  const metrics = createElement(options.mount, "div", "pharmacy-slot__metrics");
  const actions = createElement(options.mount, "div", "pharmacy-slot__actions");
  const quantity = createElement(options.mount, "div", "armory-slot__quantity pharmacy-slot__quantity");
  const minus = createElement(options.mount, "button", "armory-slot__quantity-btn pharmacy-slot__quantity-btn");
  const value = createElement(options.mount, "strong", "armory-slot__quantity-value pharmacy-slot__quantity-value");
  const plus = createElement(options.mount, "button", "armory-slot__quantity-btn pharmacy-slot__quantity-btn");
  const start = createElement(options.mount, "button", "button pharmacy-slot__btn pharmacy-slot__btn--start");
  const cancel = createElement(options.mount, "button", "button pharmacy-slot__btn pharmacy-slot__btn--stop");
  if (![head, titleLine, icon, title, state, metrics, actions, quantity, minus, value, plus, start, cancel].every(Boolean)) return card;

  let selected = 1;
  const maxStart = Math.max(0, Math.floor(Number(line.maxStartQuantity || 0)));
  const refresh = () => {
    selected = Math.max(1, Math.min(selected, Math.max(1, maxStart)));
    value.textContent = String(selected);
    minus.disabled = selected <= 1 || maxStart <= 0;
    plus.disabled = selected >= maxStart || maxStart <= 0;
    start.disabled = line.canStart !== true || maxStart <= 0;
  };
  icon.setAttribute("aria-hidden", "true");
  title.textContent = line.label || "";
  state.textContent = STATUS_LABELS[line.status] || "Připraveno";
  titleLine.append(icon, title);
  head.append(titleLine, state);
  metrics.append(
    metric(options.mount, "Vyrobeno", String(line.producedAmount || 0) + "/" + String(line.producedCapacity || 0) + " ks"),
    metric(options.mount, "Čas", line.status === "processing" ? formatDuration(line.remainingMs, options) : formatDuration(Number(line.effectiveUnitDurationTicks || 0) * Number(viewModel.tickRateMs || 5000), options)),
    metric(options.mount, "Cena", formatCurrency(line.unitCleanCashCost, options) + " clean"),
    metric(options.mount, "Ve frontě", String(line.queuedAmount || 0) + "/" + String(line.queueCapacity || 0) + " ks")
  );
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
  start.disabled = !line.canStart;
  start.title = line.disabledReason || "";
  start.addEventListener("click", () => callbacks.onStart?.({ ...viewModel, batchCount: selected }));
  cancel.type = "button";
  cancel.textContent = "Zrušit";
  cancel.disabled = line.canCancelWaiting !== true;
  cancel.title = cancel.disabled
    ? "Není co zrušit: aktivní kus nelze zrušit."
    : "Zrušit čekající kusy a vrátit clean cash.";
  cancel.addEventListener("click", () => callbacks.onStop?.(viewModel));
  actions.append(quantity, start, cancel);
  card.append(head, metrics, actions);
  refresh();
  return card;
}
