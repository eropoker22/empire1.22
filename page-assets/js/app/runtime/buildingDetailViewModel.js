import { ATTACK_WEAPON_LABELS } from "./combatData.js";
// Preview-only legacy building detail model. Server projections own command availability and final action results.
import {
  DISTRICT_BUILDING_TYPE_META
} from "../map/mapConstants.js";
import {
  APARTMENT_BLOCK_MIN_COLLECT_POPULATION,
  ARCADE_NETWORK_CONFIG,
  AUTO_SALON_SUPPORT_CONFIG,
  CLINIC_COUNT_ON_MAP,
  DISTRICT_BUILDING_DETAIL_ACTION_COOLDOWN_MS,
  EXCHANGE_OFFICE_NETWORK_CONFIG,
  FITNESS_CLUB_SUPPORT_CONFIG,
  GARAGE_SUPPORT_CONFIG,
  POWER_STATION_CONFIG,
  RECYCLING_CENTER_CONFIG,
  RECRUITMENT_CENTER_SUPPORT_CONFIG,
  RESTAURANT_NETWORK_CONFIG,
  SCHOOL_CONFIG,
  SMUGGLING_TUNNEL_CONFIG,
  WAREHOUSE_BASE_STORAGE_CAPACITIES,
  WAREHOUSE_NETWORK_CONFIG
} from "./buildingDetailData.js";
import { formatDistrictBuildingTierLabel } from "./districtBuildingData.js";
import {
  formatDistrictBuildingCooldown,
  formatDistrictBuildingMoney
} from "./formatters.js";
import {
  formatGarageEffectiveCooldownLabel,
  resolveAutoSalonCategoryForBuildingAction,
  resolveCombinedEffectiveCooldownMs,
  resolveGarageCategoryForBuildingAction
} from "./garageCooldownRuntime.js";
import {
  getPhaseLockedBuildingActionRule,
  normalizeDayNightPhaseId,
  resolvePhaseLockedBuildingActionDisabledReason
} from "./dayNightActionPhaseRuntime.js";
import {
  PRODUCTION_RESOURCE_LABELS
} from "./productionBuildingData.js";
import {
  formatBuildingActionCategoryLabels,
  formatBuildingActionOutputProfile,
  formatBuildingActionRiskProfile,
  getActionDescription,
  getActionDisabledReason,
  getBuildingActionUi
} from "../ui/buildingActionUiRegistry.js";
import {
  getBuildingSpecialActionCooldownUntil,
  getRecyclingSalvagePoolView,
  isBuildingSpecialActionImplemented,
  resolveBuildingSpecialActionDefinition
} from "./buildingSpecialActionRegistry.js";

function normalizeBuildingLookupKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function createStat(label, value) {
  return { label, value };
}

function createMechanic(label, value) {
  return { label, value };
}

function createMechanicWithTone(label, value, tone = "") {
  return { label, value, tone };
}

function formatPercentShare(value = 0) {
  return `${Math.round(Math.max(0, Number(value || 0)) * 100)}`;
}

function formatMultiplierIncreasePercent(value = 1) {
  const multiplier = Number(value);
  if (!Number.isFinite(multiplier)) {
    return "+0 %";
  }
  const percent = Math.round((multiplier - 1) * 100);
  return `${percent >= 0 ? "+" : ""}${percent} %`;
}

function resolveWarehouseDisplayCapacity(capacity = {}) {
  const fallback = WAREHOUSE_BASE_STORAGE_CAPACITIES;
  const valueOrBase = (key) => {
    const value = Math.max(0, Math.floor(Number(capacity?.[key] || 0)));
    return value > 0 ? value : Math.max(0, Math.floor(Number(fallback[key] || 0)));
  };
  return {
    genericResources: valueOrBase("genericResources"),
    chemicals: valueOrBase("chemicals"),
    biomass: valueOrBase("biomass"),
    metalParts: valueOrBase("metalParts"),
    techCore: valueOrBase("techCore"),
    combatModule: valueOrBase("combatModule"),
    drugsAndBoosts: valueOrBase("drugsAndBoosts"),
    weaponsAndDefense: valueOrBase("weaponsAndDefense")
  };
}

function resolveWarehouseCapacityTone(used = 0, capacity = 0) {
  const maxCapacity = Math.max(0, Number(capacity || 0));
  if (!maxCapacity) {
    return "warehouse-low";
  }
  const fillPct = Math.max(0, Number(used || 0)) / maxCapacity * 100;
  if (fillPct > 85) {
    return "warehouse-high";
  }
  if (fillPct > 30) {
    return "warehouse-medium";
  }
  return "warehouse-low";
}

function resolveServerWarehouseItemTone(item = {}) {
  if (item.isOverCapacity || item.isFull) {
    return "warehouse-high";
  }
  if (item.isNearCapacity) {
    return "warehouse-medium";
  }
  return "warehouse-low";
}

function createServerWarehouseMaterialRows(storage = {}) {
  const groups = Array.isArray(storage.groups) ? storage.groups : [];
  return groups.flatMap((group) => (Array.isArray(group?.items) ? group.items : []).map((item) => (
    createMechanicWithTone(
      "Materiál",
      `${item.label || item.resourceKey || "Položka"} ${Math.max(0, Number(item.currentAmount || 0))}/${Math.max(0, Number(item.maxAmount || 0))}`,
      resolveServerWarehouseItemTone(item)
    )
  )));
}

function hasBuildingUpgradeCapability(mechanics = {}) {
  const maxLevel = Number(mechanics?.maxLevel);
  if (Number.isFinite(maxLevel)) {
    return maxLevel > 1;
  }
  return Boolean(mechanics?.nextLevel);
}

function normalizeEffectToneLabel(value = "") {
  return normalizeBuildingLookupKey(value).replace(/\s+/g, " ");
}

function normalizeClinicRecoveryItemType(itemType = "") {
  const normalized = normalizeBuildingLookupKey(itemType).replace(/\s+/g, "-");
  if (normalized === "gang-members" || normalized === "gang-member" || normalized === "members") return "population";
  if (normalized === "population" || normalized === "populace" || normalized === "obyvatele") return "population";
  return normalized;
}

function createClinicStabilizationPreview(mechanics = {}) {
  const fresh = Array.isArray(mechanics.clinicRecoveryPool?.fresh) ? mechanics.clinicRecoveryPool.fresh : [];
  const recoveryRate = Math.max(0, Number(mechanics.clinicRecoveryRatePct || 0)) / 100;
  const rawByType = {};
  let recoverableAmount = 0;
  for (const entry of fresh) {
    const itemType = normalizeClinicRecoveryItemType(entry?.itemType || entry?.itemId);
    if (itemType !== "population") continue;
    recoverableAmount += Math.max(0, Math.floor(Number(entry?.amount || 0)));
    const source = String(entry?.source || "");
    const rate = source === "trap" || source === "toxic_trap" ? recoveryRate * 0.5 : recoveryRate;
    rawByType[itemType] = Math.max(0, Number(rawByType[itemType] || 0)) + Math.max(0, Number(entry?.amount || 0)) * rate;
  }
  return {
    recoverableAmount,
    population: Math.floor(Math.max(0, Number(rawByType.population || 0)))
  };
}

function formatClinicStabilizationRewardSummary(preview = {}) {
  return `Návrat z léčby: Populace +${Math.max(0, Math.floor(Number(preview.population || 0)))}`;
}

const DAY_NIGHT_PHASE_EFFECTS = Object.freeze({
  day: Object.freeze({
    label: "DEN",
    legalIncomePct: 15,
    dirtyIncomePct: -10,
    heatPct: 10,
    legalProductionPct: 10,
    illegalProductionPct: -10,
    rumorGenerationPct: -20,
    rumorTruthPct: 10
  }),
  night: Object.freeze({
    label: "NOC",
    legalIncomePct: -10,
    dirtyIncomePct: 25,
    heatPct: -5,
    legalProductionPct: 0,
    illegalProductionPct: 26,
    rumorGenerationPct: 35,
    rumorTruthPct: -10
  })
});

const ILLEGAL_DAY_NIGHT_BUILDING_TYPES = new Set([
  "casino",
  "arcade",
  "exchange",
  "strip-club",
  "vip-lounge",
  "smuggling-tunnel",
  "street-dealers",
  "drug-lab",
  "armory"
]);

const PRODUCTION_DAY_NIGHT_BUILDING_TYPES = Object.freeze({
  pharmacy: "legal",
  factory: "legal",
  "drug-lab": "illegal",
  armory: "illegal"
});

const PASSIVE_DAY_NIGHT_BUILDING_EFFECTS = Object.freeze({
  restaurant: {
    day: { cleanIncomePct: 15, rumorGenerationPct: -10, rumorTruthPct: 10 },
    night: { cleanIncomePct: -5, rumorGenerationPct: 10 }
  },
  retail: {
    day: { cleanIncomePct: 20, influencePct: 8 },
    night: { cleanIncomePct: -10 }
  },
  "city-hall": {
    day: { influencePct: 20, heatPct: -8 },
    night: { influencePct: -10 }
  },
  court: {
    day: { influencePct: 12, heatPct: -10 },
    night: { influencePct: -8 }
  },
  parliament: {
    day: { influencePct: 25, cleanIncomePct: 10 },
    night: { influencePct: -10 }
  },
  "central-bank": {
    day: { cleanIncomePct: 15, heatPct: -5 },
    night: { heatPct: 8 }
  },
  "stock-exchange": {
    day: { cleanIncomePct: 8, heatPct: -5 },
    night: { cleanIncomePct: 4, heatPct: 8 }
  },
  clinic: {
    day: { cleanIncomePct: 5, heatPct: -5 },
    night: { cleanIncomePct: -5 }
  },
  school: {
    day: { cleanIncomePct: 5, populationPct: 20 },
    night: { cleanIncomePct: -10, populationPct: -10 }
  },
  "recruitment-center": {
    day: { cleanIncomePct: 10 }
  },
  "fitness-club": {
    day: { cleanIncomePct: 10 }
  },
  "power-plant": {
    day: { cleanIncomePct: 15, heatPct: -5 },
    night: { heatPct: 8 }
  },
  factory: {
    day: { productionPct: 10 },
    night: { productionPct: -2 }
  },
  pharmacy: {
    day: { productionPct: 10 }
  },
  arcade: {
    day: { dirtyIncomePct: -10 },
    night: { dirtyIncomePct: 20, cleanIncomePct: 5 }
  },
  casino: {
    day: { dirtyIncomePct: -12, heatPct: 12 },
    night: { dirtyIncomePct: 25, influencePct: 10 }
  },
  exchange: {
    day: { heatPct: 12 },
    night: { dirtyIncomePct: 20, cleanIncomePct: 8 }
  },
  "smuggling-tunnel": {
    day: { dirtyIncomePct: -50, heatPct: 12 },
    night: { dirtyIncomePct: 25 }
  },
  "street-dealers": {
    day: { dirtyIncomePct: -10, heatPct: 15 },
    night: { dirtyIncomePct: 25 }
  },
  "strip-club": {
    day: { rumorGenerationPct: -10, rumorTruthPct: 8 },
    night: { dirtyIncomePct: 25, influencePct: 20, rumorGenerationPct: 25 }
  },
  "vip-lounge": {
    day: { rumorGenerationPct: -10, rumorTruthPct: 10 },
    night: { influencePct: 10, rumorGenerationPct: 25, rumorTruthPct: -5 }
  },
  port: {
    day: { heatPct: -5 },
    night: { dirtyIncomePct: 15, cleanIncomePct: 5 }
  },
  "drug-lab": {
    day: { productionPct: -10, heatPct: 12 },
    night: { productionPct: 20 }
  },
  "convenience-store": {
    day: { cleanIncomePct: 12, rumorTruthPct: 8 },
    night: { dirtyIncomePct: 15, rumorGenerationPct: 15 }
  },
  warehouse: {
    day: { cleanIncomePct: 5 }
  },
  "auto-salon": {
    day: { cleanIncomePct: 10 },
    night: { dirtyIncomePct: 5 }
  },
  "recycling-center": {
    day: { heatPct: -5 },
    night: { cleanIncomePct: 10 }
  }
});

const RUMOR_DAY_NIGHT_BUILDING_TYPES = new Set([
  "restaurant",
  "convenience-store",
  "strip-club",
  "vip-lounge"
]);

