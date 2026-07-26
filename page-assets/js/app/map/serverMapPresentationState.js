const EFFECT_GROUPS = Object.freeze([
  ["activeSpyDistrictIds", "activeSpyMarkersByDistrictId"],
  ["activePoliceDistrictIds", "activePoliceMarkersByDistrictId"],
  ["activeAttackDistrictIds", "activeAttackMarkersByDistrictId"],
  ["activeOccupyDistrictIds", "activeOccupyCountdownByDistrictId"],
  ["activeRobberyDistrictIds", "activeRobberyMarkersByDistrictId"],
  ["activeTrapDistrictIds", null]
]);

export const normalizeServerMapSettings = (settings = {}) => ({
  mapDistrictBorders: settings.mapDistrictBorders !== false,
  mapAllianceSymbols: settings.mapAllianceSymbols !== false,
  mapVisibilityMode: settings.mapVisibilityMode || "all",
  borderColor: settings.borderColor || "white"
});

const createEmptyEffects = () => ({
  activeSpyDistrictIds: new Set(),
  activeSpyMarkersByDistrictId: new Map(),
  activePoliceDistrictIds: new Set(),
  activePoliceMarkersByDistrictId: new Map(),
  activeAttackDistrictIds: new Set(),
  activeAttackMarkersByDistrictId: new Map(),
  activeOccupyDistrictIds: new Set(),
  activeOccupyCountdownByDistrictId: new Map(),
  activeRobberyDistrictIds: new Set(),
  activeRobberyMarkersByDistrictId: new Map(),
  activeTrapDistrictIds: new Set()
});

export const createServerMapInteractionState = (settings = {}) => {
  const normalized = normalizeServerMapSettings(settings);
  return {
    hoveredDistrictId: null,
    selectedDistrictId: null,
    borderColor: normalized.borderColor,
    showDistrictBorders: normalized.mapDistrictBorders,
    showAllianceSymbols: normalized.mapAllianceSymbols,
    mapVisibilityMode: normalized.mapVisibilityMode,
    reducedMapEffects: false,
    gamePhase: "live",
    revealedDistrictIds: new Set(),
    occupiedDistrictIds: new Set(),
    ownedDistrictIds: new Set(),
    destroyedDistrictIds: new Set(),
    districtOwnerById: {},
    launchOwnerByDistrictId: new Map(),
    animationTick: 0,
    geometryCache: null,
    ...createEmptyEffects()
  };
};

export const syncServerMapInteractionState = (state, model, settings = {}) => {
  const normalized = normalizeServerMapSettings(settings);
  state.borderColor = normalized.borderColor;
  state.showDistrictBorders = normalized.mapDistrictBorders;
  state.showAllianceSymbols = normalized.mapAllianceSymbols;
  state.mapVisibilityMode = normalized.mapVisibilityMode;
  if (!model) return state;

  state.selectedDistrictId = model.selectedDistrictId ?? state.selectedDistrictId;
  state.gamePhase = model.gamePhase;
  state.occupiedDistrictIds = new Set(model.occupiedDistrictIds);
  state.ownedDistrictIds = new Set(model.ownedDistrictIds);
  state.revealedDistrictIds = new Set(model.ownedDistrictIds);
  state.destroyedDistrictIds = new Set(model.destroyedDistrictIds);
  state.districtOwnerById = { ...model.districtOwnerById };
  state.launchOwnerByDistrictId = new Map(
    Object.entries(model.districtOwnerById)
      .map(([districtId, ownerId]) => [Number(districtId), ownerId])
  );
  Object.assign(state, model.effects);
  return state;
};

export const hasServerMapEffectEntries = (state) => (
  EFFECT_GROUPS.some(([setKey]) => (state?.[setKey]?.size || 0) > 0)
);

export const hasLiveServerMapEffects = (state, now = Date.now()) => (
  EFFECT_GROUPS.some(([setKey, markerKey]) => {
    for (const districtId of state?.[setKey] || []) {
      const marker = markerKey ? state?.[markerKey]?.get?.(districtId) : null;
      if (!marker || !Number.isFinite(marker.expiresAt) || marker.expiresAt > now) return true;
    }
    return false;
  })
);

export const syncServerMapGeometryMetadata = (geometry, model, interactionState) => {
  if (!geometry || !model) return geometry;
  for (const district of geometry.districts || []) {
    const serverDistrict = model.districtById.get(Number(district.id));
    if (serverDistrict?.zone) district.districtType = serverDistrict.zone;
    if (serverDistrict?.name) district.name = serverDistrict.name;
  }
  interactionState.geometryCache = geometry;
  return geometry;
};
