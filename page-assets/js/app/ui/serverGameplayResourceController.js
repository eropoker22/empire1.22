import {
  TOPBAR_CLEAN_MONEY_SELECTOR,
  TOPBAR_DIRTY_MONEY_SELECTOR,
  TOPBAR_INFLUENCE_SELECTOR
} from "../runtime/constants.js";
import {
  formatDistrictMetricNumber,
  formatDistrictMoneyAmount
} from "../runtime/formatters.js";

const VALUE_CONFIG = Object.freeze([
  {
    key: "cleanCash",
    selector: TOPBAR_CLEAN_MONEY_SELECTOR,
    format: formatDistrictMoneyAmount,
    datasetKey: "moneyTarget"
  },
  {
    key: "dirtyCash",
    selector: TOPBAR_DIRTY_MONEY_SELECTOR,
    format: formatDistrictMoneyAmount,
    datasetKey: "moneyTarget"
  },
  {
    key: "influence",
    selector: TOPBAR_INFLUENCE_SELECTOR,
    format: (value) => formatDistrictMetricNumber(value, 0),
    datasetKey: "influenceValue"
  }
]);

export function createServerGameplayResourceController({
  root,
  documentRef = root?.ownerDocument || globalThis.document
} = {}) {
  let mounted = false;
  let elements = new Map();
  let previousValues = new Map();
  const diagnostics = {
    updates: 0,
    domWrites: 0
  };

  const onValueAnimationEnd = (event) => {
    event.currentTarget?.classList?.remove("is-money-up", "is-money-down");
  };

  const mount = () => {
    if (mounted) return false;
    mounted = true;
    const scope = documentRef || root;
    elements = new Map(VALUE_CONFIG.map((config) => {
      const element = scope?.querySelector?.(config.selector) || null;
      element?.addEventListener?.("animationend", onValueAnimationEnd);
      return [config.key, element];
    }));
    for (const element of elements.values()) {
      const pill = element?.closest?.(".resource-pill");
      if (!pill) continue;
      pill.title = element?.matches?.(TOPBAR_CLEAN_MONEY_SELECTOR)
        ? "Aktuální stav čistých peněz."
        : element?.matches?.(TOPBAR_DIRTY_MONEY_SELECTOR)
          ? "Aktuální stav špinavých peněz."
          : pill.title;
    }
    return true;
  };

  const update = (readModel) => {
    if (!mounted || !readModel?.player?.economy) return 0;
    diagnostics.updates += 1;
    const economy = readModel.player.economy;
    let writes = 0;

    for (const config of VALUE_CONFIG) {
      const element = elements.get(config.key);
      if (!element) continue;
      const value = normalizeMetric(economy[config.key]);
      const previousValue = previousValues.get(config.key);
      const text = config.format(value);

      if (element.textContent !== text) {
        element.textContent = text;
        writes += 1;
      }
      if (element.dataset?.[config.datasetKey] !== String(value)) {
        element.dataset[config.datasetKey] = String(value);
        writes += 1;
      }
      if (config.datasetKey === "moneyTarget" && element.dataset?.moneyDisplay !== String(value)) {
        element.dataset.moneyDisplay = String(value);
        writes += 1;
      }
      if (previousValue !== undefined && previousValue !== value && config.key !== "influence") {
        element.classList?.remove("is-money-up", "is-money-down");
        void element.offsetWidth;
        element.classList?.add(value > previousValue ? "is-money-up" : "is-money-down");
        writes += 1;
      }
      previousValues.set(config.key, value);
    }

    diagnostics.domWrites += writes;
    return writes;
  };

  const destroy = () => {
    if (!mounted) return false;
    for (const element of elements.values()) {
      element?.removeEventListener?.("animationend", onValueAnimationEnd);
      element?.classList?.remove?.("is-money-up", "is-money-down");
    }
    elements.clear();
    previousValues.clear();
    mounted = false;
    return true;
  };

  return {
    mount,
    update,
    destroy,
    getDiagnostics: () => ({ ...diagnostics, mounted })
  };
}

function normalizeMetric(value) {
  return Math.max(0, Math.round(Number(value) || 0));
}