const DAY_NIGHT_BUILDING_TYPE_ALIASES = Object.freeze({
  autosalon: "auto-salon",
  burza: "stock-exchange",
  "bytovy blok": "apartment-block",
  casino: "casino",
  "centralni banka": "central-bank",
  "drug lab": "drug-lab",
  "energeticka stanice": "power-plant",
  factory: "factory",
  herna: "arcade",
  kasino: "casino",
  lekarna: "pharmacy",
  lekarny: "pharmacy",
  magistrat: "city-hall",
  "obchodni centrum": "retail",
  parlament: "parliament",
  "pasovaci tunel": "smuggling-tunnel",
  "poulicni dealeri": "street-dealers",
  pristav: "port",
  restaurace: "restaurant",
  smenarna: "exchange",
  skladiste: "warehouse",
  soud: "court",
  "strip club": "strip-club",
  tovarna: "factory",
  vecerka: "convenience-store",
  "vip salonek": "vip-lounge",
  zbrojovka: "armory"
});

function formatSignedDayNightPercent(value = 0) {
  const rounded = Math.round(Number(value || 0));
  return `${rounded >= 0 ? "+" : ""}${rounded} %`;
}

function addChangedDayNightMoneyPerHour(parts, label, baseValue, pctValue) {
  const base = Math.max(0, Number(baseValue || 0));
  const pct = Number(pctValue);
  if (!Number.isFinite(base) || base <= 0 || !Number.isFinite(pct) || Math.abs(pct) < 0.001) {
    return;
  }
  const effective = Math.max(0, Math.floor(base * (1 + pct / 100) + 1e-9));
  if (Math.abs(effective - base) < 0.001) {
    return;
  }
  parts.push(`${label} ${formatDistrictBuildingMoney(base)}/h -> ${formatDistrictBuildingMoney(effective)}/h`);
}

function addChangedDayNightPerDay(parts, label, baseValue, pctValue) {
  const base = Math.max(0, Number(baseValue || 0));
  const pct = Number(pctValue);
  if (!Number.isFinite(base) || base <= 0 || !Number.isFinite(pct) || Math.abs(pct) < 0.001) {
    return;
  }
  const effective = Math.max(0, Math.floor(base * (1 + pct / 100) + 1e-9));
  if (Math.abs(effective - base) < 0.001) {
    return;
  }
  parts.push(`${label} ${formatCompactNumber(base)}/den -> ${formatCompactNumber(effective)}/den`);
}

function addChangedDayNightPerMinute(parts, label, baseValue, pctValue) {
  const base = Math.max(0, Number(baseValue || 0));
  const pct = Number(pctValue);
  if (!Number.isFinite(base) || base <= 0 || !Number.isFinite(pct) || Math.abs(pct) < 0.001) {
    return;
  }
  const effective = Math.max(0, Math.round(base * (1 + pct / 100) * 100) / 100);
  if (Math.abs(effective - base) < 0.001) {
    return;
  }
  parts.push(`${label} ${formatCompactNumber(base)}/min -> ${formatCompactNumber(effective)}/min`);
}

function addPercentOnlyDayNightPart(parts, label, pctValue) {
  const pct = Number(pctValue);
  if (!Number.isFinite(pct) || Math.abs(pct) < 0.001) {
    return;
  }
  parts.push(`${label} ${formatSignedDayNightPercent(pct)}`);
}

function formatCompactNumber(value) {
  const rounded = Math.round(Number(value || 0) * 100) / 100;
  return Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(2).replace(/0+$/u, "").replace(/\.$/u, "");
}

function normalizeDayNightPhase(phaseState = null) {
  return normalizeDayNightPhaseId(phaseState);
}

function resolveBuildingDayNightType(buildingName = "", mechanics = {}) {
  const mechanicsType = String(mechanics?.mechanicsType || "").trim().toLowerCase();
  if (mechanicsType && mechanicsType !== "generic") {
    return mechanicsType;
  }
  return DAY_NIGHT_BUILDING_TYPE_ALIASES[normalizeBuildingLookupKey(buildingName)] || mechanicsType;
}

function resolveDayNightBuildingEffect({ buildingName = "", mechanics = {}, phaseState = null } = {}) {
  const phase = normalizeDayNightPhase(phaseState);
  const config = DAY_NIGHT_PHASE_EFFECTS[phase];
  if (!config) {
    return null;
  }

  const buildingType = resolveBuildingDayNightType(buildingName, mechanics);
  const isIllegal = ILLEGAL_DAY_NIGHT_BUILDING_TYPES.has(buildingType);
  const productionKind = PRODUCTION_DAY_NIGHT_BUILDING_TYPES[buildingType] || "";
  const hasRumorEffect = RUMOR_DAY_NIGHT_BUILDING_TYPES.has(buildingType);
  const cleanHourly = Number(mechanics.cleanHourly || 0);
  const dirtyHourly = Number(mechanics.dirtyHourly || 0);
  const dailyHeat = Number(mechanics.dailyHeat || 0);
  const dailyInfluence = Number(mechanics.dailyInfluence || 0);
  const parts = [];
  const passiveProfile = PASSIVE_DAY_NIGHT_BUILDING_EFFECTS[buildingType]?.[phase] || null;

  if (passiveProfile) {
    if (Number.isFinite(Number(passiveProfile.productionPct))) {
      addPercentOnlyDayNightPart(parts, "produkce", passiveProfile.productionPct);
    }
    if (Number.isFinite(Number(passiveProfile.cleanIncomePct)) && cleanHourly > 0) {
      addChangedDayNightMoneyPerHour(parts, "clean", cleanHourly, passiveProfile.cleanIncomePct);
    }
    if (Number.isFinite(Number(passiveProfile.dirtyIncomePct)) && dirtyHourly > 0) {
      addChangedDayNightMoneyPerHour(parts, "dirty", dirtyHourly, passiveProfile.dirtyIncomePct);
    }
    if (Number.isFinite(Number(passiveProfile.heatPct)) && dailyHeat > 0) {
      addChangedDayNightPerDay(parts, "heat", dailyHeat, passiveProfile.heatPct);
    }
    if (Number.isFinite(Number(passiveProfile.influencePct)) && dailyInfluence > 0) {
      addChangedDayNightPerDay(parts, "vliv", dailyInfluence, passiveProfile.influencePct);
    }
    if (Number.isFinite(Number(passiveProfile.populationPct))) {
      addChangedDayNightPerMinute(parts, "populace", mechanics.schoolPopulationPerMinute, passiveProfile.populationPct);
    }
    if (Number.isFinite(Number(passiveProfile.rumorGenerationPct))) {
      addPercentOnlyDayNightPart(parts, "drby", passiveProfile.rumorGenerationPct);
    }
    if (Number.isFinite(Number(passiveProfile.rumorTruthPct))) {
      addPercentOnlyDayNightPart(parts, "přesnost", passiveProfile.rumorTruthPct);
    }
    if (parts.length) {
      return {
        text: `${config.label}: ${parts.join(" · ")}`,
        tone: phase === "day" ? "day-night-day" : "day-night-night"
      };
    }
  }

  if (!passiveProfile && productionKind === "legal") {
    addPercentOnlyDayNightPart(parts, "produkce", config.legalProductionPct);
  } else if (!passiveProfile && productionKind === "illegal") {
    addPercentOnlyDayNightPart(parts, "produkce", config.illegalProductionPct);
  }

  if (!passiveProfile && isIllegal && (cleanHourly > 0 || dirtyHourly > 0)) {
    addChangedDayNightMoneyPerHour(parts, dirtyHourly > 0 ? "dirty" : "income", dirtyHourly > 0 ? dirtyHourly : cleanHourly, config.dirtyIncomePct);
  } else if (!passiveProfile) {
    if (cleanHourly > 0) {
      addChangedDayNightMoneyPerHour(parts, "clean", cleanHourly, config.legalIncomePct);
    }
    if (dirtyHourly > 0) {
      addChangedDayNightMoneyPerHour(parts, "dirty", dirtyHourly, config.dirtyIncomePct);
    }
  }

  if (dailyHeat > 0) {
    addChangedDayNightPerDay(parts, "heat", dailyHeat, config.heatPct);
  }
  if (hasRumorEffect) {
    parts.push(`drby ${formatSignedDayNightPercent(config.rumorGenerationPct)}`);
    parts.push(`přesnost ${formatSignedDayNightPercent(config.rumorTruthPct)}`);
  }

  if (!parts.length) {
    return null;
  }

  return {
    text: `${config.label}: ${parts.join(" · ")}`,
    tone: phase === "day" ? "day-night-day" : "day-night-night"
  };
}

function resolveEffectTone(value = "", mechanicsType = "") {
  const normalized = normalizeEffectToneLabel(value);
  if (mechanicsType === "apartment-block" && normalized.startsWith("naplneni za")) {
    return "cooldown";
  }
  if (normalized.startsWith("clean cash")) {
    return "clean";
  }
  if (normalized.startsWith("dirty cash")) {
    return "dirty";
  }
  if (normalized.startsWith("heat")) {
    return "heat";
  }
  if (normalized.startsWith("vliv") || normalized.startsWith("influence")) {
    return "influence";
  }
  if (normalized.startsWith("level multiplier") || normalized.startsWith("level bonus") || normalized.startsWith("network multiplier") || normalized.startsWith("sit ")) {
    return "network";
  }
  if (normalized.startsWith("den ")) {
    return "day-night-day";
  }
  if (normalized.startsWith("noc ")) {
    return "day-night-night";
  }
  return "neutral";
}

function formatLevelMultiplierEffect(value = "", mechanicsType = "") {
  const match = String(value || "").match(/(?:Level|Network) multiplier x(\d+(?:[.,]\d+)?)/i);
  if (!match) {
    return value;
  }

  const multiplier = Number.parseFloat(String(match[1]).replace(",", "."));
  if (!Number.isFinite(multiplier) || multiplier <= 0) {
    return value;
  }

  const bonusPct = Math.max(0, Math.round((multiplier - 1) * 100));
  if (mechanicsType === "restaurant") {
    return `Síť restaurací: cashflow, vliv, drby a heat +${bonusPct} %`;
  }
  if (mechanicsType === "apartment-block") {
    return `Síť bytových bloků: produkce a kapacita obyvatel +${bonusPct} %`;
  }

  return `Level bonus +${bonusPct}%`;
}

function isRawNetworkMetricText(value = "") {
  const rawNetworkMetric = "(?:clean|dirty|income|výnos|vliv|influence|drby|heat|produkce|kapacita|populace|limit praní)";
  return new RegExp(`^${rawNetworkMetric}\\s+[+-]\\d+\\s*%$`, "iu").test(String(value || "").trim());
}

function isRawNetworkPrefixText(value = "") {
  const rawNetworkMetric = "(?:clean|dirty|income|výnos|vliv|influence|drby|heat|produkce|kapacita|populace|limit praní)";
  return new RegExp(`^Síť [^:]+:\\s*${rawNetworkMetric}\\s+[+-]\\d+\\s*%`, "iu").test(String(value || "").trim());
}

function splitEffectLabelItems(effectsLabel = "") {
  const parts = String(effectsLabel || "")
    .split(" · ")
    .map((item) => item.trim())
    .filter(Boolean);
  const items = [];
  for (let index = 0; index < parts.length; index += 1) {
    let item = parts[index];
    if (isRawNetworkPrefixText(item)) {
      while (index + 1 < parts.length && isRawNetworkMetricText(parts[index + 1])) {
        index += 1;
        item = `${item}, ${parts[index]}`;
      }
    }
    items.push(item);
  }
  return items;
}

function createEffectItems(effectsLabel = "", mechanicsType = "") {
  return splitEffectLabelItems(effectsLabel)
    .map((item) => {
      const text = formatLevelMultiplierEffect(item, mechanicsType);
      return {
        text,
        tone: resolveEffectTone(item, mechanicsType)
      };
    });
}

function resolveOwnedNetworkCount(mechanics = {}, keys = []) {
  for (const key of keys) {
    const value = Number(mechanics[key]);
    if (Number.isFinite(value) && value >= 0) {
      return Math.floor(value);
    }
  }
  return resolveOwnedBuildingCount(mechanics);
}

function isActiveNetworkMultiplier(value = 1) {
  const multiplier = Number(value);
  return Number.isFinite(multiplier) && Math.round((multiplier - 1) * 100) !== 0;
}

