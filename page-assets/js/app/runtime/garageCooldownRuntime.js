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
