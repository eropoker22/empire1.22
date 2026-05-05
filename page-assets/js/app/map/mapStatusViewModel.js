const OVERLAY_LABELS = Object.freeze({
  heatmap: "Heatmap",
  influence: "Influence",
  ownership: "Ownership",
  trap: "Traps"
});

function toIdSet(value) {
  if (value instanceof Set) {
    return new Set(Array.from(value).map(Number).filter(Boolean));
  }
  if (Array.isArray(value)) {
    return new Set(value.map(Number).filter(Boolean));
  }
  return new Set();
}

function normalizeDistricts(districts) {
  return Array.isArray(districts) ? districts.filter(Boolean) : [];
}

function getDistrictId(district) {
  return Number(district?.id || 0);
}

function getSelectedDistrictLabel(selectedDistrict, options = {}) {
  if (!selectedDistrict) {
    return "Žádný district";
  }
  if (typeof options.getDistrictDisplayName === "function") {
    return options.getDistrictDisplayName(selectedDistrict);
  }
  const districtId = getDistrictId(selectedDistrict);
  return districtId > 0 ? `District ${districtId}` : "District";
}

function getActiveOverlayLabel(overlayState = {}, options = {}) {
  const key = String(overlayState?.activeOverlay || "").trim();
  const labels = options.overlayLabels || OVERLAY_LABELS;
  return labels[key] || labels.ownership || "Ownership";
}

function isEnemyDistrict(district, context = {}, options = {}) {
  if (typeof options.isEnemyDistrict === "function") {
    return Boolean(options.isEnemyDistrict(district, context));
  }

  const districtId = getDistrictId(district);
  if (!districtId || context.destroyedDistrictIds.has(districtId) || context.ownedDistrictIds.has(districtId)) {
    return false;
  }

  const ownerId = Number(context.launchOwnerByDistrictId?.get?.(districtId) || 0);
  if (!ownerId) {
    return false;
  }
  return Number(context.currentPlayerId || 0) > 0 ? ownerId !== Number(context.currentPlayerId) : true;
}

export function buildMapStatusViewModel(input = {}, options = {}) {
  const districts = normalizeDistricts(input.districts);
  const destroyedDistrictIds = toIdSet(input.destroyedDistrictIds);
  const ownedDistrictIds = toIdSet(input.ownedDistrictIds);
  const launchOwnerByDistrictId = input.launchOwnerByDistrictId instanceof Map
    ? input.launchOwnerByDistrictId
    : new Map();
  const context = {
    destroyedDistrictIds,
    ownedDistrictIds,
    launchOwnerByDistrictId,
    currentPlayerId: input.currentPlayerId
  };

  const liveDistricts = districts.filter((district) => {
    const districtId = getDistrictId(district);
    return districtId > 0 && !destroyedDistrictIds.has(districtId);
  });
  const enemyDistrictCount = liveDistricts.reduce(
    (count, district) => count + (isEnemyDistrict(district, context, options) ? 1 : 0),
    0
  );

  return {
    districtCount: liveDistricts.length,
    ownedDistrictCount: liveDistricts.reduce(
      (count, district) => count + (ownedDistrictIds.has(getDistrictId(district)) ? 1 : 0),
      0
    ),
    enemyDistrictCount,
    selectedDistrictLabel: getSelectedDistrictLabel(input.selectedDistrict, options),
    activeOverlayLabel: getActiveOverlayLabel(input.overlayState, options),
    message: input.message || ""
  };
}