function joinEffectPhraseParts(parts = []) {
  const values = parts.filter(Boolean);
  if (values.length <= 1) {
    return values[0] || "";
  }
  if (values.length === 2) {
    return `${values[0]} a ${values[1]}`;
  }
  return `${values.slice(0, -1).join(", ")} i ${values[values.length - 1]}`;
}

function createNetworkEffectSummary({ mechanics = {}, ownedKeys = [], prefix = "", metrics = [] } = {}) {
  const ownedCount = resolveOwnedNetworkCount(mechanics, ownedKeys);
  if (ownedCount !== null && ownedCount < 2) {
    return null;
  }

  const parts = metrics
    .map(([label, multiplier]) => [label, multiplier])
    .filter(([, multiplier]) => isActiveNetworkMultiplier(multiplier))
    .map(([label, multiplier]) => `${label} ${formatMultiplierIncreasePercent(multiplier)}`);
  if (!parts.length) {
    return null;
  }

  return {
    text: `${prefix} zvyšuje ${joinEffectPhraseParts(parts)}.`,
    tone: "network"
  };
}

function createConcreteNetworkEffectItem(mechanics = {}) {
  switch (mechanics.mechanicsType) {
    case "apartment-block":
      return createNetworkEffectSummary({
        mechanics,
        ownedKeys: ["ownedApartmentBlocks"],
        prefix: "Síť bytových bloků",
        metrics: [
          ["produkci", mechanics.apartmentNetwork?.populationProductionMultiplier],
          ["kapacitu", mechanics.apartmentNetwork?.capacityMultiplier]
        ]
      });
    case "school":
      return createNetworkEffectSummary({
        mechanics,
        ownedKeys: ["ownedSchools"],
        prefix: "Síť škol",
        metrics: [
          ["populaci", mechanics.schoolNetwork?.populationProductionMultiplier],
          ["kapacitu", mechanics.schoolNetwork?.studentCapacityMultiplier],
          ["Income", mechanics.schoolNetwork?.incomeMultiplier]
        ]
      });
    case "restaurant":
      return createNetworkEffectSummary({
        mechanics,
        ownedKeys: ["ownedRestaurants", "ownedBuildingCount"],
        prefix: "Síť restaurací",
        metrics: [
          ["Income", mechanics.restaurantNetwork?.incomeMultiplier],
          ["Vliv", mechanics.restaurantNetwork?.influenceMultiplier],
          ["Drby", mechanics.restaurantNetwork?.rumorMultiplier],
          ["Heat", mechanics.restaurantNetwork?.heatMultiplier]
        ]
      });
    case "retail":
      return createNetworkEffectSummary({
        mechanics,
        ownedKeys: ["ownedShoppingMalls"],
        prefix: "Síť obchodních center",
        metrics: [
          ["Income", mechanics.shoppingMallNetwork?.cleanIncomeMultiplier],
          ["Vliv", mechanics.shoppingMallNetwork?.influenceMultiplier],
          ["Heat", mechanics.shoppingMallNetwork?.heatMultiplier]
        ]
      });
    case "auto-salon":
      return createNetworkEffectSummary({
        mechanics,
        ownedKeys: ["ownedAutoSalons"],
        prefix: "Síť autosalonů",
        metrics: [
          ["clean", mechanics.autoSalonNetwork?.cleanIncomeMultiplier],
          ["dirty", mechanics.autoSalonNetwork?.dirtyIncomeMultiplier],
          ["Heat", mechanics.autoSalonNetwork?.heatMultiplier]
        ]
      });
    case "fitness-club":
      return createNetworkEffectSummary({
        mechanics,
        ownedKeys: ["ownedFitnessClubs"],
        prefix: "Síť fitness clubů",
        metrics: [
          ["Income", mechanics.fitnessClubNetwork?.incomeMultiplier],
          ["Heat", mechanics.fitnessClubNetwork?.heatMultiplier]
        ]
      });
    case "garage":
      return createNetworkEffectSummary({
        mechanics,
        ownedKeys: ["ownedGarages"],
        prefix: "Síť garáží",
        metrics: [
          ["Income", mechanics.garageNetwork?.incomeMultiplier],
          ["Heat", mechanics.garageNetwork?.heatMultiplier]
        ]
      });
    case "warehouse":
      return createNetworkEffectSummary({
        mechanics,
        ownedKeys: ["ownedWarehouses"],
        prefix: "Síť skladišť",
        metrics: [
          ["Income", mechanics.warehouseNetwork?.incomeMultiplier],
          ["kapacitu", mechanics.warehouseNetwork?.storageCapacityMultiplier],
          ["Heat", mechanics.warehouseNetwork?.heatMultiplier]
        ]
      });
    case "clinic":
      return createNetworkEffectSummary({
        mechanics,
        ownedKeys: ["ownedClinics"],
        prefix: "Síť klinik",
        metrics: [
          ["Income", mechanics.clinicNetwork?.incomeMultiplier],
          ["Heat", mechanics.clinicNetwork?.heatMultiplier]
        ]
      });
    case "exchange":
      return createNetworkEffectSummary({
        mechanics,
        ownedKeys: ["ownedExchangeOffices"],
        prefix: "Síť směnáren",
        metrics: [
          ["výnos", mechanics.exchangeNetwork?.incomeMultiplier],
          ["limit praní", mechanics.exchangeNetwork?.launderingLimitMultiplier],
          ["Heat", mechanics.exchangeNetwork?.heatMultiplier]
        ]
      });
    case "arcade":
      return createNetworkEffectSummary({
        mechanics,
        ownedKeys: ["ownedArcades"],
        prefix: "Síť heren",
        metrics: [
          ["Income", mechanics.arcadeNetwork?.incomeMultiplier],
          ["limit praní", mechanics.arcadeNetwork?.launderingLimitMultiplier],
          ["Heat", mechanics.arcadeNetwork?.heatMultiplier]
        ]
      });
    case "smuggling-tunnel":
      return createNetworkEffectSummary({
        mechanics,
        ownedKeys: ["ownedSmugglingTunnels"],
        prefix: "Síť pašovacích tunelů",
        metrics: [
          ["dirty tok", mechanics.smugglingTunnelNetwork?.dirtyProductionMultiplier],
          ["Heat", mechanics.smugglingTunnelNetwork?.heatMultiplier || mechanics.smugglingTunnelNetwork?.passiveHeatMultiplier]
        ]
      });
    case "power-plant":
      return createNetworkEffectSummary({
        mechanics,
        ownedKeys: ["ownedPowerStations"],
        prefix: "Síť energetických stanic",
        metrics: [
          ["Income", mechanics.powerStationNetwork?.incomeMultiplier],
          ["Heat", mechanics.powerStationNetwork?.heatMultiplier]
        ]
      });
    case "recycling-center":
      return createNetworkEffectSummary({
        mechanics,
        ownedKeys: ["ownedRecyclingCenters"],
        prefix: "Síť recyklačních center",
        metrics: [
          ["Income", mechanics.recyclingCenterNetwork?.incomeMultiplier],
          ["Heat", mechanics.recyclingCenterNetwork?.heatMultiplier]
        ]
      });
    case "recruitment-center":
      return createNetworkEffectSummary({
        mechanics,
        ownedKeys: ["ownedRecruitmentCenters"],
        prefix: "Síť rekrutačních center",
        metrics: [
          ["Income", mechanics.recruitmentCenterNetwork?.incomeMultiplier],
          ["Heat", mechanics.recruitmentCenterNetwork?.heatMultiplier]
        ]
      });
    default:
      return null;
  }
}

function isRawNetworkDetailEffectItem(item = {}) {
  const text = String(item?.text || "").trim();
  return isRawNetworkPrefixText(text);
}

function isEmptyEffectPlaceholder(item = {}) {
  return normalizeEffectToneLabel(item?.text || "") === "zadne aktivni mechaniky";
}

function finalizeEffectItems(items = []) {
  if (items.length <= 1) {
    return items;
  }
  return items.filter((item) => !isEmptyEffectPlaceholder(item));
}

function isZeroNetworkEffectItem(item = {}) {
  if (!item || item.tone !== "network") {
    return false;
  }
  const rawText = String(item.text || "");
  const normalized = normalizeEffectToneLabel(rawText);
  return /\+0\s*%/u.test(rawText)
    || /1x0\b/u.test(normalized)
    || /\bx1(?:[.,]0+)?\b/u.test(normalized);
}

function resolveOwnedBuildingCount(mechanics = {}) {
  const directCount = Number(mechanics.ownedBuildingCount);
  if (Number.isFinite(directCount) && directCount >= 0) {
    return Math.floor(directCount);
  }

  const ownedKey = Object.keys(mechanics).find((key) => /^owned[A-Z]/.test(key) && Number.isFinite(Number(mechanics[key])));
  if (!ownedKey) {
    return null;
  }

  const fallbackCount = Number(mechanics[ownedKey]);
  return Number.isFinite(fallbackCount) && fallbackCount >= 0
    ? Math.floor(fallbackCount)
    : null;
}

function createEffectItemsWithOwnedCount(effectsLabel = "", mechanics = {}, options = {}) {
  const ownedBuildingCount = resolveOwnedBuildingCount(mechanics);
  const suppressZeroNetworkEffect = ownedBuildingCount !== null && ownedBuildingCount <= 1;
  const items = createEffectItems(effectsLabel, mechanics.mechanicsType)
    .filter((item) => !(suppressZeroNetworkEffect && isZeroNetworkEffectItem(item)))
    .filter((item) => !isRawNetworkDetailEffectItem(item));
  const dayNightEffect = resolveDayNightBuildingEffect({
    buildingName: options.buildingName,
    mechanics,
    phaseState: options.phaseState
  });
  if (dayNightEffect) {
    items.push(dayNightEffect);
  }
  const networkEffect = createConcreteNetworkEffectItem(mechanics);
  if (networkEffect) {
    items.push(networkEffect);
  }
  if (mechanics.mechanicsType === "apartment-block") {
    items.push({
      text: "Může se vybrat od 10 členů",
      tone: "silver"
    });
  }
  if (
    mechanics.mechanicsType === "apartment-block"
    && mechanics.schoolApartmentBoostActive
    && Number(mechanics.schoolApartmentBoostPct || 0) > 0
  ) {
    const remainingMs = Math.max(0, Number(mechanics.schoolApartmentBoostRemainingMs || 0));
    const remainingLabel = remainingMs > 0
      ? ` · zbývá ${formatDistrictBuildingCooldown(remainingMs)}`
      : "";
    items.push({
      text: `Večerní kurz: nábor členů +${Math.max(0, Number(mechanics.schoolApartmentBoostPct || 0))} %${remainingLabel}`,
      tone: "population"
    });
  }
  if (mechanics.mechanicsType === "apartment-block" && !mechanics.apartmentIsFull && Number(mechanics.apartmentTimeToFullMs || 0) > 0) {
    items.push({
      text: `Naplnění za ${formatDistrictBuildingCooldown(mechanics.apartmentTimeToFullMs)}`,
      tone: "cooldown"
    });
  }
  if (mechanics.mechanicsType === "power-plant") {
    const network = mechanics.powerStationNetwork || {};
    if (Number(network.cameraStrengthBonusPct || 0) > 0 || Number(network.alarmStrengthBonusPct || 0) > 0) {
      items.push({
        text: `Obrana districtů: kamery +${Math.max(0, Math.round(Number(network.cameraStrengthBonusPct || 0)))} %, alarm +${Math.max(0, Math.round(Number(network.alarmStrengthBonusPct || 0)))} %.`,
        tone: "defense"
      });
    }
    if (mechanics.powerStationBackupActive) {
      const remainingMs = Math.max(0, Number(mechanics.powerStationBackupRemainingMs || 0));
      const remainingLabel = remainingMs > 0
        ? ` · zbývá ${formatDistrictBuildingCooldown(remainingMs)}`
        : "";
      items.push({
        text: `Záložní síť běží: infrastruktura +${POWER_STATION_CONFIG.backupGridSwitch.temporaryInfrastructureBonusPct} %, kamery +${POWER_STATION_CONFIG.backupGridSwitch.cameraStrengthBonusPct} %, alarm +${POWER_STATION_CONFIG.backupGridSwitch.alarmStrengthBonusPct} %${remainingLabel}`,
        tone: "defense"
      });
    }
  }
  if (mechanics.mechanicsType === "recycling-center") {
    const salvagePool = getRecyclingSalvagePoolView(mechanics.recyclingSalvagePool || mechanics.clinicRecoveryPool);
    if (salvagePool.totalFreshAmount > 0) {
      items.push({
        text: `K vytěžení: ${salvagePool.totalFreshAmount} itemových ztrát. Akce vrací ${Math.max(0, Math.round(Number(mechanics.recyclingSalvageRatePct || 0)))} %.`,
        tone: "network"
      });
    }
  }
  if (mechanics.mechanicsType === "recruitment-center") {
    const support = mechanics.recruitmentCenterSupport || {};
    return finalizeEffectItems([
      { text: `Population produkce +${Math.max(0, Number(support.populationProductionBonusPct || 0))} %`, tone: "population" },
      { text: `Kapacita bloků +${Math.max(0, Number(support.apartmentCapacityBonusPct || 0))} %`, tone: "network" },
      { text: `Síla zbraní +${Math.max(0, Number(support.attackWeaponStrengthBonusPct || 0))} %`, tone: "attack" },
      { text: `Obrana +${Math.max(0, Number(support.defenseItemStrengthBonusPct || 0))} %`, tone: "defense" },
      { text: `Kamery/alarmy +${Math.max(0, Number(support.cameraStrengthBonusPct || 0))} %`, tone: "defense" },
      ...(networkEffect ? [networkEffect] : []),
      ...items.filter((item) => /^DEN:|^NOC:/u.test(item.text || ""))
    ]);
  }
  return finalizeEffectItems(items);
}

