import {
  GANG_HEAT_TIERS
} from "./heatData.js";
import {
  POLICE_OPERATION_TYPES,
  POLICE_RAID_SPECIALTIES,
  POLICE_SPECIALTY_RANDOM_WEIGHTS
} from "./narrativeData.js";

export function clampGangHeat(value) {
  return Math.min(Math.max(Number.parseInt(String(value ?? 0), 10) || 0, 0), 9999);
}

export function clampGangInfluence(value) {
  return Math.max(0, Number.parseInt(String(value ?? 0), 10) || 0);
}

export function resolveGangHeatTier(heatValue = 0) {
  const safeHeat = clampGangHeat(heatValue);
  return GANG_HEAT_TIERS.find((entry) => safeHeat >= entry.minHeat && safeHeat <= entry.maxHeat) || GANG_HEAT_TIERS[0];
}

export function normalizeGangHeatJournal(entries, options = {}) {
  const limit = Math.max(1, Math.floor(Number(options.limit || 18)));
  const now = typeof options.now === "function" ? options.now : Date.now;
  return (Array.isArray(entries) ? entries : [])
    .filter((entry) => entry && typeof entry === "object" && typeof entry.reason === "string")
    .map((entry, index) => ({
      id: String(entry.id || `heat-log-${now()}-${index}`),
      type: entry.type === "fall" ? "fall" : "rise",
      amount: Math.max(0, Number.parseInt(String(entry.amount || 0), 10) || 0),
      reason: String(entry.reason || "").trim(),
      createdAt: typeof entry.createdAt === "string" && entry.createdAt ? entry.createdAt : new Date(now()).toISOString()
    }))
    .filter((entry) => entry.reason)
    .slice(0, limit);
}

export function formatGangHeatProtectionLabel(untilValue, options = {}) {
  const now = typeof options.now === "function" ? options.now : Date.now;
  const formatDuration = typeof options.formatDurationLabel === "function"
    ? options.formatDurationLabel
    : (value) => `${Math.max(0, Math.ceil(Number(value || 0) / 1000))}s`;
  const until = Math.max(0, Number(untilValue || 0) || 0);
  if (until <= now()) {
    return "Bez ochrany";
  }

  return formatDuration(until - now());
}

export function resolveWeightedRandomKey(weightedEntries, fallbackKey, random = Math.random) {
  const safeEntries = Array.isArray(weightedEntries) ? weightedEntries.filter((entry) => Number(entry?.weight) > 0) : [];
  if (safeEntries.length === 0) {
    return fallbackKey;
  }

  const totalWeight = safeEntries.reduce((sum, entry) => sum + Number(entry.weight || 0), 0);
  if (totalWeight <= 0) {
    return fallbackKey;
  }

  let cursor = random() * totalWeight;
  for (const entry of safeEntries) {
    cursor -= Number(entry.weight || 0);
    if (cursor <= 0) {
      return String(entry.key || fallbackKey);
    }
  }

  return String(safeEntries[safeEntries.length - 1]?.key || fallbackKey);
}

export function resolvePoliceSpecialty(key) {
  return POLICE_RAID_SPECIALTIES[String(key || "").trim().toLowerCase()] || POLICE_RAID_SPECIALTIES.total;
}

export function resolvePoliceOperationType(key) {
  return POLICE_OPERATION_TYPES[String(key || "").trim().toLowerCase()] || null;
}

export function resolveRandomPoliceSpecialtyKey(random = Math.random) {
  return resolveWeightedRandomKey(POLICE_SPECIALTY_RANDOM_WEIGHTS, "total", random);
}

