export function getDistrictDisplayName(district = {}) {
  const id = Number(district?.id || 0);
  return id > 0 ? `District ${id}` : "District";
}

export function getDistrictZoneLabel(district = {}, options = {}) {
  const typeKey = String(district?.districtType || "").trim();
  const meta = options.districtTypeMeta?.[typeKey] || options.districtTypeMeta?.resident || null;
  return meta?.shortLabel || meta?.label || typeKey || "District";
}

export function getDistrictOwnerLabel(district = {}, state = {}, options = {}) {
  const districtId = Number(district?.id || 0);
  const destroyedDistrictIds = state.destroyedDistrictIds instanceof Set
    ? state.destroyedDistrictIds
    : new Set(Array.isArray(state.destroyedDistrictIds) ? state.destroyedDistrictIds.map(Number) : []);
  if (destroyedDistrictIds.has(districtId)) {
    return "Nikdo";
  }

  if (typeof options.resolveOwnerLabel === "function") {
    return options.resolveOwnerLabel(district, state);
  }

  const ownedDistrictIds = state.ownedDistrictIds instanceof Set
    ? state.ownedDistrictIds
    : new Set(Array.isArray(state.ownedDistrictIds) ? state.ownedDistrictIds.map(Number) : []);
  if (ownedDistrictIds.has(districtId)) {
    return options.currentPlayerLabel || "TY";
  }

  const launchOwnerId = state.launchOwnerByDistrictId?.get?.(districtId);
  if (launchOwnerId) {
    return typeof options.getLaunchPlayerName === "function"
      ? options.getLaunchPlayerName(launchOwnerId)
      : `P${launchOwnerId}`;
  }

  return "Neobsazeno";
}

export function getDistrictFallbacks(district = {}) {
  return {
    id: Number(district?.id || 0) || null,
    title: getDistrictDisplayName(district),
    typeLabel: String(district?.districtType || "").trim() || "District",
    ownerLabel: "Neobsazeno"
  };
}

export function buildDistrictOwnerViewModel(district = {}, state = {}, options = {}) {
  const safeState = state || {};
  const districtId = Number(district?.id || 0);
  const launchOwnerId = safeState.gamePhase === "launch" ? safeState.launchOwnerByDistrictId?.get?.(districtId) : null;
  const ownerLabel = getDistrictOwnerLabel(district, safeState, options);
  const isCurrentPlayer = Number(launchOwnerId) === Number(options.currentPlayerId);
  return {
    ownerLabel,
    launchOwnerId: launchOwnerId || null,
    ownerAvatarSrc: launchOwnerId && typeof options.getLaunchPlayerAvatar === "function"
      ? options.getLaunchPlayerAvatar(launchOwnerId)
      : "",
    ownerFactionId: launchOwnerId && typeof options.getLaunchPlayerFactionId === "function"
      ? options.getLaunchPlayerFactionId(launchOwnerId)
      : null,
    isCurrentPlayer
  };
}

export function buildDistrictHeatViewModel(district = {}, state = {}, options = {}) {
  const snapshot = typeof options.getEconomySnapshot === "function"
    ? options.getEconomySnapshot(district)
    : {};
  return {
    income: Number(snapshot.totalHourlyIncome || 0),
    heat: Number(snapshot.passiveHeatPerDay || 0),
    influence: Number(snapshot.totalInfluencePerHour || 0)
  };
}

export function buildSelectedDistrictSummaryViewModel(district = {}, state = {}, options = {}) {
  const districtId = Number(district?.id || 0);
  const destroyedDistrictIds = state.destroyedDistrictIds instanceof Set
    ? state.destroyedDistrictIds
    : new Set(Array.isArray(state.destroyedDistrictIds) ? state.destroyedDistrictIds.map(Number) : []);
  const isDestroyed = destroyedDistrictIds.has(districtId);
  const atmosphereMeta = options.atmosphereMeta || {};
  const ownerView = buildDistrictOwnerViewModel(district, state, options);
  const factionCatalog = options.factionCatalog || {};
  const ownerFactionLabel = ownerView.ownerFactionId && factionCatalog[ownerView.ownerFactionId]
    ? factionCatalog[ownerView.ownerFactionId].name
    : "Bez frakce";

  return {
    title: getDistrictDisplayName(district),
    typeLabel: isDestroyed ? "Totálně zničený district" : (atmosphereMeta.shortLabel || getDistrictZoneLabel(district, options)),
    ownerLabel: isDestroyed ? "Nikdo" : ownerView.ownerLabel,
    ownerMeta: isDestroyed
      ? "Nikdo (zničený) · district je nepoužitelný"
      : ownerView.launchOwnerId
        ? `${ownerFactionLabel} · ${ownerView.isCurrentPlayer ? "Tvůj profil" : `Hráč ${ownerView.launchOwnerId}`}`
        : "Bez aktivního vlastníka",
    ownerAvatarSrc: isDestroyed ? "" : ownerView.ownerAvatarSrc,
    ownerAvatarEmpty: isDestroyed || !ownerView.ownerAvatarSrc,
    ownerFallback: isDestroyed ? "×" : ownerView.ownerLabel,
    ownerAvatarBackgroundUrl: !isDestroyed && ownerView.ownerAvatarSrc ? ownerView.ownerAvatarSrc : ""
  };
}

export function buildDistrictActionViewModel(district = {}, playerState = {}, options = {}) {
  const activePoliceAction = playerState.activePoliceAction || null;
  const resolvedActions = Array.isArray(playerState.resolvedActions) ? playerState.resolvedActions : [];
  const trapControlState = playerState.trapControlState || {};
  const normalizeReason = typeof options.normalizeReason === "function" ? options.normalizeReason : (reason) => String(reason || "");
  const hasEnabledDistrictAction = resolvedActions.some((action) => action?.enabled);

  return {
    hidden: !activePoliceAction && !hasEnabledDistrictAction,
    headHidden: hasEnabledDistrictAction,
    policeMessage: activePoliceAction
      ? "District je právě pod policejní akcí. Detail zásahu je otevřený v policejním okně."
      : "",
    actions: activePoliceAction
      ? []
      : resolvedActions.map((action = {}) => {
          if (action.id !== "trap") {
            return {
              id: action.id,
              label: action.label,
              enabled: action.enabled,
              title: action.reason || "",
              reason: action.reason ? normalizeReason(action.reason) : ""
            };
          }

          const actionReason = trapControlState.title || action.reason || "";
          return {
            id: action.id,
            label: trapControlState.label || action.label,
            enabled: !trapControlState.buttonDisabled,
            stacked: true,
            trapState: trapControlState.isActiveHere
              ? "active"
              : trapControlState.moveLocked
                ? "cooldown"
                : trapControlState.hasTrapElsewhere
                  ? "move"
                  : "idle",
            subtitle: trapControlState.subtitle || "",
            title: trapControlState.title || "",
            reason: actionReason ? normalizeReason(actionReason) : ""
          };
        })
  };
}

export function buildDistrictViewModel(district = {}, state = {}, options = {}) {
  const fallbacks = getDistrictFallbacks(district);
  return {
    ...fallbacks,
    displayName: fallbacks.title,
    zoneLabel: getDistrictZoneLabel(district, options),
    owner: buildDistrictOwnerViewModel(district, state, options),
    heat: buildDistrictHeatViewModel(district, state, options)
  };
}