function createBuildingDetailCountLabel(mechanics = {}) {
  const ownedBuildingCount = resolveOwnedBuildingCount(mechanics);
  return ownedBuildingCount === null ? "" : `Počet: ${ownedBuildingCount}`;
}

const FOCUSED_BUILDING_DETAIL_LABELS = Object.freeze({
  "apartment-block": "Bytový blok",
  garage: "Garáž",
  "recruitment-center": "Rekrutační centrum",
  clinic: "Klinika",
  arcade: "Herna",
  school: "Škola",
  restaurant: "Restaurace",
  "fitness-club": "Fitness Club",
  exchange: "Směnárna",
  "auto-salon": "Autosalon",
  retail: "Obchodní centrum",
  casino: "Kasino",
  warehouse: "Skladiště",
  "power-plant": "Energetická stanice",
  "recycling-center": "Recyklační centrum",
  "street-dealers": "Pouliční dealeři",
  "convenience-store": "Večerka",
  "smuggling-tunnel": "Pašovací tunel",
  "strip-club": "Strip club"
});

const FOCUSED_BUILDING_DETAIL_BADGES = Object.freeze({
  "apartment-block": "Členové gangu",
  garage: "Logistika",
  "recruitment-center": "Nábor",
  clinic: "Recovery",
  arcade: "Dirty cash",
  school: "Vzdělání",
  restaurant: "Lokální cashflow",
  "fitness-club": "Síla gangu",
  exchange: "Praní peněz",
  "auto-salon": "Cooldowny",
  retail: "Market",
  casino: "High-risk praní",
  warehouse: "Skladiště zásob",
  "power-plant": "Infrastruktura",
  "recycling-center": "Vytěžení ztrát",
  "street-dealers": "Distribuce",
  "convenience-store": "Pouliční provoz",
  "smuggling-tunnel": "Pašování",
  "strip-club": "Noční provoz"
});

const SUPPRESS_SINGLE_PANEL_ACTIONS = new Set(["apartment-block", "garage", "recruitment-center"]);

function getProductionResourceLabel(itemId) {
  return PRODUCTION_RESOURCE_LABELS[itemId] || String(itemId || "").trim() || "Materiál";
}

function normalizeProductionResourceColorKey(itemId) {
  const normalized = String(itemId || "").trim();
  const aliases = {
    metalParts: "metal-parts",
    techCore: "tech-core",
    combatModule: "combat-module"
  };
  return aliases[normalized] || normalized;
}

export function getCasinoClientAuditRisk(entry, playerHeat = 0, now = Date.now()) {
  const activeEffects = Array.isArray(entry?.activeEffects) ? entry.activeEffects : [];
  let risk = 8;
  risk += activeEffects
    .filter((effect) => Number(effect.expiresAt || 0) > now)
    .reduce((total, effect) => total + Math.max(0, Number(effect.auditRiskBoostPct || 0)), 0);
  if (Number(playerHeat || 0) > 180) {
    risk += 20;
  } else if (Number(playerHeat || 0) > 100) {
    risk += 10;
  }
  const reductionPct = activeEffects
    .filter((effect) => Number(effect.expiresAt || 0) > now)
    .reduce((max, effect) => Math.max(max, Number(effect.auditRiskReductionPct || 0)), 0);
  if (reductionPct > 0) {
    risk *= 1 - reductionPct / 100;
  }
  return `${Math.max(0, Math.round(risk * 10) / 10)} %`;
}

function createBuildingActionUiFormatOptions(options = {}) {
  return {
    ...options,
    formatMoney: formatDistrictBuildingMoney,
    formatCooldown: formatDistrictBuildingCooldown,
    weaponLabels: ATTACK_WEAPON_LABELS,
    getResourceLabel: getProductionResourceLabel,
    normalizeResourceKey: normalizeProductionResourceColorKey
  };
}

