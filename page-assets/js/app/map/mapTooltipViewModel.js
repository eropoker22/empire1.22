function getDistrictId(district) {
  return Number(district?.id || 0);
}

function safeText(value) {
  return String(value ?? "").trim();
}

function getEventDistrictId(event = {}) {
  const payload = event?.payload && typeof event.payload === "object" ? event.payload : {};
  return safeText(
    event?.districtId
    || event?.targetDistrictId
    || payload.districtId
    || payload.targetDistrictId
  );
}

function getEventText(event = {}) {
  const payload = event?.payload && typeof event.payload === "object" ? event.payload : {};
  return safeText(
    event?.message
    || event?.summary
    || event?.text
    || payload.message
    || payload.summary
    || payload.rumor
  );
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
      : `Hráč ${ownerId}`;
}

function getServerTooltipGossipEntries(district, cityFeed, gossipEvents = null, limit = 2) {
  if ((!cityFeed || typeof cityFeed !== "object") && !Array.isArray(gossipEvents)) {
    return null;
  }

  const districtId = getDistrictId(district);
  const canonicalDistrictId = `district:${districtId}`;
  const seen = new Set();
  const events = [
    ...(Array.isArray(gossipEvents) ? gossipEvents : []),
    ...(Array.isArray(cityFeed?.currentPlayerFeed) ? cityFeed.currentPlayerFeed : []),
    ...(Array.isArray(cityFeed?.globalCityFeed) ? cityFeed.globalCityFeed : []),
    ...(Array.isArray(cityFeed?.selectedDistrictFeed) ? cityFeed.selectedDistrictFeed : [])
  ];

  return events
    .filter((event) => {
      const eventDistrictId = getEventDistrictId(event);
      if (eventDistrictId !== String(districtId) && eventDistrictId !== canonicalDistrictId) {
        return false;
      }
      const eventText = getEventText(event);
      const eventId = String(event?.sourceEventId || event?.id || `${eventDistrictId}:${eventText}`);
      if (seen.has(eventId)) {
        return false;
      }
      seen.add(eventId);
      return Boolean(eventText);
    })
    .sort((left, right) => (
      Number(right?.priority || 0) - Number(left?.priority || 0)
      || Number(right?.createdAtTick || 0) - Number(left?.createdAtTick || 0)
    ))
    .slice(0, Math.max(1, Number(limit) || 2))
    .map((event) => ({
      text: getEventText(event),
      intelLevel: event?.truthiness === "confirmed"
        || event?.intelType === "confirmed_event"
        || event?.confidence === "confirmed"
        ? "verified"
        : "rumor"
    }));
}

function getTooltipGossipEntries(district, options = {}) {
  const serverEntries = getServerTooltipGossipEntries(district, options.cityFeed, options.gossipEvents, 2);
  if (Array.isArray(serverEntries)) {
    return serverEntries;
  }

  const isGossipEnabled = typeof options.isDistrictGossipDevOnlyMode === "function"
    ? options.isDistrictGossipDevOnlyMode()
    : Boolean(options.gossipEnabled);
  if (!district || !isGossipEnabled || typeof options.ensureDistrictPassiveGossip !== "function") {
    return [];
  }
  const entries = options.ensureDistrictPassiveGossip(district);
  return Array.isArray(entries) ? entries.slice(0, 2) : [];
}

export function getMapTooltipContentKey(viewModel = null) {
  if (!viewModel) {
    return "";
  }
  return JSON.stringify([
    viewModel.idLabel || viewModel.id || "",
    viewModel.typeLabel || "",
    Boolean(viewModel.destroyed),
    ...(Array.isArray(viewModel.gossipEntries)
      ? viewModel.gossipEntries.map((entry) => `${entry?.intelLevel || "rumor"}:${entry?.text || ""}`)
      : [])
  ]);
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
