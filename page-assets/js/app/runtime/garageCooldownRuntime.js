const normalizeGarageActionKey = (value) => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

const GARAGE_BUILDING_ACTION_CATEGORY_BY_KEY = Object.freeze({
  "klinika::stabilizacni protokol": "clinicRecovery",
  "clinic::stabilization protocol": "clinicRecovery"
});

export function resolveGarageCategoryForBuildingAction(buildingName = "", actionLabel = "", actionDefinition = {}) {
  const buildingTypeId = normalizeGarageActionKey(actionDefinition.buildingTypeId || "");
  const actionId = normalizeGarageActionKey(actionDefinition.actionId || "");
  if (buildingTypeId === "clinic" && actionId === "stabilization protocol") {
    return "clinicRecovery";
  }

  const buildingKey = normalizeGarageActionKey(buildingName);
  const actionKey = normalizeGarageActionKey(actionLabel);
  return GARAGE_BUILDING_ACTION_CATEGORY_BY_KEY[`${buildingKey}::${actionKey}`] || null;
}

export function resolveGarageCooldownReductionPctForCategory(garageSupport = {}, category = "") {
  if (!garageSupport || !category) {
    return 0;
  }

  const baseReductionPct = Math.max(0, Number(garageSupport.cooldownReductionPct || 0));
  const maxReductionPct = Math.max(0, Number(garageSupport.maxCooldownReductionPct || baseReductionPct));
  const fullCategories = Array.isArray(garageSupport.fullBonusCategories) ? garageSupport.fullBonusCategories : [];
  const halfCategories = Array.isArray(garageSupport.halfBonusCategories) ? garageSupport.halfBonusCategories : [];
  const scale = fullCategories.includes(category)
    ? 1
    : halfCategories.includes(category)
      ? 0.5
      : 0;

  return Math.min(maxReductionPct, baseReductionPct * scale);
}

export function resolveGarageEffectiveCooldownMs(baseCooldownMs = 0, garageSupport = {}, category = "") {
  const base = Math.max(0, Math.floor(Number(baseCooldownMs || 0)));
  if (base <= 0) {
    return 0;
  }

  const reductionPct = resolveGarageCooldownReductionPctForCategory(garageSupport, category);
  if (reductionPct <= 0) {
    return base;
  }

  return Math.max(1, Math.ceil(base * (1 - reductionPct / 100)));
}

export function resolveAutoSalonCategoryForBuildingAction(buildingName = "", actionLabel = "", actionDefinition = {}) {
  const buildingTypeId = normalizeGarageActionKey(actionDefinition.buildingTypeId || "");
  const actionId = normalizeGarageActionKey(actionDefinition.actionId || "");
  if (buildingTypeId === "clinic" && actionId === "stabilization protocol") {
    return "clinicEvacuationRecovery";
  }
  if (buildingTypeId === "recycling center" && actionId === "extract losses") {
    return "recyclingSalvageTransport";
  }

  const buildingKey = normalizeGarageActionKey(buildingName);
  const actionKey = normalizeGarageActionKey(actionLabel);
  if (buildingKey === "klinika" && actionKey === "stabilizacni protokol") {
    return "clinicEvacuationRecovery";
  }
  if (buildingKey === "recyklacni centrum" && actionKey === "vytezit ztraty") {
    return "recyclingSalvageTransport";
  }
  return null;
}

export function resolveAutoSalonCooldownReductionPctForCategory(autoSalonSupport = {}, category = "") {
  if (!autoSalonSupport || !category) {
    return 0;
  }

  const baseReductionPct = Math.max(0, Number(autoSalonSupport.cooldownReductionPct || 0));
  const maxReductionPct = Math.max(0, Number(autoSalonSupport.maxCooldownReductionPct || baseReductionPct));
  const fullCategories = Array.isArray(autoSalonSupport.fullBonusCategories) ? autoSalonSupport.fullBonusCategories : [];
  const halfCategories = Array.isArray(autoSalonSupport.halfBonusCategories) ? autoSalonSupport.halfBonusCategories : [];
  const smallCategories = Array.isArray(autoSalonSupport.smallBonusCategories) ? autoSalonSupport.smallBonusCategories : [];
  const scale = fullCategories.includes(category)
    ? 1
    : halfCategories.includes(category)
      ? 0.5
      : smallCategories.includes(category)
        ? 0.25
        : 0;

  return Math.min(maxReductionPct, baseReductionPct * scale);
}

export function resolveCombinedCooldownReductionPct({
  garageSupport = {},
  garageCategory = "",
  autoSalonSupport = {},
  autoSalonCategory = ""
} = {}) {
  const garageReductionPct = resolveGarageCooldownReductionPctForCategory(garageSupport, garageCategory);
  const autoSalonReductionPct = resolveAutoSalonCooldownReductionPctForCategory(autoSalonSupport, autoSalonCategory);
  const rawReductionPct = garageReductionPct + autoSalonReductionPct;
  if (rawReductionPct <= 0) {
    return {
      garageReductionPct,
      autoSalonReductionPct,
      combinedReductionPct: 0
    };
  }

  const combinedCapPct = Math.max(0, Number(autoSalonSupport?.combinedGarageDealerMaxReductionPct || 0));
  return {
    garageReductionPct,
    autoSalonReductionPct,
    combinedReductionPct: combinedCapPct > 0 ? Math.min(combinedCapPct, rawReductionPct) : rawReductionPct
  };
}

export function resolveCombinedEffectiveCooldownMs({
  baseCooldownMs = 0,
  garageSupport = {},
  garageCategory = "",
  autoSalonSupport = {},
  autoSalonCategory = ""
} = {}) {
  const base = Math.max(0, Math.floor(Number(baseCooldownMs || 0)));
  if (base <= 0) {
    return {
      effectiveCooldownMs: 0,
      garageReductionPct: 0,
      autoSalonReductionPct: 0,
      combinedReductionPct: 0
    };
  }

  const reductions = resolveCombinedCooldownReductionPct({
    garageSupport,
    garageCategory,
    autoSalonSupport,
    autoSalonCategory
  });
  return {
    ...reductions,
    effectiveCooldownMs: reductions.combinedReductionPct > 0
      ? Math.max(1, Math.ceil(base * (1 - reductions.combinedReductionPct / 100)))
      : base
  };
}

export function formatGarageEffectiveCooldownLabel({
  baseCooldownMs = 0,
  effectiveCooldownMs = baseCooldownMs,
  formatCooldown
} = {}) {
  const format = typeof formatCooldown === "function"
    ? formatCooldown
    : (value) => `${Math.max(0, Math.ceil(Number(value || 0) / 1000))}s`;
  const base = Math.max(0, Math.floor(Number(baseCooldownMs || 0)));
  const effective = Math.max(0, Math.floor(Number(effectiveCooldownMs || 0)));
  if (base <= 0) {
    return "Ready";
  }
  if (effective > 0 && effective < base) {
    return `${format(effective)} (-${format(base - effective)})`;
  }
  return format(base);
}