export function createBuildingDetailStatRows({
  buildingName = "",
  mechanics = {},
  detailEntry = {},
  buildingProfile = {},
  playerHeat = 0,
  now = Date.now()
} = {}) {
  const buildingKey = normalizeBuildingLookupKey(buildingName);
  const canUpgrade = hasBuildingUpgradeCapability(mechanics);
  const statRows = [
    createStat("Čisté / hod", formatDistrictBuildingMoney(mechanics.cleanHourly)),
    createStat("Špinavé / hod", formatDistrictBuildingMoney(mechanics.dirtyHourly)),
    createStat("Heat / den", `+${mechanics.dailyHeat}`),
    createStat("Vliv / den", `+${mechanics.dailyInfluence}`),
    createStat("Zóna", DISTRICT_BUILDING_TYPE_META[buildingProfile?.typeKey]?.shortLabel || "District"),
    createStat("Tier", formatDistrictBuildingTierLabel(buildingProfile?.tier || "mid")),
    createStat("Připraveno", mechanics.storedOutputLabel)
  ];
  if (canUpgrade) {
    statRows.push(createStat("Upgrade", mechanics.nextLevel ? `${mechanics.upgradeCostLabel} -> L${mechanics.nextLevel}` : "Max level"));
  }

  if (mechanics.mechanicsType === "casino") {
    statRows.splice(0, statRows.length,
      createStat("Čisté / min", `+${formatDistrictBuildingMoney(mechanics.cleanHourly / 60)}`),
      createStat("Dirty / min", `+${formatDistrictBuildingMoney(mechanics.dirtyHourly / 60)}`),
      createStat("Heat / min", `+${(mechanics.dailyHeat / 1440).toFixed(3)}`),
      createStat("Kapacita praní", formatDistrictBuildingMoney(mechanics.casinoLaunderingCapacity)),
      createStat("Poplatek", `${mechanics.casinoLaunderingFeePct}%`),
      createStat("Audit risk", getCasinoClientAuditRisk(detailEntry, playerHeat, now)),
      createStat("Upgrade", mechanics.nextLevel ? `${mechanics.upgradeCostLabel} -> L${mechanics.nextLevel}` : "Max level")
    );
  } else if (mechanics.mechanicsType === "apartment-block") {
    statRows.splice(0, statRows.length,
      createStat("Obyvatelé", `${mechanics.apartmentWholePopulation}/${mechanics.apartmentCapacity}`),
      createStat("Populace / min", `+${mechanics.apartmentPopulationPerMinute.toFixed(2)}`),
      createStat("Cash / dirty / heat", "0 / 0 / 0")
    );
  } else if (mechanics.mechanicsType === "school") {
    statRows.splice(0, statRows.length,
      createStat("Clean / min", `+${formatDistrictBuildingMoney(mechanics.cleanHourly / 60)}`),
      createStat("Populace", `${mechanics.schoolWholeStudents}/${mechanics.schoolCapacity}`),
      createStat("Do naplnění", mechanics.schoolIsFull ? "Plná kapacita" : formatDistrictBuildingCooldown(mechanics.schoolTimeToFullMs)),
      createStat("Školy", `${mechanics.ownedSchools}/${SCHOOL_CONFIG.countOnMap}`)
    );
  } else if (mechanics.mechanicsType === "exchange") {
    const network = mechanics.exchangeNetwork || {};
    const networkParts = [
      isActiveNetworkMultiplier(network.incomeMultiplier) ? `výnos ${formatMultiplierIncreasePercent(network.incomeMultiplier)}` : "",
      isActiveNetworkMultiplier(network.launderingLimitMultiplier) ? `limit praní ${formatMultiplierIncreasePercent(network.launderingLimitMultiplier)}` : "",
      isActiveNetworkMultiplier(network.heatMultiplier) ? `heat ${formatMultiplierIncreasePercent(network.heatMultiplier)}` : ""
    ].filter(Boolean);
    statRows.splice(0, statRows.length,
      createStat("Čisté / min", `+${formatDistrictBuildingMoney(mechanics.cleanHourly / 60)}`),
      createStat("Dirty / min", `+${formatDistrictBuildingMoney(mechanics.dirtyHourly / 60)}`),
      createStat("Heat / min", `+${(mechanics.dailyHeat / 1440).toFixed(3)}`),
      createStat("Směnárny", `${mechanics.ownedExchangeOffices}/${EXCHANGE_OFFICE_NETWORK_CONFIG.countOnMap}`),
      createStat("Kapacita praní", formatDistrictBuildingMoney(mechanics.exchangeLaunderingCapacity)),
      createStat("Audit risk", mechanics.exchangeAuditRisk)
    );
    if (networkParts.length) {
      statRows.push(createStat("Síť", networkParts.join(" · ")));
    }
  } else if (mechanics.mechanicsType === "arcade") {
    statRows.splice(0, statRows.length,
      createStat("Clean / min", `+${formatDistrictBuildingMoney(mechanics.cleanHourly / 60)}`),
      createStat("Dirty / min", `+${formatDistrictBuildingMoney(mechanics.dirtyHourly / 60)}`),
      createStat("Heat / min", `+${(mechanics.dailyHeat / 1440).toFixed(3)}`),
      createStat("Herny", `${mechanics.ownedArcades}/${ARCADE_NETWORK_CONFIG.countOnMap}`),
      createStat("Kapacita praní", formatDistrictBuildingMoney(mechanics.arcadeLaunderingCapacity)),
      createStat("Audit risk", mechanics.arcadeAuditRisk)
    );
  } else if (mechanics.mechanicsType === "warehouse") {
    const storage = mechanics.serverStorageSummary;
    if (storage?.warehouseSummary) {
      const summary = storage.warehouseSummary;
      statRows.splice(0, statRows.length,
        createStat("Čisté / min", `+${formatDistrictBuildingMoney(45 * mechanics.warehouseNetwork.incomeMultiplier)}`),
        createStat("Heat / min", `+${(0.06 * mechanics.warehouseNetwork.heatMultiplier).toFixed(3)}`),
        createStat("Síť skladišť", String(summary.ownedWarehouseCount)),
        createStat("Nejvyšší level", `L${summary.highestWarehouseLevel}`),
        createStat("Bonus sítě", `x${Number(summary.warehouseCountMultiplier || 1).toFixed(2)}`),
        createStat("Bonus levelu", `x${Number(summary.warehouseLevelMultiplier || 1).toFixed(2)}`),
        createStat("Celkový násobitel", `x${Number(summary.totalCapacityMultiplier || 1).toFixed(2)}`),
        ...storage.groups.map((group) => createStat(group.label, `${group.currentCapacity} ks na položku`)),
        createStat("Akce", "Žádné")
      );
    } else {
      const warehouseCapacity = resolveWarehouseDisplayCapacity(mechanics.warehouseCapacity);
      statRows.splice(0, statRows.length,
        createStat("Čisté / min", `+${formatDistrictBuildingMoney(45 * mechanics.warehouseNetwork.incomeMultiplier)}`),
        createStat("Heat / min", `+${(0.06 * mechanics.warehouseNetwork.heatMultiplier).toFixed(3)}`),
        createStat("Skladiště", `${mechanics.ownedWarehouses}/${WAREHOUSE_NETWORK_CONFIG.countOnMap}`),
        createStat("Kapacita zásob", `+${warehouseCapacity.genericResources}`),
        createStat("Dirty / vliv", "0 / 0"),
        createStat("Akce", "Žádné")
      );
    }
  } else if (mechanics.mechanicsType === "clinic") {
    statRows.splice(0, statRows.length,
      createStat("Clean / hod", `+${formatDistrictBuildingMoney(mechanics.cleanHourly)}`),
      createStat("Heat / den", `+${formatCompactNumber(mechanics.dailyHeat)}`),
      createStat("Recovery rate", `${mechanics.clinicRecoveryRatePct} %`),
      createStat("Recovery pool", `${mechanics.clinicRecoveryPool.totalFreshAmount} položek`),
      createStat("Kliniky", `${mechanics.ownedClinics}/${CLINIC_COUNT_ON_MAP}`)
    );
  } else if (mechanics.mechanicsType === "recruitment-center") {
    const support = mechanics.recruitmentCenterSupport || {};
    const network = mechanics.recruitmentCenterNetwork || {};
    statRows.splice(0, statRows.length,
      createStat("Clean / min", `+${formatDistrictBuildingMoney(mechanics.cleanHourly / 60)}`),
      createStat("Heat / min", `+${(mechanics.dailyHeat / 1440).toFixed(3)}`),
      createStat("Počet", `${mechanics.ownedRecruitmentCenters || 0}/${RECRUITMENT_CENTER_SUPPORT_CONFIG.countOnMap}`),
      createStat("Síť", `income ${formatMultiplierIncreasePercent(network.incomeMultiplier || 1)} · heat ${formatMultiplierIncreasePercent(network.heatMultiplier || 1)}`),
      createStat("Population", `+${Math.max(0, Number(support.populationProductionBonusPct || 0))}% / cap +${Math.max(0, Number(support.apartmentCapacityBonusPct || 0))}%`),
      createStat("Boj", `útok +${Math.max(0, Number(support.attackWeaponStrengthBonusPct || 0))}% · obrana +${Math.max(0, Number(support.defenseItemStrengthBonusPct || 0))}%`)
    );
  } else if (mechanics.mechanicsType === "garage") {
    statRows.splice(0, statRows.length,
      createStat("Clean / min", `+${formatDistrictBuildingMoney(mechanics.cleanHourly / 60)}`),
      createStat("Heat / min", `+${(mechanics.dailyHeat / 1440).toFixed(3)}`),
      createStat("Garáže", `${mechanics.ownedGarages}/${GARAGE_SUPPORT_CONFIG.countOnMap}`),
      createStat("Cooldowny", `-${mechanics.garageSupport.cooldownReductionPct}%`)
    );
  } else if (mechanics.mechanicsType === "retail" || buildingKey === "obchodni centrum") {
    statRows.splice(0, statRows.length,
      createStat("Market", `${mechanics.shoppingMallMarketDiscount.discountPct}% běžný / ${mechanics.shoppingMallBlackMarketDiscount.discountPct}% černý`),
      createStat("Poplatky", `${mechanics.shoppingMallMarketDiscount.feeReductionPct}% nižší`),
      createStat("Výnosy", `clean ${formatMultiplierIncreasePercent(mechanics.shoppingMallNetwork.cleanIncomeMultiplier)} / dirty ${formatMultiplierIncreasePercent(mechanics.shoppingMallNetwork.dirtyIncomeMultiplier)}`),
      createStat("Vliv a heat", `vliv ${formatMultiplierIncreasePercent(mechanics.shoppingMallNetwork.influenceMultiplier)} / heat ${formatMultiplierIncreasePercent(mechanics.shoppingMallNetwork.heatMultiplier)}`)
    );
  } else if (mechanics.mechanicsType === "auto-salon" || buildingKey === "autosalon") {
    const network = mechanics.autoSalonNetwork || {};
    const networkParts = [
      isActiveNetworkMultiplier(network.cleanIncomeMultiplier) ? `clean ${formatMultiplierIncreasePercent(network.cleanIncomeMultiplier)}` : "",
      isActiveNetworkMultiplier(network.dirtyIncomeMultiplier) ? `dirty ${formatMultiplierIncreasePercent(network.dirtyIncomeMultiplier)}` : "",
      isActiveNetworkMultiplier(network.heatMultiplier) ? `heat ${formatMultiplierIncreasePercent(network.heatMultiplier)}` : ""
    ].filter(Boolean);
    statRows.splice(0, statRows.length,
      createStat("Čisté / hod", `+${formatDistrictBuildingMoney(mechanics.cleanHourly)}`),
      createStat("Špinavé / hod", `+${formatDistrictBuildingMoney(mechanics.dirtyHourly)}`),
      createStat("Heat / den", `+${formatCompactNumber(mechanics.dailyHeat)}`),
      createStat("Vliv / hod", `+${formatCompactNumber(Number(mechanics.dailyInfluence || 0) / 24)}`),
      createStat("Autosalony", `${mechanics.ownedAutoSalons}/${AUTO_SALON_SUPPORT_CONFIG.countOnMap}`),
      createStat("Čekání", `-${mechanics.autoSalonSupport.cooldownReductionPct}%`),
      createStat("Únik", `+${mechanics.autoSalonSupport.escapeChanceBonusPct}%`),
      createStat("Strop čekání", `-${mechanics.autoSalonSupport.combinedGarageDealerMaxReductionPct}%`)
    );
    if (networkParts.length) {
      statRows.push(createStat("Síť", networkParts.join(" · ")));
    }
  } else if (mechanics.mechanicsType === "fitness-club" || buildingKey === "fitness club") {
    const network = mechanics.fitnessClubNetwork || {};
    const networkParts = [
      isActiveNetworkMultiplier(network.incomeMultiplier) ? `income ${formatMultiplierIncreasePercent(network.incomeMultiplier)}` : "",
      isActiveNetworkMultiplier(network.heatMultiplier) ? `heat ${formatMultiplierIncreasePercent(network.heatMultiplier)}` : ""
    ].filter(Boolean);
    statRows.splice(0, statRows.length,
      createStat("Čisté / min", `+${formatDistrictBuildingMoney(mechanics.cleanHourly / 60)}`),
      createStat("Heat / min", `+${(mechanics.dailyHeat / 1440).toFixed(3)}`),
      createStat("Fitness cluby", `${mechanics.ownedFitnessClubs}/${FITNESS_CLUB_SUPPORT_CONFIG.countOnMap}`),
      createStat("Útok", `+${mechanics.fitnessClubSupport.attackStrengthBonusPct}%`),
      createStat("Obrana", `+${mechanics.fitnessClubSupport.defenseStrengthBonusPct}%`),
      createStat("Cap s rekrutací", `+${mechanics.fitnessClubSupport.combinedRecruitmentFitnessAttackCapPct}% / +${mechanics.fitnessClubSupport.combinedRecruitmentFitnessDefenseCapPct}%`)
    );
    if (networkParts.length) {
      statRows.push(createStat("Síť", networkParts.join(" · ")));
    }
  } else if (mechanics.mechanicsType === "restaurant" || buildingKey === "restaurace") {
    const ownedRestaurants = Math.max(0, Math.floor(Number(mechanics.ownedRestaurants || mechanics.ownedBuildingCount || 0)));
    const network = mechanics.restaurantNetwork || {};
    const networkParts = [
      isActiveNetworkMultiplier(network.incomeMultiplier) ? `income ${formatMultiplierIncreasePercent(network.incomeMultiplier)}` : "",
      isActiveNetworkMultiplier(network.influenceMultiplier) ? `vliv ${formatMultiplierIncreasePercent(network.influenceMultiplier)}` : "",
      isActiveNetworkMultiplier(network.rumorMultiplier) ? `drby ${formatMultiplierIncreasePercent(network.rumorMultiplier)}` : "",
      isActiveNetworkMultiplier(network.heatMultiplier) ? `heat ${formatMultiplierIncreasePercent(network.heatMultiplier)}` : ""
    ].filter(Boolean);
    statRows.splice(0, statRows.length,
      createStat("Čisté / hod", `+${formatDistrictBuildingMoney(mechanics.cleanHourly)}`),
      createStat("Heat / den", `+${formatCompactNumber(mechanics.dailyHeat)}`),
      createStat("Vliv / den", `+${formatCompactNumber(mechanics.dailyInfluence)}`),
      createStat("Počet", `${ownedRestaurants}/${RESTAURANT_NETWORK_CONFIG.countOnMap}`),
      createStat("Drby", "pasivní městské tipy")
    );
    if (networkParts.length) {
      statRows.push(createStat("Síť", networkParts.join(" · ")));
    }
  } else if (mechanics.mechanicsType === "power-plant" || buildingKey === "energeticka stanice") {
    const network = mechanics.powerStationNetwork || {};
    statRows.splice(0, statRows.length,
      createStat("Čisté / hod", `+${formatDistrictBuildingMoney(mechanics.cleanHourly)}`),
      createStat("Špinavé / hod", `+${formatDistrictBuildingMoney(mechanics.dirtyHourly)}`),
      createStat("Heat / den", `+${formatCompactNumber(mechanics.dailyHeat)}`),
      createStat("Stanice", `${mechanics.ownedPowerStations || resolveOwnedBuildingCount(mechanics) || 0}/${POWER_STATION_CONFIG.countOnMap}`),
      createStat("Infrastruktura", `+${formatCompactNumber(network.infrastructureBonusPct || 0)} %`),
      createStat("Obrana", `kamery +${formatCompactNumber(network.cameraStrengthBonusPct || 0)} % · alarm +${formatCompactNumber(network.alarmStrengthBonusPct || 0)} %`),
      createStat("Záložní síť", mechanics.powerStationBackupActive ? formatDistrictBuildingCooldown(mechanics.powerStationBackupRemainingMs) : "Neaktivní")
    );
  } else if (mechanics.mechanicsType === "recycling-center" || buildingKey === "recyklacni centrum") {
    const salvagePool = getRecyclingSalvagePoolView(mechanics.recyclingSalvagePool || mechanics.clinicRecoveryPool);
    statRows.splice(0, statRows.length,
      createStat("Čisté / hod", `+${formatDistrictBuildingMoney(mechanics.cleanHourly)}`),
      createStat("Heat / den", `+${formatCompactNumber(mechanics.dailyHeat)}`),
      createStat("Centra", `${mechanics.ownedRecyclingCenters || resolveOwnedBuildingCount(mechanics) || 0}/${RECYCLING_CENTER_CONFIG.countOnMap}`),
      createStat("Návrat itemů", `${formatCompactNumber(mechanics.recyclingSalvageRatePct || 0)} %`),
      createStat("Ztráty k vytěžení", `${salvagePool.totalFreshAmount || 0}`),
      createStat("Okno ztrát", formatDistrictBuildingCooldown(RECYCLING_CENTER_CONFIG.salvagePoolTtlMs))
    );
  } else if (mechanics.mechanicsType === "street-dealers" || buildingKey === "poulicni dealeri") {
    statRows.splice(0, statRows.length,
      createStat("Špinavé / hod", `+${formatDistrictBuildingMoney(mechanics.dirtyHourly)}`),
      createStat("Heat / den", `+${formatCompactNumber(mechanics.dailyHeat)}`),
      createStat("Zdroj", "produkty z Labu"),
      createStat("Akce", "prodej / cash / stash")
    );
  } else if (mechanics.mechanicsType === "convenience-store" || buildingKey === "vecerka") {
    statRows.splice(0, statRows.length,
      createStat("Čisté / hod", `+${formatDistrictBuildingMoney(mechanics.cleanHourly)}`),
      createStat("Špinavé / hod", `+${formatDistrictBuildingMoney(mechanics.dirtyHourly)}`),
      createStat("Heat / den", `+${formatCompactNumber(mechanics.dailyHeat)}`),
      createStat("Vliv / den", `+${formatCompactNumber(mechanics.dailyInfluence)}`),
      createStat("Drby", "pasivní ulice"),
      createStat("Akce", "Žádné")
    );
  } else if (mechanics.mechanicsType === "strip-club" || buildingKey === "strip club") {
    statRows.splice(0, statRows.length,
      createStat("Čisté / hod", `+${formatDistrictBuildingMoney(mechanics.cleanHourly)}`),
      createStat("Špinavé / hod", `+${formatDistrictBuildingMoney(mechanics.dirtyHourly)}`),
      createStat("Heat / den", `+${formatCompactNumber(mechanics.dailyHeat)}`),
      createStat("Vliv / den", `+${formatCompactNumber(mechanics.dailyInfluence)}`),
      createStat("Drby", "pasivní VIP tipy"),
      createStat("Akce", "cash / VIP / kompromat")
    );
  } else if (mechanics.mechanicsType === "smuggling-tunnel") {
    const tunnelNetwork = mechanics.smugglingTunnelNetwork || {};
    const tunnelHeatMultiplier = tunnelNetwork.heatMultiplier || tunnelNetwork.passiveHeatMultiplier;
    const tunnelNetworkParts = [
      isActiveNetworkMultiplier(tunnelNetwork.dirtyProductionMultiplier) ? `dirty tok ${formatMultiplierIncreasePercent(tunnelNetwork.dirtyProductionMultiplier)}` : "",
      isActiveNetworkMultiplier(tunnelHeatMultiplier) ? `heat ${formatMultiplierIncreasePercent(tunnelHeatMultiplier)}` : ""
    ].filter(Boolean);
    statRows.splice(0, statRows.length,
      createStat("Špinavé / hod", `+${formatDistrictBuildingMoney(mechanics.smugglingDirtyPerMinute * 60)}`),
      createStat("Heat / den", `+${formatCompactNumber(mechanics.dailyHeat)}`),
      createStat("Tunely", `${mechanics.ownedSmugglingTunnels}/${SMUGGLING_TUNNEL_CONFIG.countOnMap}`),
      createStat("Pouliční dealeři", `+${mechanics.smugglingDealerSupplyBonusPct}% podpora`),
      createStat("Kanál", mechanics.smugglingOpenChannelActive ? formatDistrictBuildingCooldown(mechanics.smugglingOpenChannelRemainingMs) : "Neaktivní")
    );
    if (tunnelNetworkParts.length) {
      statRows.push(createStat("Síť", tunnelNetworkParts.join(" · ")));
    }
  }

  return statRows;
}

