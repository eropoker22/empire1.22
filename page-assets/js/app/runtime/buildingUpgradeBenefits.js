import { formatDistrictBuildingMoney } from "./formatters.js";

const BUILDING_TYPE_LABELS = Object.freeze({
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
  warehouse: "Sklad",
  "power-plant": "Energetická stanice",
  "recycling-center": "Recyklační centrum",
  "street-dealers": "Pouliční dealeři",
  "convenience-store": "Večerka",
  "smuggling-tunnel": "Pašovací tunel",
  "strip-club": "Strip club",
  "stock-exchange": "Burza",
  "central-bank": "Centrální banka",
  "city-hall": "Magistrát",
  "lobby-club": "Lobby klub",
  "vip-lounge": "VIP salonek",
  airport: "Letiště",
  port: "Přístav",
  parliament: "Parlament",
  court: "Soud",
  pharmacy: "Lékárna",
  "drug-lab": "Lab",
  factory: "Továrna",
  armory: "Zbrojovka",
  "district-asset": "Budova"
});

const BENEFIT_PRIORITY = Object.freeze({
  "population-rate": 10,
  "population-capacity": 11,
  "student-rate": 12,
  "student-capacity": 13,
  "laundering-capacity": 18,
  "laundering-fee": 19,
  "dirty-flow": 20,
  "batch-capacity": 21,
  "dealer-supply": 22,
  "clean-income": 30,
  "dirty-income": 31,
  "influence": 40,
  "heat": 45,
  "action-heat": 46,
  "storage": 50,
  "level-bonus": 80
});

function normalizeLabel(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function resolveBuildingTypeLabel({ mechanicsType = "", buildingName = "", fallbackLabel = "" } = {}) {
  const typeLabel = BUILDING_TYPE_LABELS[mechanicsType];
  if (typeLabel) {
    return typeLabel;
  }

  const normalizedName = normalizeLabel(buildingName);
  const matchedType = Object.entries(BUILDING_TYPE_LABELS)
    .find(([, label]) => normalizeLabel(label) === normalizedName);
  return matchedType?.[1] || BUILDING_TYPE_LABELS["district-asset"] || fallbackLabel || "Budova";
}

function toFiniteNumber(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function formatSignedNumber(value, formatter = (numberValue) => String(numberValue), suffix = "") {
  const normalized = Number(value);
  if (!Number.isFinite(normalized)) {
    return "";
  }
  const prefix = normalized > 0 ? "+" : "";
  return `${prefix}${formatter(normalized)}${suffix}`;
}

function formatMoneyPerHour(value) {
  return `${formatDistrictBuildingMoney(Math.round(Number(value || 0)))}/hod`;
}

function formatDecimal(value, fractionDigits = 2) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return "";
  }
  return numberValue.toFixed(fractionDigits);
}

function formatInteger(value) {
  return String(Math.round(Number(value || 0)));
}

function formatPct(value) {
  return `${formatDecimal(value, Number.isInteger(Number(value)) ? 0 : 1)}%`;
}

function createFallbackBenefit() {
  return {
    id: "fallback",
    icon: "!",
    label: "Levelový bonus",
    value: "Zatím není definovaný",
    detail: "Upgrade tohoto typu nemá v konfiguraci konkrétní levelovou změnu.",
    tone: "neutral",
    fallback: true
  };
}

function addNumericDelta(benefits, {
  id,
  icon = "+",
  label,
  before,
  after,
  formatter = formatInteger,
  valueFormatter = formatter,
  suffix = "",
  tone = "positive",
  lowerIsBetter = false
}) {
  const beforeNumber = toFiniteNumber(before);
  const afterNumber = toFiniteNumber(after);
  if (beforeNumber === null || afterNumber === null || beforeNumber === afterNumber) {
    return;
  }

  const delta = afterNumber - beforeNumber;
  const normalizedTone = lowerIsBetter
    ? (delta < 0 ? "positive" : "risk")
    : tone;
  benefits.push({
    id,
    icon,
    label,
    value: formatSignedNumber(delta, valueFormatter, suffix),
    detail: `${formatter(beforeNumber)}${suffix} → ${formatter(afterNumber)}${suffix}`,
    tone: normalizedTone,
    priority: BENEFIT_PRIORITY[id] || 99
  });
}

