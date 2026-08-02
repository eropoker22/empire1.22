const normalizeNonNegativeInteger = (value) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue)
    ? Math.max(0, Math.floor(numericValue))
    : 0;
};

export function normalizeExistingStorageAmount(value) {
  return normalizeNonNegativeInteger(value);
}

export function normalizeExistingStorageBuckets({
  resourceKeys = [],
  materials = {},
  drugs = {},
  weapons = {},
  isMaterialResource = () => false,
  isDrugResource = () => false,
  isWeaponResource = () => false
} = {}) {
  const nextMaterials = { ...materials };
  const nextDrugs = { ...drugs };
  const nextWeapons = { ...weapons };
  let changed = false;

  const normalizeBucketValue = (target, resourceKey) => {
    const hasStoredValue = Object.prototype.hasOwnProperty.call(target, resourceKey);
    const normalizedAmount = normalizeExistingStorageAmount(target[resourceKey]);
    if ((!hasStoredValue && normalizedAmount === 0) || target[resourceKey] === normalizedAmount) {
      return;
    }
    target[resourceKey] = normalizedAmount;
    changed = true;
  };

  for (const resourceKey of resourceKeys) {
    if (isMaterialResource(resourceKey)) {
      normalizeBucketValue(nextMaterials, resourceKey);
      continue;
    }
    if (isDrugResource(resourceKey)) {
      normalizeBucketValue(nextDrugs, resourceKey);
      continue;
    }
    if (isWeaponResource(resourceKey)) {
      normalizeBucketValue(nextWeapons, resourceKey);
      continue;
    }
    normalizeBucketValue(nextMaterials, resourceKey);
  }

  return {
    changed,
    materials: nextMaterials,
    drugs: nextDrugs,
    weapons: nextWeapons
  };
}

export function resolveLocalDemoStorageCapacityState(value, capacity) {
  const currentAmount = normalizeExistingStorageAmount(value);
  const maxAmount = normalizeNonNegativeInteger(capacity);
  return {
    currentAmount,
    maxAmount,
    fillPercent: maxAmount > 0 ? currentAmount / maxAmount * 100 : 0,
    isNearCapacity: currentAmount >= maxAmount * 0.8 && currentAmount < maxAmount,
    isFull: currentAmount === maxAmount,
    isOverCapacity: currentAmount > maxAmount
  };
}