export function createBuildingDetailMechanicRows({
  buildingName = "",
  mechanics = {}
} = {}) {
  const buildingKey = normalizeBuildingLookupKey(buildingName);
  const mechanicRows = [];
  if (mechanics.mechanicsType === "apartment-block") {
    const collectablePopulation = Math.max(0, Math.floor(Number(mechanics.apartmentWholePopulation || 0)));
    mechanicRows.push(
      createMechanicWithTone(
        "Lokální zásobník",
        `${mechanics.apartmentWholePopulation}/${mechanics.apartmentCapacity}`,
        collectablePopulation >= APARTMENT_BLOCK_MIN_COLLECT_POPULATION ? "collect-ready" : "collect-pending"
      ),
      createMechanic("Produkce", `+${mechanics.apartmentPopulationPerMinute.toFixed(2)} obyv./min`)
    );
  } else if (mechanics.mechanicsType === "school") {
    mechanicRows.push(
      createMechanic("K výběru", `${mechanics.schoolWholeStudents}/${mechanics.schoolCapacity}`),
      createMechanic("Produkce", `+${mechanics.schoolPopulationPerMinute.toFixed(2)} populace/min`),
      createMechanic("Síť škol", `kapacita ${formatMultiplierIncreasePercent(mechanics.schoolNetwork.studentCapacityMultiplier)} · income ${formatMultiplierIncreasePercent(mechanics.schoolNetwork.incomeMultiplier)}`),
      createMechanic("Večerní kurz", mechanics.schoolEveningCourseActive ? `bytové bloky zrychlené ${formatDistrictBuildingCooldown(mechanics.schoolEveningCourseRemainingMs)}` : "zrychlí nábor členů v bytových blocích")
    );
  } else if (mechanics.mechanicsType === "warehouse") {
    const storage = mechanics.serverStorageSummary;
    if (storage?.warehouseSummary) {
      const summary = storage.warehouseSummary;
      mechanicRows.push(
        createMechanic("Síť skladišť", String(summary.ownedWarehouseCount)),
        createMechanic("Nejvyšší level", `L${summary.highestWarehouseLevel}`),
        createMechanic("Bonus sítě", `x${Number(summary.warehouseCountMultiplier || 1).toFixed(2)}`),
        createMechanic("Bonus levelu", `x${Number(summary.warehouseLevelMultiplier || 1).toFixed(2)}`),
        createMechanic("Celkový násobitel", `x${Number(summary.totalCapacityMultiplier || 1).toFixed(2)}`),
        ...createServerWarehouseMaterialRows(storage)
      );
    } else {
      const warehouseCapacity = resolveWarehouseDisplayCapacity(mechanics.warehouseCapacity);
      const warehouseUsage = mechanics.warehouseUsage || {};
      mechanicRows.push(
        createMechanicWithTone("Materiál", `Chemicals ${warehouseUsage.chemicals || 0}/${warehouseCapacity.chemicals}`, resolveWarehouseCapacityTone(warehouseUsage.chemicals, warehouseCapacity.chemicals)),
        createMechanicWithTone("Materiál", `Biomass ${warehouseUsage.biomass || 0}/${warehouseCapacity.biomass}`, resolveWarehouseCapacityTone(warehouseUsage.biomass, warehouseCapacity.biomass)),
        createMechanicWithTone("Materiál", `Metal parts ${warehouseUsage.metalParts || 0}/${warehouseCapacity.metalParts}`, resolveWarehouseCapacityTone(warehouseUsage.metalParts, warehouseCapacity.metalParts)),
        createMechanicWithTone("Materiál", `Tech core ${warehouseUsage.techCore || 0}/${warehouseCapacity.techCore}`, resolveWarehouseCapacityTone(warehouseUsage.techCore, warehouseCapacity.techCore)),
        createMechanicWithTone("Materiál", `Bojové moduly ${warehouseUsage.combatModule || 0}/${warehouseCapacity.combatModule}`, resolveWarehouseCapacityTone(warehouseUsage.combatModule, warehouseCapacity.combatModule)),
        createMechanicWithTone("Materiál", `Drogy a boosty ${warehouseUsage.drugsAndBoosts || 0}/${warehouseCapacity.drugsAndBoosts}`, resolveWarehouseCapacityTone(warehouseUsage.drugsAndBoosts, warehouseCapacity.drugsAndBoosts)),
        createMechanicWithTone("Materiál", `Zbraně a obrana ${warehouseUsage.weaponsAndDefense || 0}/${warehouseCapacity.weaponsAndDefense}`, resolveWarehouseCapacityTone(warehouseUsage.weaponsAndDefense, warehouseCapacity.weaponsAndDefense)),
        createMechanic("Stav kapacity", (mechanics.warehouseWarnings || []).join(" · ") || "Kapacity jsou v pořádku.")
      );
    }
  } else if (mechanics.mechanicsType === "clinic") {
    mechanicRows.push(
      createMechanic("Stabilizace", mechanics.clinicRecoveryPool.totalFreshAmount > 0 ? "připravená" : "Čeká na ztráty tvojich členů za posledních 90min"),
      createMechanic("Síť klinik", `income ${formatMultiplierIncreasePercent(mechanics.clinicNetwork.incomeMultiplier)} · heat ${formatMultiplierIncreasePercent(mechanics.clinicNetwork.heatMultiplier)}`)
    );
  } else if (mechanics.mechanicsType === "recruitment-center") {
    return mechanicRows;
  } else if (mechanics.mechanicsType === "garage") {
    mechanicRows.push(
      createMechanic("Síť garáží", `Každá další garáž zvedá čistý výnos o ${formatMultiplierIncreasePercent(mechanics.garageNetwork.incomeMultiplier)} a heat o ${formatMultiplierIncreasePercent(mechanics.garageNetwork.heatMultiplier)}.`),
      createMechanic("Plný cooldown bonus", "Nejvíc zkracuje útoky, obsazení districtů a district loupeže."),
      createMechanic("Částečný cooldown bonus", "Menší zkrácení dostane špionáž, pasti, klinika, továrna a zbrojovka.")
    );
  } else if (mechanics.mechanicsType === "retail" || buildingKey === "obchodni centrum") {
    mechanicRows.push(
      createMechanicWithTone("Běžný market", `Nakupuješ levněji: ${mechanics.shoppingMallMarketDiscount.discountPct}% sleva.`, "retail-market"),
      createMechanicWithTone("Černý market", `Levnější nákupy: ${mechanics.shoppingMallBlackMarketDiscount.discountPct}% sleva.`, "retail-black-market"),
      createMechanicWithTone("Poplatky", `Market fee je nižší o ${mechanics.shoppingMallMarketDiscount.feeReductionPct}%.`, "retail-fee"),
      createMechanicWithTone("Clean / dirty", `Výnosy: clean ${formatMultiplierIncreasePercent(mechanics.shoppingMallNetwork.cleanIncomeMultiplier)}, dirty ${formatMultiplierIncreasePercent(mechanics.shoppingMallNetwork.dirtyIncomeMultiplier)}.`, "retail-income"),
      createMechanicWithTone("Vliv", `Pasivní vliv ${formatMultiplierIncreasePercent(mechanics.shoppingMallNetwork.influenceMultiplier)}.`, "retail-influence"),
      createMechanicWithTone("Heat", `Pasivní heat ${formatMultiplierIncreasePercent(mechanics.shoppingMallNetwork.heatMultiplier)}.`, "retail-heat")
    );
  } else if (mechanics.mechanicsType === "auto-salon" || buildingKey === "autosalon") {
    mechanicRows.push(
      createMechanic("Rychlejší akce", `Zkracuje Vykrást district, Obsazení districtu a přípravu útoku o ${mechanics.autoSalonSupport.cooldownReductionPct}%.`),
      createMechanic("Podpora zázemí", "Menší zkrácení dostane Stabilizační protokol v Klinice a Vytěžit ztráty v Recyklaci."),
      createMechanic("Únik po failu", `Při neúspěšném útoku přidá +${mechanics.autoSalonSupport.escapeChanceBonusPct}% k šanci, že gang sníží dopad ztrát.`),
      createMechanic("Síť autosalonů", `Další autosalony zvedají clean ${formatMultiplierIncreasePercent(mechanics.autoSalonNetwork.cleanIncomeMultiplier)}, dirty ${formatMultiplierIncreasePercent(mechanics.autoSalonNetwork.dirtyIncomeMultiplier)} a heat ${formatMultiplierIncreasePercent(mechanics.autoSalonNetwork.heatMultiplier)}.`)
    );
  } else if (mechanics.mechanicsType === "fitness-club" || buildingKey === "fitness club") {
    mechanicRows.push(
      createMechanic("Největší efekt", `Gang a baseballová pálka využijí +${formatPercentShare(FITNESS_CLUB_SUPPORT_CONFIG.attackApplication?.baseGangMemberAttack)} % fitness bonusu.`),
      createMechanic("Střelné zbraně", `Pistole využije +${formatPercentShare(FITNESS_CLUB_SUPPORT_CONFIG.attackApplication?.pistol)} %, samopal +${formatPercentShare(FITNESS_CLUB_SUPPORT_CONFIG.attackApplication?.smg)} %, granát +${formatPercentShare(FITNESS_CLUB_SUPPORT_CONFIG.attackApplication?.grenade)} % a bazuka +${formatPercentShare(FITNESS_CLUB_SUPPORT_CONFIG.attackApplication?.bazooka)} % bonusu.`),
      createMechanic("Obrana", `V obraně se bonus propíše do gangu +${formatPercentShare(FITNESS_CLUB_SUPPORT_CONFIG.defenseApplication?.baseGangMemberDefense)} %, do vesty +${formatPercentShare(FITNESS_CLUB_SUPPORT_CONFIG.defenseApplication?.vest)} % a do barikád +${formatPercentShare(FITNESS_CLUB_SUPPORT_CONFIG.defenseApplication?.barricades)} %.`),
      createMechanic("Bez bonusu", "Kamery, alarm a kulometné stanoviště z fitness clubu žádný bonus nedostávají.")
    );
  } else if (mechanics.mechanicsType === "restaurant" || buildingKey === "restaurace") {
    const network = mechanics.restaurantNetwork || {};
    mechanicRows.push(
      createMechanic("Denní provoz", `Restaurace vydělává čisté peníze a přidává lokální vliv.`),
      createMechanic("Pouliční drby", `Čím víc restaurací vlastníš, tím častěji se dozvíš, co se ve městě chystá.`),
      createMechanic("Síť restaurací", `Více restaurací zvedá příjem, vliv a drby, ale taky trochu zvyšuje heat.`)
    );
  } else if (mechanics.mechanicsType === "casino") {
    const casinoLaunderingCapacity = Math.max(0, Math.floor(Number(mechanics.casinoLaunderingCapacity || 0)));
    const casinoLaunderingFeePct = Number.isFinite(Number(mechanics.casinoLaunderingFeePct))
      ? Number(mechanics.casinoLaunderingFeePct)
      : 9;
    mechanicRows.push(
      createMechanic("Tichá herna", `Vypere část dirty cash až do ${formatDistrictBuildingMoney(casinoLaunderingCapacity)} za ${casinoLaunderingFeePct}% fee.`),
      createMechanic("VIP noc", "Noční boost zvedne clean, dirty, vliv, heat a audit risk."),
      createMechanic("Inspektor", "Drahá ochrana sníží heat a audit risk, ale může selhat."),
      createMechanic("Riziko auditu", "Kontroly sledují objem vypraných peněz v posledních 30 minutách.")
    );
  } else if (mechanics.mechanicsType === "exchange") {
    mechanicRows.push(
      createMechanic("Denní praní", "Výhodný kurz funguje jen přes den a vypere část aktuálního dirty cash."),
      createMechanic("Limit směny", `Základ je 16 % dirty cash, síť směnáren zvedá strop na ${formatDistrictBuildingMoney(mechanics.exchangeLaunderingCapacity)}.`),
      createMechanic("Síť směnáren", `Více směnáren zvedá výnos o ${formatMultiplierIncreasePercent(mechanics.exchangeNetwork.incomeMultiplier)} a limit praní o ${formatMultiplierIncreasePercent(mechanics.exchangeNetwork.launderingLimitMultiplier)}.`),
      createMechanic("Riziko kontroly", `${mechanics.exchangeAuditRisk} audit risk · heat sítě ${formatMultiplierIncreasePercent(mechanics.exchangeNetwork.heatMultiplier)}`)
    );
  } else if (mechanics.mechanicsType === "power-plant" || buildingKey === "energeticka stanice") {
    const network = mechanics.powerStationNetwork || {};
    mechanicRows.push(
      createMechanic("Infrastruktura", `Pasivně posiluje výrobu, sklady, kliniky a vybrané cash budovy o +${formatCompactNumber(network.infrastructureBonusPct || 0)} %.`),
      createMechanic("Záložní síť", `Za ${formatDistrictBuildingMoney(POWER_STATION_CONFIG.backupGridSwitch.cleanCost)} clean dočasně posílí infrastrukturu a obranu.`),
      createMechanic("Napájet výrobu", "Okamžitě přidá $2000 clean a $500 dirty. Heat +10."),
      createMechanic("Snížit heat", "Okamžitě stáhne heat districtu o 20.")
    );
  } else if (mechanics.mechanicsType === "recycling-center" || buildingKey === "recyklacni centrum") {
    const salvagePool = getRecyclingSalvagePoolView(mechanics.recyclingSalvagePool || mechanics.clinicRecoveryPool);
    const network = mechanics.recyclingCenterNetwork || {};
    mechanicRows.push(
      createMechanic("Vytěžit ztráty", `Vrátí ${formatCompactNumber(mechanics.recyclingSalvageRatePct || 0)} % čerstvých itemových ztrát.`),
      createMechanic("Ztráty", salvagePool.totalFreshAmount > 0 ? `${salvagePool.totalFreshAmount} itemů čeká na vytěžení.` : "Čeká na ztráty materiálu, modulů nebo výbavy."),
      createMechanic("Síť center", `Více center zvedá clean ${formatMultiplierIncreasePercent(network.incomeMultiplier)} a heat ${formatMultiplierIncreasePercent(network.heatMultiplier)}.`),
      createMechanic("Riziko", `Akce stojí ${formatDistrictBuildingMoney(RECYCLING_CENTER_CONFIG.extractLosses.cleanCost)} clean a přidá heat +${RECYCLING_CENTER_CONFIG.extractLosses.heatGain}.`)
    );
  } else if (mechanics.mechanicsType === "street-dealers" || buildingKey === "poulicni dealeri") {
    mechanicRows.push(
      createMechanic("Distribuce", "Prodává látky z Drug Labu přes sloty Pouličních dealerů."),
      createMechanic("Hot cash", "Rychlý výběr dá dirty cash a přidá heat."),
      createMechanic("Stash", "Spotřebuje biomass a převede ho na dirty cash."),
      createMechanic("Riziko", "Dealerské akce pracují s heatem a pouličním rizikem.")
    );
  } else if (mechanics.mechanicsType === "convenience-store" || buildingKey === "vecerka") {
    mechanicRows.push(
      createMechanic("Cashflow", "Malý clean i dirty příjem bez speciálních akcí."),
      createMechanic("Drby", "Každých 10 minut může vytvořit pouliční drb."),
      createMechanic("Síť večerek", "Více večerek zvedá income, vliv a šanci na drb."),
      createMechanic("Synergie", "Restaurace zlepšují civilní drby z večerek.")
    );
  } else if (mechanics.mechanicsType === "strip-club" || buildingKey === "strip club") {
    mechanicRows.push(
      createMechanic("Noční cash", "Přímý dirty výběr s krátkým cooldownem."),
      createMechanic("VIP klienti", "Dočasně zvednou income, vliv, heat a šanci na drb."),
      createMechanic("Drby", "každý Strip club vytvoří 1 drb každých 30 min"),
      createMechanic("Kompromat", "Přidá vliv a krátký influence boost za heat."),
      createMechanic("Síť clubů", "Více clubů zvedá income, vliv, drby i heat.")
    );
  } else if (mechanics.mechanicsType === "smuggling-tunnel") {
    const dealerSalePriceBoostPct = mechanics.smugglingDealerSupplyBonusPct * SMUGGLING_TUNNEL_CONFIG.dealerSupplySalePriceSharePct / 100;
    const dealerSaleSpeedBoostPct = mechanics.smugglingDealerSupplyBonusPct * SMUGGLING_TUNNEL_CONFIG.dealerSupplySaleSpeedSharePct / 100;
    const streetRiskReductionPct = mechanics.smugglingDealerSupplyBonusPct * SMUGGLING_TUNNEL_CONFIG.dealerSupplyStreetRiskReductionSharePct / 100;
    const dealerHeatBoostPct = mechanics.smugglingDealerSupplyBonusPct * SMUGGLING_TUNNEL_CONFIG.dealerSupplySaleHeatRiskSharePct / 100;
    mechanicRows.push(
      createMechanic("Tok dirty cash", "Tunel pasivně vyrábí dirty cash."),
      createMechanic("Pouliční dealeři", `Prodej z Labu: cena +${dealerSalePriceBoostPct}% · rychlost +${dealerSaleSpeedBoostPct}%.`),
      createMechanic("Pouliční riziko", `Riziko při prodeji -${streetRiskReductionPct}% · heat z prodeje +${dealerHeatBoostPct}%.`)
    );
  } else if (mechanics.mechanicsType === "arcade") {
    mechanicRows.push(
      createMechanic("Síť heren", `income ${formatMultiplierIncreasePercent(mechanics.arcadeNetwork.incomeMultiplier)} · limit ${formatMultiplierIncreasePercent(mechanics.arcadeNetwork.launderingLimitMultiplier)}`),
      createMechanic("Noční automaty", "dočasně zvednou income, vliv, heat a audit risk"),
      createMechanic("Zadní pokladna", "pere část dirty cash za fee"),
      createMechanic("Riziko", `audit ${mechanics.arcadeAuditRisk} · heat z akcí`)
    );
  } else {
    mechanicRows.push(
      createMechanic("Výnos", `${formatDistrictBuildingMoney(mechanics.cleanHourly + mechanics.dirtyHourly)} / hod`),
      createMechanic("Income", "Automaticky do zdrojů")
    );
    if (mechanics.hasManualCollect) {
      mechanicRows.push(createMechanic("Collect", mechanics.canCollect ? "Připraveno" : "Čeká na výstup"));
    }
    mechanicRows.push(createMechanic("Čekání akce", formatDistrictBuildingCooldown(DISTRICT_BUILDING_DETAIL_ACTION_COOLDOWN_MS)));
  }
  return mechanicRows;
}