function addCommonBenefitDeltas(benefits, currentMechanics, nextMechanics) {
  addNumericDelta(benefits, {
    id: "clean-income",
    icon: "$",
    label: "Clean cash",
    before: currentMechanics.cleanHourly,
    after: nextMechanics.cleanHourly,
    formatter: formatMoneyPerHour,
    valueFormatter: (value) => formatDistrictBuildingMoney(Math.round(value))
  });
  addNumericDelta(benefits, {
    id: "dirty-income",
    icon: "$",
    label: "Dirty cash",
    before: currentMechanics.dirtyHourly,
    after: nextMechanics.dirtyHourly,
    formatter: formatMoneyPerHour,
    valueFormatter: (value) => formatDistrictBuildingMoney(Math.round(value))
  });
  addNumericDelta(benefits, {
    id: "influence",
    icon: "*",
    label: "Vliv / den",
    before: currentMechanics.dailyInfluence,
    after: nextMechanics.dailyInfluence,
    formatter: formatDecimal,
    valueFormatter: formatDecimal
  });
  addNumericDelta(benefits, {
    id: "heat",
    icon: "!",
    label: "Heat / den",
    before: currentMechanics.dailyHeat,
    after: nextMechanics.dailyHeat,
    formatter: formatDecimal,
    valueFormatter: formatDecimal,
    tone: "risk"
  });
}

function addRoleBenefitDeltas(benefits, currentMechanics, nextMechanics) {
  addNumericDelta(benefits, {
    id: "population-rate",
    icon: "+",
    label: "Populace / min",
    before: currentMechanics.apartmentPopulationPerMinute,
    after: nextMechanics.apartmentPopulationPerMinute,
    formatter: formatDecimal,
    valueFormatter: formatDecimal
  });
  addNumericDelta(benefits, {
    id: "population-capacity",
    icon: "#",
    label: "Kapacita obyvatel",
    before: currentMechanics.apartmentCapacity,
    after: nextMechanics.apartmentCapacity,
    formatter: formatInteger,
    valueFormatter: formatInteger
  });
  addNumericDelta(benefits, {
    id: "student-rate",
    icon: "+",
    label: "Studenti / min",
    before: currentMechanics.schoolPopulationPerMinute,
    after: nextMechanics.schoolPopulationPerMinute,
    formatter: formatDecimal,
    valueFormatter: formatDecimal
  });
  addNumericDelta(benefits, {
    id: "student-capacity",
    icon: "#",
    label: "Kapacita studentů",
    before: currentMechanics.schoolCapacity,
    after: nextMechanics.schoolCapacity,
    formatter: formatInteger,
    valueFormatter: formatInteger
  });
  addNumericDelta(benefits, {
    id: "laundering-capacity",
    icon: "$",
    label: "Kapacita praní",
    before: currentMechanics.casinoLaunderingCapacity ?? currentMechanics.exchangeLaunderingCapacity ?? currentMechanics.arcadeLaunderingCapacity,
    after: nextMechanics.casinoLaunderingCapacity ?? nextMechanics.exchangeLaunderingCapacity ?? nextMechanics.arcadeLaunderingCapacity,
    formatter: formatDistrictBuildingMoney,
    valueFormatter: formatDistrictBuildingMoney
  });
  addNumericDelta(benefits, {
    id: "laundering-fee",
    icon: "%",
    label: "Poplatek praní",
    before: currentMechanics.casinoLaunderingFeePct,
    after: nextMechanics.casinoLaunderingFeePct,
    formatter: formatPct,
    valueFormatter: formatPct,
    lowerIsBetter: true
  });
  addNumericDelta(benefits, {
    id: "action-heat",
    icon: "!",
    label: "Heat akcí",
    before: currentMechanics.casinoActionHeatReductionPct,
    after: nextMechanics.casinoActionHeatReductionPct,
    formatter: formatPct,
    valueFormatter: formatPct
  });
  addNumericDelta(benefits, {
    id: "storage",
    icon: "#",
    label: "Kapacita skladu",
    before: currentMechanics.warehouseCapacity?.genericResources,
    after: nextMechanics.warehouseCapacity?.genericResources,
    formatter: formatInteger,
    valueFormatter: formatInteger
  });
  addNumericDelta(benefits, {
    id: "dirty-flow",
    icon: "$",
    label: "Dirty flow",
    before: currentMechanics.smugglingDirtyPerMinute,
    after: nextMechanics.smugglingDirtyPerMinute,
    formatter: (value) => `${formatDistrictBuildingMoney(Math.round(value))}/min`,
    valueFormatter: (value) => formatDistrictBuildingMoney(Math.round(value))
  });
  addNumericDelta(benefits, {
    id: "batch-capacity",
    icon: "#",
    label: "Kapacita dávky",
    before: currentMechanics.smugglingBatchCapacity,
    after: nextMechanics.smugglingBatchCapacity,
    formatter: formatInteger,
    valueFormatter: formatInteger
  });
  addNumericDelta(benefits, {
    id: "dealer-supply",
    icon: "%",
    label: "Dealer supply",
    before: currentMechanics.smugglingDealerSupplyBonusPct,
    after: nextMechanics.smugglingDealerSupplyBonusPct,
    formatter: formatPct,
    valueFormatter: formatPct
  });
}

