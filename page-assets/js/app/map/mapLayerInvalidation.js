export const MAP_RENDER_LAYERS = Object.freeze({
  static: "static",
  state: "state",
  selection: "selection",
  effects: "effects",
  hover: "hover"
});

export const ALL_MAP_RENDER_LAYERS = Object.freeze(Object.values(MAP_RENDER_LAYERS));

export const createGameplaySliceMapFingerprints = (gameplaySlice = null) => {
  const districts = Array.isArray(gameplaySlice?.districts)
    ? gameplaySlice.districts.map((district) => ({
        districtId: district?.districtId || "",
        ownerPlayerId: district?.ownerPlayerId || "",
        ownerColor: district?.ownerColor || "",
        name: district?.name || "",
        zone: district?.zone || "",
        status: district?.status || "",
        heat: Number(district?.heat || 0),
        influence: Number(district?.influence || 0),
        defense: district?.defense || null,
        protection: district?.protection || null,
        allianceId: district?.allianceId || null,
        buildingState: Array.isArray(district?.buildings)
          ? district.buildings.map((building) => [
              building?.buildingId || building?.buildingTypeId || "",
              building?.status || "",
              Number(building?.level || 0)
            ])
          : []
      }))
    : [];

  return {
    static: JSON.stringify({
      phase: gameplaySlice?.player?.dayNight?.uiThemeHint
        || gameplaySlice?.dayNight?.uiThemeHint
        || ""
    }),
    state: JSON.stringify({
      districts,
      playerColor: gameplaySlice?.player?.color || "",
      factionId: gameplaySlice?.player?.factionId || "",
      police: gameplaySlice?.player?.police || gameplaySlice?.police || null,
      alliance: gameplaySlice?.player?.alliance || null,
      bounty: gameplaySlice?.player?.bounty || gameplaySlice?.bounty || null
    }),
    selection: String(
      gameplaySlice?.district?.districtId
      || gameplaySlice?.server?.selectedDistrictId
      || ""
    ),
    effects: JSON.stringify({
      reports: Array.isArray(gameplaySlice?.reports)
        ? gameplaySlice.reports.map((report) => [
            report?.reportId || report?.id || "",
            report?.type || "",
            report?.districtId || "",
            report?.status || "",
            report?.expiresAt || null
          ])
        : [],
      declaredEffects: [
        ...(Array.isArray(gameplaySlice?.mapEffects) ? gameplaySlice.mapEffects : []),
        ...(Array.isArray(gameplaySlice?.activeMapEffects) ? gameplaySlice.activeMapEffects : [])
      ].map((effect) => [
        effect?.id || effect?.effectId || "",
        effect?.type || effect?.kind || effect?.actionType || "",
        effect?.districtId || effect?.targetDistrictId || "",
        effect?.status || "",
        effect?.startedAt || effect?.createdAt || null,
        effect?.expiresAt || effect?.resolveAt || null
      ]),
      police: gameplaySlice?.player?.police || gameplaySlice?.police || null
    })
  };
};

export const diffGameplaySliceMapLayers = (previous, next) => {
  if (!previous) return [...ALL_MAP_RENDER_LAYERS];
  return [
    previous.static !== next.static ? MAP_RENDER_LAYERS.static : null,
    previous.state !== next.state ? MAP_RENDER_LAYERS.state : null,
    previous.selection !== next.selection ? MAP_RENDER_LAYERS.selection : null,
    previous.effects !== next.effects ? MAP_RENDER_LAYERS.effects : null
  ].filter(Boolean);
};

export const resolveMapRenderLayers = (reason = "") => {
  const normalized = String(reason || "").toLowerCase();
  if (normalized.includes("resize") || normalized.includes("initial") || normalized.includes("asset:")) {
    return [...ALL_MAP_RENDER_LAYERS];
  }
  if (normalized.includes("phase") || normalized.includes("performance-mode")) {
    return [MAP_RENDER_LAYERS.static, MAP_RENDER_LAYERS.state, MAP_RENDER_LAYERS.selection, MAP_RENDER_LAYERS.effects];
  }
  if (normalized.includes("selection") || normalized.includes("district-open") || normalized.includes("district-close")) {
    return [MAP_RENDER_LAYERS.selection];
  }
  if (normalized.includes("police") || normalized.includes("mission") || normalized.includes("effect")) {
    return [MAP_RENDER_LAYERS.state, MAP_RENDER_LAYERS.effects];
  }
  if (normalized.includes("hover")) {
    return [MAP_RENDER_LAYERS.hover];
  }
  if (normalized.includes("visibility")) {
    return [MAP_RENDER_LAYERS.selection, MAP_RENDER_LAYERS.effects, MAP_RENDER_LAYERS.hover];
  }
  if (
    normalized.includes("countdown")
    || normalized.includes("cash")
    || normalized.includes("topbar")
    || normalized.includes("panel")
    || normalized.includes("modal")
  ) {
    return [];
  }
  return [MAP_RENDER_LAYERS.state, MAP_RENDER_LAYERS.selection];
};