export function createBuildingDetailActionRows({
  buildingName = "",
  profile = {},
  mechanics = {},
  detailEntry = {},
  economyState = {},
  actionProfiles = [],
  phaseState = null,
  now = Date.now()
} = {}) {
  return (Array.isArray(profile.actions) ? profile.actions : []).flatMap((action, actionIndex) => {
    const actionProfile = actionProfiles[actionIndex] || null;
    if (!isBuildingSpecialActionImplemented(buildingName, action, actionProfile || {})) {
      return [];
    }
    const actionDefinition = resolveBuildingSpecialActionDefinition({
      buildingName,
      actionLabel: action,
      actionIndex,
      actionProfile
    });
    const baseCooldownMs = Math.max(0, Number(actionDefinition.cooldownMs || 0));
    const garageCategory = resolveGarageCategoryForBuildingAction(buildingName, action, actionDefinition);
    const autoSalonCategory = resolveAutoSalonCategoryForBuildingAction(buildingName, action, actionDefinition);
    const cooldownReductionView = resolveCombinedEffectiveCooldownMs({
      baseCooldownMs,
      garageSupport: mechanics.garageSupport,
      garageCategory,
      autoSalonSupport: mechanics.autoSalonSupport,
      autoSalonCategory
    });
    const effectiveCooldownMs = cooldownReductionView.effectiveCooldownMs;
    const garageCooldownReductionPct = cooldownReductionView.garageReductionPct;
    const cooldownUntil = getBuildingSpecialActionCooldownUntil(mechanics.actionCooldowns, actionDefinition.actionId, actionIndex);
    const cooldownRemaining = Math.max(0, cooldownUntil - now);
    const actionUiOptions = createBuildingActionUiFormatOptions({
      mechanics,
      buildingType: buildingName,
      actionIndex,
      actionProfile
    });
    const clinicStabilizationPreview = actionProfile?.clinicStabilizationProtocol
      ? createClinicStabilizationPreview(mechanics)
      : null;
    const rewardSummary = clinicStabilizationPreview
      ? formatClinicStabilizationRewardSummary(clinicStabilizationPreview)
      : actionProfile
      ? formatBuildingActionOutputProfile(actionProfile, actionUiOptions)
      : actionDefinition.rewardSummary;
    const riskSummary = actionProfile
      ? formatBuildingActionRiskProfile(actionProfile, actionUiOptions)
      : actionDefinition.riskSummary;
    const recyclingSalvagePool = actionProfile?.recyclingExtractLosses
      ? getRecyclingSalvagePoolView(mechanics.recyclingSalvagePool || mechanics.clinicRecoveryPool)
      : null;
    const hasMissingCleanCash = (
      (actionProfile?.cleanCost && Number(economyState.cleanMoney || 0) < Number(actionProfile.cleanCost || 0))
      || (actionProfile?.casinoBribedInspector && Number(economyState.cleanMoney || 0) < Number(actionProfile.cleanCost || 0))
      || (actionProfile?.schoolEveningCourse && Number(economyState.cleanMoney || 0) < Number(actionProfile.cleanCost || 0))
      || (actionProfile?.clinicStabilizationProtocol && Number(economyState.cleanMoney || 0) < Number(actionProfile.cleanCost || 0))
      || (actionProfile?.recyclingExtractLosses && Number(economyState.cleanMoney || 0) < Number(actionProfile.cleanCost || 0))
    );
    const hasMissingDirtyCash = (
      (actionProfile?.dirtyCost && Number(economyState.dirtyMoney || 0) < Number(actionProfile.dirtyCost || 0))
      || (actionProfile?.casinoQuietBackroom && Number(economyState.dirtyMoney || 0) < Number(actionProfile.minimumDirty || 0))
      || (actionProfile?.exchangeOfficeGoodRate && Number(economyState.dirtyMoney || 0) < Number(actionProfile.minimumDirty || 0))
      || (actionProfile?.arcadeBackCashdesk && Number(economyState.dirtyMoney || 0) < Number(actionProfile.minimumDirty || 0))
    );
    const missingMaterialCost = Object.entries(actionProfile?.materialCost || {}).find(([itemId, amount]) =>
      Number(economyState.materials?.[itemId] || 0) < Math.max(0, Math.floor(Number(amount || 0)))
    ) || null;
    const phaseLockRule = getPhaseLockedBuildingActionRule(actionDefinition.actionId);
    const phaseLockLabel = phaseLockRule
      ? phaseLockRule.allowedPhase === "night" ? "Jen v noci" : "Jen ve dne"
      : "";
    const phaseDisabledReason = resolvePhaseLockedBuildingActionDisabledReason(actionDefinition.actionId, phaseState);
    const casinoDisabledReason = actionDefinition.disabledReason
      || phaseDisabledReason
      || (cooldownRemaining > 0 ? `Akce čeká ${formatDistrictBuildingCooldown(cooldownRemaining)}.` : "")
      || (hasMissingCleanCash && actionProfile?.cleanCost
        ? `Potřebuješ ${formatDistrictBuildingMoney(actionProfile.cleanCost)} clean cash.`
        : "")
      || (hasMissingDirtyCash && actionProfile?.dirtyCost
        ? `Potřebuješ ${formatDistrictBuildingMoney(actionProfile.dirtyCost)} dirty cash.`
        : "")
      || (missingMaterialCost
        ? `Potřebuješ ${missingMaterialCost[0]} x${Math.max(0, Math.floor(Number(missingMaterialCost[1] || 0)))}.`
        : "")
      || (actionProfile?.casinoQuietBackroom && Number(economyState.dirtyMoney || 0) < Number(actionProfile.minimumDirty || 0)
      ? `Potřebuješ ${formatDistrictBuildingMoney(actionProfile.minimumDirty)} dirty cash.`
      : actionProfile?.exchangeOfficeGoodRate && Number(economyState.dirtyMoney || 0) < Number(actionProfile.minimumDirty || 0)
        ? `Potřebuješ ${formatDistrictBuildingMoney(actionProfile.minimumDirty)} dirty cash.`
      : actionProfile?.arcadeBackCashdesk && Number(economyState.dirtyMoney || 0) < Number(actionProfile.minimumDirty || 0)
        ? `Potřebuješ ${formatDistrictBuildingMoney(actionProfile.minimumDirty)} dirty cash.`
      : actionProfile?.casinoBribedInspector && Number(economyState.cleanMoney || 0) < Number(actionProfile.cleanCost || 0)
        ? `Potřebuješ ${formatDistrictBuildingMoney(actionProfile.cleanCost)} clean cash.`
      : actionProfile?.apartmentCollectPopulation && Number(mechanics.apartmentWholePopulation || 0) < APARTMENT_BLOCK_MIN_COLLECT_POPULATION
        ? `Bytový blok potřebuje alespoň ${APARTMENT_BLOCK_MIN_COLLECT_POPULATION} lidí k výběru.`
      : actionProfile?.smugglingOpenChannel && Number(economyState.cleanMoney || 0) < SMUGGLING_TUNNEL_CONFIG.openChannelCleanCost
        ? `Potřebuješ ${formatDistrictBuildingMoney(SMUGGLING_TUNNEL_CONFIG.openChannelCleanCost)} clean cash.`
      : actionProfile?.smugglingOpenChannel && mechanics.smugglingOpenChannelActive
        ? `Otevřený kanál běží. Zbývá ${formatDistrictBuildingCooldown(mechanics.smugglingOpenChannelRemainingMs)}.`
      : actionProfile?.schoolEveningCourse && Number(economyState.cleanMoney || 0) < Number(actionProfile.cleanCost || 0)
        ? `Potřebuješ ${formatDistrictBuildingMoney(actionProfile.cleanCost)} clean cash.`
      : actionProfile?.schoolEveningCourse && mechanics.schoolEveningCourseActive
        ? `Večerní kurz běží. Zbývá ${formatDistrictBuildingCooldown(mechanics.schoolEveningCourseRemainingMs)}.`
      : actionProfile?.clinicStabilizationProtocol && Number(economyState.cleanMoney || 0) < Number(actionProfile.cleanCost || 0)
        ? `Potřebuješ ${formatDistrictBuildingMoney(actionProfile.cleanCost)} clean cash.`
      : actionProfile?.recyclingExtractLosses && Number(economyState.cleanMoney || 0) < Number(actionProfile.cleanCost || 0)
        ? `Potřebuješ ${formatDistrictBuildingMoney(actionProfile.cleanCost)} clean cash.`
      : actionProfile?.clinicStabilizationProtocol && (!clinicStabilizationPreview || clinicStabilizationPreview.recoverableAmount <= 0)
        ? "Žádné ztráty k léčbě."
      : actionProfile?.recyclingExtractLosses && (!recyclingSalvagePool || recyclingSalvagePool.fresh.length <= 0)
        ? "Nemáš žádné ztráty k vytěžení."
      : "");
    const activeSameCasinoBoost = actionProfile?.casinoVipNight
      && detailEntry.activeEffects?.some((effect) => effect.label === action && Number(effect.expiresAt || 0) > now);
    const activeSameArcadeBoost = actionProfile?.arcadeNightMachines
      && detailEntry.activeEffects?.some((effect) => effect.label === action && Number(effect.expiresAt || 0) > now);
    const activeBoostRemainingMs = activeSameCasinoBoost || activeSameArcadeBoost
      ? Number(detailEntry.activeEffects?.find((effect) => effect.label === action)?.expiresAt || 0) - now
      : 0;
    const actionUi = getBuildingActionUi(action, buildingName, {
      ...actionUiOptions,
      actionState: {
        disabledReason: casinoDisabledReason,
        activeBoostRemainingMs,
        formatCooldown: formatDistrictBuildingCooldown
      }
    });
    const activeBoostDescription = activeSameCasinoBoost || activeSameArcadeBoost
      ? getActionDisabledReason({
          activeBoostRemainingMs,
          formatCooldown: formatDistrictBuildingCooldown
        })
      : "";
    return [{
      index: actionIndex,
      actionId: actionDefinition.actionId,
      buildingTypeId: actionDefinition.buildingTypeId,
      handlerId: actionDefinition.handlerId,
      title: actionUi.label,
      disabled: cooldownRemaining > 0 || Boolean(activeSameCasinoBoost) || Boolean(activeSameArcadeBoost) || Boolean(casinoDisabledReason),
      disabledReason: casinoDisabledReason,
      description: activeBoostDescription || actionUi.disabledReason || rewardSummary || getActionDescription(action, actionUiOptions),
      shortDescription: actionDefinition.shortDescription,
      confirmTitle: actionDefinition.confirmTitle,
      confirmBody: actionDefinition.confirmBody,
      costSummary: actionDefinition.costSummary,
      inputSummary: actionDefinition.inputSummary,
      buttonCostLabel: ["casino", "smuggling-tunnel", "recycling-center", "power-plant"].includes(mechanics.mechanicsType) ? actionDefinition.costSummary : "",
      phaseLockLabel,
      phaseLockTone: phaseLockRule ? String(phaseLockRule.allowedPhase || "") : "",
      rewardSummary,
      riskSummary,
      disabledTone: hasMissingCleanCash || hasMissingDirtyCash || Boolean(missingMaterialCost)
        ? "insufficient-funds"
        : "",
      cooldownMs: effectiveCooldownMs,
      baseCooldownMs,
      effectiveCooldownMs,
      garageCooldownReductionPct,
      autoSalonCooldownReductionPct: cooldownReductionView.autoSalonReductionPct,
      combinedCooldownReductionPct: cooldownReductionView.combinedReductionPct,
      cooldownRemainingMs: cooldownRemaining,
      cooldownLabel: cooldownRemaining > 0
        ? `Zbývá ${formatDistrictBuildingCooldown(cooldownRemaining)}`
        : activeSameCasinoBoost
          ? "Aktivní boost"
          : activeSameArcadeBoost
            ? "Aktivní boost"
            : effectiveCooldownMs > 0
              ? `Čekání ${formatGarageEffectiveCooldownLabel({
                  baseCooldownMs,
                  effectiveCooldownMs,
                  formatCooldown: formatDistrictBuildingCooldown
                })}`
              : "Připraveno"
    }];
  });
}