const POLICE_OPERATION_CANDIDATES_BY_SPECIALTY = Object.freeze({
  financial: Object.freeze([
    Object.freeze({ key: "cash_seizure", weight: 42 }),
    Object.freeze({ key: "dirty_cash_seizure", weight: 34 }),
    Object.freeze({ key: "district_control", weight: 24 })
  ]),
  drug: Object.freeze([
    Object.freeze({ key: "drug_seizure", weight: 44 }),
    Object.freeze({ key: "warehouse_raid", weight: 34 }),
    Object.freeze({ key: "district_control", weight: 22 })
  ]),
  weapons: Object.freeze([
    Object.freeze({ key: "building_shutdown", weight: 42 }),
    Object.freeze({ key: "warehouse_raid", weight: 34 }),
    Object.freeze({ key: "district_control", weight: 24 })
  ]),
  arrests: Object.freeze([
    Object.freeze({ key: "apartment_search", weight: 44 }),
    Object.freeze({ key: "district_lock", weight: 34 }),
    Object.freeze({ key: "coordinated_operation", weight: 22 })
  ]),
  total: Object.freeze([
    Object.freeze({ key: "coordinated_operation", weight: 30 }),
    Object.freeze({ key: "district_lock", weight: 22 }),
    Object.freeze({ key: "building_shutdown", weight: 18 }),
    Object.freeze({ key: "dirty_cash_seizure", weight: 16 }),
    Object.freeze({ key: "drug_seizure", weight: 14 })
  ])
});

export function resolveRandomPoliceOperationType(tierId, source = "", random = Math.random, specialtyKey = "") {
  const normalizedSource = String(source || "").trim().toLowerCase();
  if (normalizedSource === "heat-dirty-bribe") {
    return tierId >= 4 ? "dirty_cash_seizure" : "district_control";
  }

  const normalizedSpecialty = String(specialtyKey || "").trim().toLowerCase();
  const specialtyCandidates = POLICE_OPERATION_CANDIDATES_BY_SPECIALTY[normalizedSpecialty];
  if (specialtyCandidates) {
    const eligibleSpecialtyCandidates = specialtyCandidates
      .filter((entry) => Number(POLICE_OPERATION_TYPES[entry.key]?.minTier || 1) <= Number(tierId || 1));
    if (eligibleSpecialtyCandidates.length > 0) {
      return resolveWeightedRandomKey(eligibleSpecialtyCandidates, eligibleSpecialtyCandidates[0].key, random);
    }
  }

  const eligible = Object.values(POLICE_OPERATION_TYPES)
    .filter((entry) => Number(entry.minTier || 1) <= Number(tierId || 1))
    .map((entry) => ({ key: entry.key, weight: entry.weight }));

  return resolveWeightedRandomKey(eligible, "warning_notice", random);
}

export function applyPercentageLoss(value, percent) {
  const safeValue = Math.max(0, Math.floor(Number(value || 0)));
  const safePercent = Math.max(0, Number(percent || 0));
  if (safeValue <= 0 || safePercent <= 0) {
    return { nextValue: safeValue, lostValue: 0 };
  }

  const lostValue = Math.min(safeValue, Math.max(0, Math.floor((safeValue * safePercent) / 100)));
  return {
    nextValue: Math.max(0, safeValue - lostValue),
    lostValue
  };
}

export function summarizePenaltyEntries(entries, resolver) {
  const safeEntries = Array.isArray(entries) ? entries : [];
  if (safeEntries.length <= 0) {
    return "0";
  }

  const resolveLabel = typeof resolver === "function" ? resolver : (itemId) => itemId;
  return safeEntries
    .slice(0, 3)
    .map((entry) => `${resolveLabel(entry.itemId)} -${entry.lostValue}`)
    .join(", ");
}

if (typeof window !== "undefined") {
  window.EmpireGangHeatPoliceHelpers = {
    applyPercentageLoss,
    clampGangHeat,
    clampGangInfluence,
    formatGangHeatProtectionLabel,
    normalizeGangHeatJournal,
    resolveGangHeatTier,
    resolvePoliceOperationType,
    resolvePoliceSpecialty,
    resolveRandomPoliceOperationType,
    resolveRandomPoliceSpecialtyKey,
    resolveWeightedRandomKey,
    summarizePenaltyEntries
  };
}
