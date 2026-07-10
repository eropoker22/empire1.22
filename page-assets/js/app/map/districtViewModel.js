export function getDistrictDisplayName(district = {}) {
  const id = Number(district?.id || 0);
  return id > 0 ? `District ${id}` : "District";
}

export function getDistrictZoneLabel(district = {}, options = {}) {
  const typeKey = String(district?.districtType || "").trim();
  const meta = options.districtTypeMeta?.[typeKey] || options.districtTypeMeta?.resident || null;
  return meta?.shortLabel || meta?.label || typeKey || "District";
}

function normalizeDistrictIdSet(value) {
  if (value instanceof Set) {
    return new Set(Array.from(value).map(Number).filter(Boolean));
  }
  return new Set(Array.isArray(value) ? value.map(Number).filter(Boolean) : []);
}

export function isDistrictTypeKnown(district = {}, state = {}, options = {}) {
  const districtId = Number(district?.id || 0);
  if (!districtId) {
    return false;
  }

  if (typeof options.isDistrictTypeKnown === "function") {
    return Boolean(options.isDistrictTypeKnown(district, state));
  }

  if (typeof options.isDistrictTypeKnown === "boolean") {
    return options.isDistrictTypeKnown;
  }

  const destroyedDistrictIds = normalizeDistrictIdSet(state?.destroyedDistrictIds);
  if (destroyedDistrictIds.has(districtId)) {
    return true;
  }

  const ownedDistrictIds = normalizeDistrictIdSet(state?.ownedDistrictIds);
  if (ownedDistrictIds.has(districtId)) {
    return true;
  }

  const launchOwnerId = state?.launchOwnerByDistrictId?.get?.(districtId);
  if (launchOwnerId && Number(launchOwnerId) === Number(options.currentPlayerId)) {
    return true;
  }

  const revealedTypeDistrictIds = normalizeDistrictIdSet(
    options.spyIntel?.revealedTypeDistrictIds
      || state?.spyIntel?.revealedTypeDistrictIds
      || state?.missions?.spyIntel?.revealedTypeDistrictIds
  );
  return revealedTypeDistrictIds.has(districtId);
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
      : `Hráč ${launchOwnerId}`;
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
  const launchOwnerId = safeState.gamePhase === "launch" || safeState.gamePhase === "live"
    ? safeState.launchOwnerByDistrictId?.get?.(districtId)
    : null;
  const ownedDistrictIds = normalizeDistrictIdSet(safeState.ownedDistrictIds);
  const ownedByCurrentPlayer = ownedDistrictIds.has(districtId);
  const resolvedOwnerId = launchOwnerId || (ownedByCurrentPlayer ? options.currentPlayerId : null);
  const ownerLabel = getDistrictOwnerLabel(district, safeState, options);
  const isCurrentPlayer = Number(resolvedOwnerId) === Number(options.currentPlayerId);
  return {
    ownerLabel,
    launchOwnerId: resolvedOwnerId || null,
    ownerAvatarSrc: resolvedOwnerId && typeof options.getLaunchPlayerAvatar === "function"
      ? options.getLaunchPlayerAvatar(resolvedOwnerId)
      : "",
    ownerFactionId: resolvedOwnerId && typeof options.getLaunchPlayerFactionId === "function"
      ? options.getLaunchPlayerFactionId(resolvedOwnerId)
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
  const isTypeKnown = isDistrictTypeKnown(district, state, options);
  const hasPlayerOwner = Boolean(ownerView.launchOwnerId);
  const isOwnerAvatarHidden = !isDestroyed && !hasPlayerOwner && !isTypeKnown;
  const factionCatalog = options.factionCatalog || {};
  const ownerFactionLabel = ownerView.ownerFactionId && factionCatalog[ownerView.ownerFactionId]
    ? factionCatalog[ownerView.ownerFactionId].name
    : "Bez frakce";

  return {
    title: getDistrictDisplayName(district),
    typeLabel: isDestroyed
      ? "Totálně zničený district"
      : isTypeKnown
        ? (atmosphereMeta.shortLabel || getDistrictZoneLabel(district, options))
        : "Neznámý sektor",
    ownerLabel: isDestroyed ? "Nikdo" : ownerView.ownerLabel,
    ownerMeta: isDestroyed
      ? "Nikdo (zničený) · district je nepoužitelný"
      : ownerView.launchOwnerId
        ? `${ownerFactionLabel} · ${ownerView.isCurrentPlayer ? "Tvůj profil" : `Hráč ${ownerView.launchOwnerId}`}`
        : "Bez aktivního vlastníka",
    ownerAvatarSrc: isDestroyed || isOwnerAvatarHidden ? "" : ownerView.ownerAvatarSrc,
    ownerAvatarEmpty: isDestroyed || isOwnerAvatarHidden || !ownerView.ownerAvatarSrc,
    ownerAvatarHidden: isOwnerAvatarHidden,
    ownerFallback: isDestroyed ? "×" : "",
    ownerAvatarBackgroundUrl: !isDestroyed && !isOwnerAvatarHidden && ownerView.ownerAvatarSrc ? ownerView.ownerAvatarSrc : ""
  };
}

export function buildDistrictActionViewModel(district = {}, playerState = {}, options = {}) {
  const activePoliceAction = playerState.activePoliceAction || null;
  const resolvedActions = Array.isArray(playerState.resolvedActions) ? playerState.resolvedActions : [];
  const actionCountdowns = playerState.actionCountdowns || {};
  const trapControlState = playerState.trapControlState || {};
  const normalizeReason = typeof options.normalizeReason === "function" ? options.normalizeReason : (reason) => String(reason || "");
  const hasVisibleDistrictAction = resolvedActions.length > 0;
  const policeMessage = activePoliceAction
    ? "District je právě pod policejní akcí. Detail zásahu je otevřený v policejním okně."
    : "";
  const statusMessage = !activePoliceAction && playerState.statusMessage
    ? String(playerState.statusMessage)
    : "";
  const noticeMessage = !activePoliceAction && playerState.noticeMessage
    ? String(playerState.noticeMessage)
    : "";
  const hasStatusMessage = Boolean(policeMessage || statusMessage);
  const hasNoticeMessage = Boolean(noticeMessage);

  return {
    hidden: !hasStatusMessage && !hasNoticeMessage && !hasVisibleDistrictAction,
    headHidden: hasVisibleDistrictAction || hasStatusMessage,
    policeMessage,
    statusMessage,
    noticeMessage,
    actions: hasStatusMessage
      ? []
      : resolvedActions.map((action = {}) => {
          const countdown = actionCountdowns[action.id] || null;
          if (action.id !== "trap") {
            return {
              id: action.id,
              label: action.label,
              enabled: countdown ? false : action.enabled,
              stacked: Boolean(action.stacked),
              subtitle: action.subtitle || "",
              disabledTone: action.disabledTone || "",
              countdownLabel: countdown?.label || "",
              countdownEndsAt: countdown?.endsAt || null,
              title: action.title || action.reason || "",
              reason: action.reason ? normalizeReason(action.reason) : ""
            };
          }

          const actionReason = trapControlState.title || action.reason || "";
          return {
            id: action.id,
            label: trapControlState.label || action.label,
            enabled: countdown ? false : !trapControlState.buttonDisabled,
            stacked: true,
            trapState: trapControlState.isActiveHere
              ? "active"
              : trapControlState.moveLocked
                ? "cooldown"
                : trapControlState.hasTrapElsewhere
                  ? "move"
                  : "idle",
            subtitle: trapControlState.subtitle || "",
            countdownLabel: countdown?.label || "",
            countdownEndsAt: countdown?.endsAt || null,
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