export function createBuildingDetailViewModel({
  district = null,
  buildingName = "",
  displayName = buildingName,
  profile = {},
  mechanics = {},
  detailEntry = {},
  buildingProfile = {},
  buildingBackgroundPath = null,
  economyState = {},
  playerHeat = 0,
  actionProfiles = [],
  phaseState = null,
  now = Date.now()
} = {}) {
  const focusedLabel = FOCUSED_BUILDING_DETAIL_LABELS[mechanics.mechanicsType] || "";
  const isGarage = mechanics.mechanicsType === "garage";
  const isFocusedBuilding = Boolean(focusedLabel);
  const districtType = String(buildingProfile?.typeKey || district?.districtType || "").trim().toLowerCase();
  const isDowntownBuilding = districtType === "downtown";
  const displayLabel = focusedLabel
    ? focusedLabel
    : String(displayName || buildingName || "Budova").trim() || "Budova";
  const showManualCollect = Boolean(mechanics.hasManualCollect);
  const hideUpgrade = isGarage;
  const collectTitle = showManualCollect
    ? (mechanics.canCollect
        ? `Vybrat připravený výstup: ${mechanics.storedOutputLabel}`
        : mechanics.mechanicsType === "school"
          ? "Škola zatím nemá připravené členy k výběru."
          : mechanics.mechanicsType === "apartment-block"
            ? `Bytový blok potřebuje alespoň ${APARTMENT_BLOCK_MIN_COLLECT_POPULATION} lidí k výběru.`
          : mechanics.mechanicsType === "smuggling-tunnel"
            ? `V tunelu musí být alespoň ${formatDistrictBuildingMoney(SMUGGLING_TUNNEL_CONFIG.minCollectDirty)} dirty cash.`
            : "Populace zatím není připravená k vybrání.")
    : "";
  const metaText = isFocusedBuilding
    ? ""
    : [
      displayLabel !== buildingName ? buildingName : "",
      isDowntownBuilding ? "" : profile.role,
      district?.id ? `District ${district.id}` : "",
      buildingProfile?.setTitle || ""
    ].filter(Boolean).join(" · ");
  const badge = FOCUSED_BUILDING_DETAIL_BADGES[mechanics.mechanicsType] || (isDowntownBuilding ? "" : profile.role);
  const suppressSinglePanelActions = SUPPRESS_SINGLE_PANEL_ACTIONS.has(mechanics.mechanicsType);
  const canUpgrade = hasBuildingUpgradeCapability(mechanics);

  return {
    title: displayLabel,
    badge,
    typeLabel: badge,
    countLabel: createBuildingDetailCountLabel(mechanics),
    backgroundImagePath: buildingBackgroundPath,
    mechanicsType: mechanics.mechanicsType,
    districtType,
    isDowntownBuilding,
    levelLabel: canUpgrade ? `L${mechanics.level}` : "",
    showLevel: canUpgrade,
    name: displayLabel,
    meta: metaText,
    collect: {
      visible: showManualCollect,
      enabled: Boolean(mechanics.canCollect),
      title: collectTitle
    },
    upgrade: {
      visible: !hideUpgrade && canUpgrade,
      disabled: hideUpgrade || !mechanics.nextLevel,
      title: mechanics.nextLevel
        ? `Upgrade na L${mechanics.nextLevel} za ${mechanics.upgradeCostLabel}`
        : hideUpgrade
          ? "Garáž je pasivní budova bez upgradu."
          : "Budova je na maximálním levelu."
    },
    stats: createBuildingDetailStatRows({ buildingName, mechanics, detailEntry, buildingProfile, playerHeat, now }),
    mechanics: createBuildingDetailMechanicRows({ buildingName, mechanics }),
    hideMechanicsSection: mechanics.mechanicsType === "recruitment-center",
    effectsLabel: mechanics.effectsLabel || "Žádné aktivní mechaniky.",
    effects: createEffectItemsWithOwnedCount(mechanics.effectsLabel || "Žádné aktivní mechaniky.", mechanics, {
      buildingName,
      phaseState
    }),
    intro: profile.info || "",
    showActionsInSinglePanel: !suppressSinglePanelActions,
    actions: suppressSinglePanelActions
      ? []
      : createBuildingDetailActionRows({ buildingName, profile, mechanics, detailEntry, economyState, actionProfiles, phaseState, now })
  };
}
