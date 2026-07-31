import { PRODUCTION_BUILDING_CONFIG, PRODUCTION_SLOT_VISUALS } from "../runtime/productionBuildingData.js";
import { renderServerFactorySlotList } from "./productionPanel.js";
import { renderServerDrugLabRecipeCard } from "./serverDrugLabRecipeCard.js";
import { renderServerPharmacyRecipeCard } from "./serverPharmacyRecipeCard.js";

export const SERVER_PRODUCTION_POPUPS = Object.freeze({
  pharmacy: Object.freeze({
    popup: "[data-pharmacy-popup]",
    close: "[data-pharmacy-popup-close]",
    panel: "[data-production-panel='pharmacy']",
    tab: "[data-production-building-tab^='pharmacy:']",
    tabPanel: "[data-production-building-panel^='pharmacy:']"
  }),
  drug_lab: Object.freeze({
    popup: "[data-druglab-popup]",
    close: "[data-druglab-popup-close]",
    panel: "[data-production-panel='druglab']",
    tab: "[data-production-building-tab^='druglab:']",
    tabPanel: "[data-production-building-panel^='druglab:']"
  }),
  armory: Object.freeze({
    popup: "[data-armory-popup]",
    close: "[data-armory-popup-close]",
    panel: "[data-production-panel='armory']",
    tab: "[data-production-building-tab^='armory:']",
    tabPanel: "[data-production-building-panel^='armory:']"
  }),
  factory: Object.freeze({
    popup: "[data-factory-popup]",
    close: "[data-factory-popup-close]",
    panel: "[data-factory-slot-list]",
    tab: "[data-factory-tab]",
    tabPanel: "[data-factory-panel]"
  })
});

export const normalizeServerProductionBuildingType = (value) => {
  const type = String(value || "").trim().replace(/-/gu, "_");
  return type === "druglab" ? "drug_lab" : type;
};

const setText = (scope, selector, value) => {
  const element = scope?.querySelector?.(selector);
  if (element) element.textContent = String(value ?? "");
};

const formatMultiplier = (lines = [], networkMultiplier = null) => {
  const explicit = Number(networkMultiplier);
  if (Number.isFinite(explicit) && explicit > 0) return `×${explicit.toFixed(2)}`;
  const sample = lines.find((line) => (
    Number(line?.baseUnitDurationTicks || 0) > 0
    && Number(line?.effectiveUnitDurationTicks || 0) > 0
  ));
  if (!sample) return "×1.00";
  return `×${(
    Number(sample.baseUnitDurationTicks)
    / Number(sample.effectiveUnitDurationTicks)
  ).toFixed(2)}`;
};

const appendEmptyState = (mount, text = "Server zatím neposlal výrobní linky.") => {
  const empty = mount?.ownerDocument?.createElement?.("p");
  if (!empty) return;
  empty.className = "buildings-popup__empty";
  empty.textContent = text;
  mount.replaceChildren(empty);
};

export function renderServerProductionBuildingLoading({ binding, building } = {}) {
  if (!binding?.mount) return false;
  appendEmptyState(
    binding.mount,
    `Načítám serverový detail: ${building?.label || building?.displayName || "budova"}.`
  );
  if (binding.collect) {
    binding.collect.disabled = true;
    binding.collect.title = "Serverový detail budovy se načítá.";
  }
  const upgrade = binding.popup?.querySelector?.(
    binding.type === "factory"
      ? "[data-factory-upgrade]"
      : "[data-production-building-upgrade]"
  );
  if (upgrade) upgrade.hidden = true;
  return true;
}

