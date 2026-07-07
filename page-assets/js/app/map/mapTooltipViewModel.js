function getDistrictId(district) {
  return Number(district?.id || 0);
}

function getFallbackTypeLabel(district, interactionState = {}, options = {}) {
  const districtId = Number(district?.id || 0);
  const ownedDistrictIds = interactionState?.ownedDistrictIds instanceof Set
    ? interactionState.ownedDistrictIds
    : new Set(Array.isArray(interactionState?.ownedDistrictIds) ? interactionState.ownedDistrictIds.map(Number) : []);
  const revealedTypeDistrictIds = options.spyIntel?.revealedTypeDistrictIds instanceof Set
    ? options.spyIntel.revealedTypeDistrictIds
    : new Set(Array.isArray(options.spyIntel?.revealedTypeDistrictIds) ? options.spyIntel.revealedTypeDistrictIds.map(Number) : []);
  const typeKnown = ownedDistrictIds.has(districtId) || revealedTypeDistrictIds.has(districtId);
  if (!typeKnown) {
    return "Neznámý sektor";
  }

  if (typeof options.getDistrictAtmosphereMeta === "function") {
    return options.getDistrictAtmosphereMeta(district, interactionState)?.shortLabel || "District";
  }
  return String(district?.districtType || "").trim() || "District";
}

function getLaunchOwnerLabel(launchOwnerId, options = {}) {
  const ownerId = Number(launchOwnerId || 0);
  if (!ownerId) {
    return "";
  }
  return ownerId === Number(options.currentPlayerId)
    ? "TY"
    : typeof options.getLaunchPlayerName === "function"
      ? options.getLaunchPlayerName(ownerId)
      : `P${ownerId}`;
}

function getTooltipGossipEntries(district, options = {}) {
  const isGossipEnabled = typeof options.isDistrictGossipDevOnlyMode === "function"
    ? options.isDistrictGossipDevOnlyMode()
    : Boolean(options.gossipEnabled);
  if (!district || !isGossipEnabled || typeof options.ensureDistrictPassiveGossip !== "function") {
    return [];
  }
  const entries = options.ensureDistrictPassiveGossip(district);
  return Array.isArray(entries) ? entries.slice(0, 2) : [];
}

export function buildMapTooltipViewModel(district = null, interactionState = {}, options = {}) {
  const districtId = getDistrictId(district);
  if (!district || !districtId) {
    return null;
  }

  if (interactionState?.destroyedDistrictIds?.has?.(districtId)) {
    return {
      id: districtId,
      idLabel: "District zničen",
      typeLabel: "",
      gossipEntries: [],
      destroyed: true
    };
  }

  const launchOwnerId = interactionState?.gamePhase === "launch" || interactionState?.gamePhase === "live"
    ? interactionState.launchOwnerByDistrictId?.get?.(districtId)
    : null;
  const ownerLabel = getLaunchOwnerLabel(launchOwnerId, options);
  return {
    id: districtId,
    idLabel: String(districtId),
    typeLabel: ownerLabel || getFallbackTypeLabel(district, interactionState, options),
    gossipEntries: getTooltipGossipEntries(district, options)
  };
}
