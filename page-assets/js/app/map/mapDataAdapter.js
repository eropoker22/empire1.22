import {
  DISTRICT_ATMOSPHERE_META,
  DISTRICT_BUILDING_TYPE_META,
  MAP_CURRENT_PLAYER_LABEL,
  MAP_DEFAULT_DISTRICT_TYPE,
  MAP_DEFAULT_OWNER_COLOR,
  MAP_DESTROYED_FILL_STYLES,
  MAP_DESTROYED_OWNER_LABEL,
  MAP_HIDDEN_FILL_STYLES,
  MAP_LAUNCH_UNOWNED_FILL_STYLE,
  MAP_UNOWNED_OWNER_LABEL,
  MAP_UNKNOWN_DISTRICT_TYPE,
  MAP_ZONE_FILL_STYLES
} from "./mapConstants.js";

export function normalizeMapZoneKey(value, fallback = MAP_DEFAULT_DISTRICT_TYPE) {
  const normalized = String(value || "").trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(DISTRICT_BUILDING_TYPE_META, normalized)
    ? normalized
    : fallback;
}

export function resolveMapZoneFillStyle(zoneKey, isNight = false) {
  const phaseKey = isNight ? "night" : "day";
  const palette = MAP_ZONE_FILL_STYLES[phaseKey] || MAP_ZONE_FILL_STYLES.day;
  const normalizedZoneKey = normalizeMapZoneKey(zoneKey);
  return palette[normalizedZoneKey] || palette[MAP_DEFAULT_DISTRICT_TYPE];
}

export function resolveMapDestroyedFillStyle(isNight = false) {
  return isNight ? MAP_DESTROYED_FILL_STYLES.night : MAP_DESTROYED_FILL_STYLES.day;
}

export function resolveMapHiddenFillStyle(isNight = false) {
  return isNight ? MAP_HIDDEN_FILL_STYLES.night : MAP_HIDDEN_FILL_STYLES.day;
}

export function resolveMapLaunchUnownedFillStyle() {
  return MAP_LAUNCH_UNOWNED_FILL_STYLE;
}

export function resolveMapAtmosphereMeta(zoneKey, options = {}) {
  if (options.hidden) {
    return DISTRICT_ATMOSPHERE_META[MAP_UNKNOWN_DISTRICT_TYPE];
  }

  const normalizedZoneKey = normalizeMapZoneKey(zoneKey, "");
  return DISTRICT_ATMOSPHERE_META[normalizedZoneKey] || DISTRICT_ATMOSPHERE_META[MAP_UNKNOWN_DISTRICT_TYPE];
}

export function normalizeMapOwner(owner = null, options = {}) {
  const ownerId = Number(owner?.id ?? owner?.ownerId ?? options.ownerId ?? 0) || null;
  const isCurrentPlayer = Boolean(options.currentPlayerId && ownerId === Number(options.currentPlayerId));
  const fallbackLabel = String(options.fallbackLabel || MAP_UNOWNED_OWNER_LABEL);
  const label = isCurrentPlayer
    ? MAP_CURRENT_PLAYER_LABEL
    : String(owner?.label || owner?.name || options.label || fallbackLabel).trim() || fallbackLabel;
  const color = String(owner?.color || options.color || MAP_DEFAULT_OWNER_COLOR).trim() || MAP_DEFAULT_OWNER_COLOR;

  return {
    id: ownerId,
    label,
    color,
    isCurrentPlayer
  };
}

export function normalizeMapBuildingList(buildings = []) {
  if (!Array.isArray(buildings)) {
    return [];
  }

  return buildings
    .map((building) => {
      if (typeof building === "string") {
        const name = building.trim();
        return name ? { name, displayName: name } : null;
      }

      if (!building || typeof building !== "object") {
        return null;
      }

      const name = String(building.name || building.baseName || building.displayName || "").trim();
      const displayName = String(building.displayName || building.name || building.baseName || name).trim();

      if (!name && !displayName) {
        return null;
      }

      return {
        ...building,
        name: name || displayName,
        displayName: displayName || name
      };
    })
    .filter(Boolean);
}

export function resolveMapDistrictOwnerLabel(district, interactionState = {}, options = {}) {
  const districtId = Number(district?.id ?? 0) || 0;

  if (interactionState.destroyedDistrictIds?.has(districtId)) {
    return options.destroyedLabel || MAP_DESTROYED_OWNER_LABEL;
  }

  const gamePhase = interactionState.gamePhase || "launch";
  const launchOwnerByDistrictId = interactionState.launchOwnerByDistrictId;
  const launchOwnerId = gamePhase === "launch" && launchOwnerByDistrictId?.get
    ? launchOwnerByDistrictId.get(districtId)
    : null;
  const currentPlayerId = Number(options.currentPlayerId ?? 0) || 0;

  if (launchOwnerId) {
    return Number(launchOwnerId) === currentPlayerId
      ? (options.currentPlayerLabel || MAP_CURRENT_PLAYER_LABEL)
      : options.getLaunchPlayerName?.(launchOwnerId) || `P${launchOwnerId}`;
  }

  const ownedDistrictIds = interactionState.ownedDistrictIds || new Set();
  return ownedDistrictIds.has?.(districtId)
    ? (options.currentPlayerLabel || MAP_CURRENT_PLAYER_LABEL)
    : (options.unownedLabel || MAP_UNOWNED_OWNER_LABEL);
}

export function createMapDistrictViewModel(district = {}, options = {}) {
  const id = Number(district?.id ?? options.id ?? 0) || 0;
  const zoneKey = normalizeMapZoneKey(district?.districtType ?? district?.zone ?? options.zone);
  const atmosphereMeta = resolveMapAtmosphereMeta(zoneKey, { hidden: Boolean(options.hidden) });
  const owner = normalizeMapOwner(options.owner || district?.owner, {
    ownerId: options.ownerId,
    currentPlayerId: options.currentPlayerId,
    label: options.ownerLabel,
    color: options.ownerColor,
    fallbackLabel: options.ownerFallbackLabel
  });
  const buildings = normalizeMapBuildingList(options.buildings ?? district?.buildings);

  return {
    id,
    title: id ? `District ${id}` : "District",
    zoneKey,
    districtType: zoneKey,
    typeLabel: atmosphereMeta.shortLabel,
    owner,
    ownerLabel: owner.label,
    buildings,
    hasBuildings: buildings.length > 0
  };
}