const renderFactory = ({ binding, building, model, lines, tickRateMs, onStart, onCancel }) => {
  const summaries = new Map((model.producedSummary || []).map((item) => [item.resourceKey, item]));
  const enrichedLines = lines.map((line) => {
    const summary = summaries.get(line.resourceKey);
    return {
      ...line,
      producedAmount: summary?.currentAmount || 0,
      producedCapacity: summary?.capacity || 0
    };
  });
  setText(binding.popup, "[data-factory-header-level]", `Lv ${model.level || 1}`);
  setText(binding.popup, "[data-factory-owned-count]", model.network?.activeFactoryCount || 1);
  setText(
    binding.popup,
    "[data-factory-multiplier]",
    formatMultiplier(enrichedLines, model.network?.effectiveSpeedMultiplier)
  );
  setText(binding.popup, "[data-factory-upgrade-cost]", "SERVER");
  const upgrade = binding.popup.querySelector("[data-factory-upgrade]");
  if (upgrade) upgrade.hidden = true;
  if (enrichedLines.length === 0) return appendEmptyState(binding.mount);
  renderServerFactorySlotList(binding.mount, enrichedLines, {
    onStartSlot: (line, payload) => onStart(building, line, payload?.batchCount || 1),
    onPauseSlot: (line) => onCancel(building, line)
  }, { tickRateMs });
};

const renderProductionCards = ({ binding, building, model, lines, tickRateMs, onStart, onCancel }) => {
  if (lines.length === 0) return appendEmptyState(binding.mount);
  const cardRenderer = binding.type === "pharmacy"
    ? renderServerPharmacyRecipeCard
    : renderServerDrugLabRecipeCard;
  const buildingName = binding.type === "drug_lab" ? "druglab" : binding.type;
  const cards = lines.map((line) => cardRenderer({
    root: binding.popup,
    buildingName,
    recipeId: line.recipeId,
    serverLine: line,
    cleanCashAmount: model.cleanCashAmount,
    tickRateMs,
    visual: PRODUCTION_SLOT_VISUALS[buildingName]?.[line.recipeId] || null
  }, {
    onStart: ({ batchCount }) => onStart(building, line, batchCount || 1),
    onStop: () => onCancel(building, line)
  }, { mount: binding.mount })).filter(Boolean);
  binding.mount.replaceChildren(...cards);
};

const renderProductionHeader = ({ binding, building, model, lines }) => {
  const activeCount = binding.type === "armory"
    ? model.network?.activeArmoryCount || 1
    : model.level || building.level || 1;
  const explicitMultiplier = binding.type === "armory"
    ? model.network?.effectiveSpeedMultiplier
    : null;
  setText(binding.popup, "[data-production-building-header-level]", `Lv ${model.level || 1}`);
  setText(binding.popup, "[data-production-building-level]", activeCount);
  setText(
    binding.popup,
    "[data-production-building-multiplier]",
    formatMultiplier(lines, explicitMultiplier)
  );
  setText(binding.popup, "[data-production-building-upgrade-cost]", "SERVER");
  setText(binding.popup, "[data-production-building-info-upgrade-cost]", "Server");
  setText(binding.popup, "[data-production-building-info-upgrade-benefit]", "Řízeno autoritativně");
  setText(
    binding.popup,
    "[data-production-building-info-text]",
    building.info
      || PRODUCTION_BUILDING_CONFIG[binding.type === "drug_lab" ? "druglab" : binding.type]?.infoText
      || ""
  );
  setText(
    binding.popup,
    "[data-production-building-info-effects]",
    building.passivePhaseEffectLabel || `${lines.length} výrobních linek · stav potvrzuje server`
  );
  const upgrade = binding.popup.querySelector("[data-production-building-upgrade]");
  if (upgrade) upgrade.hidden = true;
  const upgradeInfo = binding.popup.querySelector(".building-info-upgrade-mini");
  if (upgradeInfo) upgradeInfo.hidden = true;
};

export function renderServerProductionBuilding({
  binding,
  building,
  model,
  lines,
  tickRateMs,
  onStart,
  onCancel
}) {
  if (binding.type === "factory") {
    renderFactory({ binding, building, model, lines, tickRateMs, onStart, onCancel });
  } else {
    renderProductionHeader({ binding, building, model, lines });
    renderProductionCards({ binding, building, model, lines, tickRateMs, onStart, onCancel });
  }
  if (binding.collect) {
    const canCollect = lines.some((line) => line.canCollect);
    binding.collect.disabled = !canCollect;
    binding.collect.title = canCollect
      ? "Vybrat hotovou produkci do skladu"
      : "Není nic hotového k vyzvednutí";
  }
  return true;
}