function addLevelMultiplierBenefit(benefits, currentMechanics, nextMechanics) {
  const currentLevel = toFiniteNumber(currentMechanics.level);
  const nextLevel = toFiniteNumber(nextMechanics.level);
  if (currentLevel === null || nextLevel === null || nextLevel <= currentLevel) {
    return;
  }

  const beforeMultiplier = 1 + (Math.max(1, currentLevel) - 1) * 0.14;
  const afterMultiplier = 1 + (Math.max(1, nextLevel) - 1) * 0.14;
  if (beforeMultiplier === afterMultiplier) {
    return;
  }

  benefits.push({
    id: "level-bonus",
    icon: "L",
    label: "Level bonus",
    value: `x${afterMultiplier.toFixed(2)}`,
    detail: `x${beforeMultiplier.toFixed(2)} → x${afterMultiplier.toFixed(2)}`,
    tone: "positive",
    priority: BENEFIT_PRIORITY["level-bonus"]
  });
}

export function resolveBuildingUpgradeBenefits({
  currentMechanics = {},
  nextMechanics = {},
  maxVisible = 3
} = {}) {
  const benefits = [];
  addRoleBenefitDeltas(benefits, currentMechanics, nextMechanics);
  addCommonBenefitDeltas(benefits, currentMechanics, nextMechanics);
  addLevelMultiplierBenefit(benefits, currentMechanics, nextMechanics);

  const sorted = benefits
    .filter((benefit) => benefit.value)
    .sort((left, right) => (left.priority || 99) - (right.priority || 99));

  if (sorted.length <= 0) {
    return {
      benefits: [createFallbackBenefit()],
      hiddenCount: 0,
      hasFallback: true
    };
  }

  return {
    benefits: sorted.slice(0, maxVisible).map(({ priority, ...benefit }) => benefit),
    hiddenCount: Math.max(0, sorted.length - maxVisible),
    hasFallback: false
  };
}

export function createBuildingUpgradeConfirmationViewModel({
  buildingName = "",
  displayName = "",
  currentMechanics = {},
  nextMechanics = {},
  resourceStatus = {}
} = {}) {
  const currentLevel = Math.max(1, Math.floor(Number(currentMechanics.level || 1)));
  const nextLevel = Math.max(currentLevel + 1, Math.floor(Number(currentMechanics.nextLevel || nextMechanics.level || currentLevel + 1)));
  const buildingTypeLabel = resolveBuildingTypeLabel({
    mechanicsType: currentMechanics.mechanicsType || nextMechanics.mechanicsType,
    buildingName,
    fallbackLabel: displayName
  });
  const benefitModel = resolveBuildingUpgradeBenefits({ currentMechanics, nextMechanics });
  return {
    buildingLabel: buildingTypeLabel,
    titleLabel: `${buildingTypeLabel} · L${currentLevel} → L${nextLevel}`,
    description: "Potvrzením posuneš typ budovy na vyšší úroveň a okamžitě získáš nové bonusy.",
    upgradeLabel: `L${currentLevel} → L${nextLevel}`,
    costLabel: currentMechanics.upgradeCostLabel || "$0",
    benefits: benefitModel.benefits,
    hiddenBenefitCount: benefitModel.hiddenCount,
    hasFallbackBenefit: benefitModel.hasFallback,
    noteLabel: resourceStatus.canConfirm === false
      ? `Chybí ${Array.isArray(resourceStatus.missing) ? resourceStatus.missing.join(" + ") : "zdroje"}.`
      : `Po potvrzení zaplatíš ${currentMechanics.upgradeCostLabel || "$0"}.`
  };
}

export { resolveBuildingTypeLabel };
