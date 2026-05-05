export function createLaunchPlayerRuntime(deps = {}) {
  let launchPlayerColorMap = null;
  let launchPlayerColorMapCurrentColor = null;

  const currentPlayerId = Number(deps.currentPlayerId || 0);
  const playerColors = Array.isArray(deps.playerColors) ? deps.playerColors : [];
  const playerNames = Array.isArray(deps.playerNames) ? deps.playerNames : [];
  const factionOrder = Array.isArray(deps.factionOrder) ? deps.factionOrder : [];
  const avatarByFactionId = deps.avatarByFactionId || {};
  const startPhaseOwnerByDistrictId = deps.startPhaseOwnerByDistrictId;

  const getCurrentPlayerGangColor = () => {
    const registration = deps.getStoredRegistration?.();
    return deps.normalizeRuntimeHexColor?.(registration?.gangColor)
      || deps.getRegistrationAccentColor?.(registration?.factionId || "mafian");
  };

  const getCurrentPlayerFactionGlyph = () => {
    const registration = deps.getStoredRegistration?.();
    return deps.getFactionGlyph?.(registration?.factionId || "mafian");
  };

  const getPlayerDistrictColor = (ownerId) => {
    const currentPlayerColor = deps.normalizeLaunchPlayerPaletteColor?.(getCurrentPlayerGangColor(), {
      normalizeHexColor: deps.normalizeRuntimeHexColor,
      playerColors
    }) || playerColors[0];

    if (!launchPlayerColorMap || launchPlayerColorMapCurrentColor !== currentPlayerColor) {
      launchPlayerColorMap = deps.createLaunchPlayerColorMap?.(currentPlayerColor, {
        currentPlayerId,
        playerColors
      });
      launchPlayerColorMapCurrentColor = currentPlayerColor;
    }

    const color = launchPlayerColorMap?.get?.(Number(ownerId));
    if (!color) {
      throw new Error(`No unique dev-only launch color is assigned for player ${ownerId}.`);
    }
    return color;
  };

  const getLaunchPlayerName = (ownerId) => (
    playerNames[(ownerId - 1) % playerNames.length] || `Player ${ownerId}`
  );

  const getLaunchPlayerFactionId = (ownerId) => {
    if (Number(ownerId) === currentPlayerId) {
      const registration = deps.getStoredRegistration?.();
      if (registration?.factionId) {
        return registration.factionId;
      }
    }

    return factionOrder[(Number(ownerId) - 1) % factionOrder.length] || "mafian";
  };

  const getLaunchPlayerAvatar = (ownerId) => {
    if (Number(ownerId) === currentPlayerId) {
      const registration = deps.getStoredRegistration?.();
      if (registration?.avatar) {
        return String(registration.avatar).trim();
      }

      const legacyAvatar = String(deps.getLegacyAvatar?.() || "").trim();
      if (legacyAvatar) {
        return legacyAvatar;
      }
    }

    const factionId = getLaunchPlayerFactionId(ownerId);
    return avatarByFactionId[factionId] || avatarByFactionId.mafian;
  };

  const getCurrentPlayerLaunchStartDistrictId = () => {
    for (const [districtId, ownerId] of startPhaseOwnerByDistrictId?.entries?.() || []) {
      if (Number(ownerId) === currentPlayerId) {
        return Number(districtId) || null;
      }
    }

    const fallbackOwnedDistrictIds = deps.getWorldState?.().ownedDistrictIds || [];
    return Number(fallbackOwnedDistrictIds[0] || 0) || null;
  };

  const getLaunchPlayerLabel = (ownerId) => (
    Number(ownerId) === currentPlayerId ? "TY" : `P${ownerId}`
  );

  const getEffectiveOwnedDistrictIds = (interactionState = {}) => {
    const ownedDistrictIds = new Set(interactionState.ownedDistrictIds || []);

    if ((interactionState.gamePhase || "launch") === "launch") {
      const launchOwnerByDistrictId = interactionState.launchOwnerByDistrictId || startPhaseOwnerByDistrictId;
      for (const districtId of launchOwnerByDistrictId?.keys?.() || []) {
        ownedDistrictIds.add(Number(districtId));
      }
    }

    return ownedDistrictIds;
  };

  const getCurrentPlayerOwnedDistrictIds = (interactionState = {}) => {
    const ownedDistrictIds = new Set(interactionState.ownedDistrictIds || []);

    if ((interactionState.gamePhase || "launch") === "launch") {
      const launchOwnerByDistrictId = interactionState.launchOwnerByDistrictId || startPhaseOwnerByDistrictId;
      for (const [districtId, ownerId] of launchOwnerByDistrictId?.entries?.() || []) {
        if (Number(ownerId) === currentPlayerId) {
          ownedDistrictIds.add(Number(districtId));
        }
      }
    }

    return ownedDistrictIds;
  };

  return {
    getCurrentPlayerFactionGlyph,
    getCurrentPlayerGangColor,
    getCurrentPlayerLaunchStartDistrictId,
    getCurrentPlayerOwnedDistrictIds,
    getEffectiveOwnedDistrictIds,
    getLaunchPlayerAvatar,
    getLaunchPlayerColor: getPlayerDistrictColor,
    getLaunchPlayerFactionId,
    getLaunchPlayerLabel,
    getLaunchPlayerName,
    getPlayerDistrictColor
  };
}

if (typeof window !== "undefined") {
  window.EmpireLaunchPlayerRuntime = {
    createLaunchPlayerRuntime
  };
}
