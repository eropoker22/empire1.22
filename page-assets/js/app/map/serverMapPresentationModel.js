import { createGameplaySliceMapFingerprints } from "./mapLayerInvalidation.js";
import { resolveLegacyDistrictId } from "./mapGeometry.js";

const EFFECT_TYPES = Object.freeze({
  spy: "spy",
  police: "police",
  attack: "attack",
  occupy: "occupy",
  robbery: "robbery",
  rob: "robbery",
  trap: "trap"
});

const createEmptyEffectState = () => ({
  activeSpyDistrictIds: new Set(),
  activeSpyMarkersByDistrictId: new Map(),
  activePoliceDistrictIds: new Set(),
  activePoliceMarkersByDistrictId: new Map(),
  activeAttackDistrictIds: new Set(),
  activeAttackMarkersByDistrictId: new Map(),
  activeOccupyDistrictIds: new Set(),
  activeOccupyMarkersByDistrictId: new Map(),
  activeOccupyCountdownByDistrictId: new Map(),
  activeRobberyDistrictIds: new Set(),
  activeRobberyMarkersByDistrictId: new Map(),
  activeTrapDistrictIds: new Set()
});

export const resolveServerMapDistrictId = (value) => {
  const normalizedValue = String(value ?? "").trim();
  const legacyId = /^\d+$/u.test(normalizedValue)
    ? Number(normalizedValue)
    : Number(resolveLegacyDistrictId(normalizedValue));
  return Number.isFinite(legacyId) && legacyId > 0 ? legacyId : null;
};

const resolvePhase = (gameplaySlice) => {
  const phase = String(
    gameplaySlice?.player?.dayNight?.uiThemeHint
    || gameplaySlice?.dayNight?.uiThemeHint
    || "day"
  ).toLowerCase();
  return phase === "night" ? "night" : "day";
};

const resolveGamePhase = (gameplaySlice) => {
  const phase = String(
    gameplaySlice?.gamePhase
    || gameplaySlice?.player?.finalLockdown?.status
    || ""
  ).trim().toLowerCase().replace(/-/gu, "_");
  if (phase === "final_lockdown" || phase === "active" || phase === "paused") return "final_lockdown";
  if (phase === "resolved" || phase === "completed") return "resolved";
  return "live";
};

const normalizeTimestamp = (value, fallback) => {
  if (Number.isFinite(Number(value))) return Number(value);
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const addEffect = (state, effect, now) => {
  const districtId = resolveServerMapDistrictId(
    effect?.districtId
    || effect?.targetDistrictId
    || effect?.selectedDistrictId
  );
  const type = EFFECT_TYPES[String(effect?.type || effect?.kind || effect?.actionType || "")
    .toLowerCase()
    .replace(/-district$/u, "")
    .replace(/^police-raid$/u, "police")];
  if (!districtId || !type) return;

  const marker = {
    seed: Number(effect?.seed || districtId),
    source: effect?.source || effect?.status || type,
    playerId: String(effect?.playerId || effect?.attackerPlayerId || ""),
    playerColor: String(effect?.playerColor || ""),
    startedAt: normalizeTimestamp(effect?.startedAt || effect?.createdAt, now),
    expiresAt: normalizeTimestamp(effect?.expiresAt || effect?.resolveAt, Number.POSITIVE_INFINITY)
  };

  if (type === "spy") {
    state.activeSpyDistrictIds.add(districtId);
    state.activeSpyMarkersByDistrictId.set(districtId, marker);
  } else if (type === "police") {
    state.activePoliceDistrictIds.add(districtId);
    state.activePoliceMarkersByDistrictId.set(districtId, marker);
  } else if (type === "attack") {
    state.activeAttackDistrictIds.add(districtId);
    state.activeAttackMarkersByDistrictId.set(districtId, marker);
  } else if (type === "occupy") {
    state.activeOccupyDistrictIds.add(districtId);
    state.activeOccupyMarkersByDistrictId.set(districtId, marker);
    state.activeOccupyCountdownByDistrictId.set(
      districtId,
      Number.isFinite(marker.expiresAt) ? Math.max(0, Math.ceil((marker.expiresAt - now) / 1000)) : 0
    );
  } else if (type === "robbery") {
    state.activeRobberyDistrictIds.add(districtId);
    state.activeRobberyMarkersByDistrictId.set(districtId, marker);
  } else if (type === "trap") {
    state.activeTrapDistrictIds.add(districtId);
  }
};

const createEffectState = (gameplaySlice, now, currentPlayerId) => {
  const state = createEmptyEffectState();
  const declaredEffects = [
    ...(Array.isArray(gameplaySlice?.mapEffects) ? gameplaySlice.mapEffects : []),
    ...(Array.isArray(gameplaySlice?.activeMapEffects) ? gameplaySlice.activeMapEffects : [])
  ];
  declaredEffects.forEach((effect) => {
    const type = EFFECT_TYPES[String(effect?.type || effect?.kind || effect?.actionType || "")
      .toLowerCase()
      .replace(/-district$/u, "")
      .replace(/^police-raid$/u, "police")];
    const effectPlayerId = String(effect?.playerId || effect?.attackerPlayerId || "");
    if ((type === "spy" || type === "robbery") && effectPlayerId !== currentPlayerId) return;
    addEffect(state, effect, now);
  });

  const activeRaid = gameplaySlice?.player?.police?.activeRaid || gameplaySlice?.police?.activeRaid;
  if (activeRaid?.districtId) addEffect(state, { ...activeRaid, type: "police" }, now);

  for (const report of Array.isArray(gameplaySlice?.reports) ? gameplaySlice.reports : []) {
    if (!report?.expiresAt && !report?.resolveAt) continue;
    addEffect(state, {
      ...report,
      playerId: report?.playerId || report?.attackerPlayerId || currentPlayerId
    }, now);
  }
  return state;
};

export function createServerMapPresentationModel(gameplaySlice = null, options = {}) {
  if (!gameplaySlice || typeof gameplaySlice !== "object") return null;
  const nowValue = typeof options.now === "function" ? options.now() : options.now;
  const now = Number(nowValue ?? Date.now());
  const currentPlayerId = String(gameplaySlice?.player?.playerId || "");
  const districts = Array.isArray(gameplaySlice?.districts) ? gameplaySlice.districts : [];
  const districtById = new Map();
  const rawDistrictIdById = new Map();
  const districtOwnerById = {};
  const ownerColorByPlayerId = new Map();
  const occupiedDistrictIds = new Set();
  const ownedDistrictIds = new Set();
  const revealedDistrictIds = new Set();
  const destroyedDistrictIds = new Set();

  for (const district of districts) {
    const districtId = resolveServerMapDistrictId(district?.districtId);
    if (!districtId) continue;
    districtById.set(districtId, district);
    rawDistrictIdById.set(districtId, district.districtId);
    if (district.status === "destroyed") {
      destroyedDistrictIds.add(districtId);
      continue;
    }
    if (district.ownerPlayerId) {
      const ownerId = String(district.ownerPlayerId);
      districtOwnerById[districtId] = ownerId;
      occupiedDistrictIds.add(districtId);
      if (district.ownerColor) ownerColorByPlayerId.set(ownerId, district.ownerColor);
    }
    if (district.isOwnedByPlayer || district.ownerPlayerId === currentPlayerId) {
      ownedDistrictIds.add(districtId);
    }
    if (district.intelKnown === true) {
      revealedDistrictIds.add(districtId);
    }
  }

  if (currentPlayerId && gameplaySlice?.player?.color) {
    ownerColorByPlayerId.set(currentPlayerId, gameplaySlice.player.color);
  }

  const selectedDistrictId = resolveServerMapDistrictId(
    gameplaySlice?.district?.districtId
    || gameplaySlice?.server?.selectedDistrictId
  );

  return {
    gameplaySlice,
    fingerprints: createGameplaySliceMapFingerprints(gameplaySlice),
    manifestKey: [
      gameplaySlice?.server?.mapManifestId || "",
      gameplaySlice?.server?.mapManifestVersion || "",
      gameplaySlice?.server?.mapManifestHash || ""
    ].join(":"),
    currentPlayerId,
    playerColor: gameplaySlice?.player?.color || "#67e1ff",
    factionId: gameplaySlice?.player?.factionId || "",
    phase: resolvePhase(gameplaySlice),
    gamePhase: resolveGamePhase(gameplaySlice),
    selectedDistrictId,
    districtById,
    rawDistrictIdById,
    districtOwnerById,
    ownerColorByPlayerId,
    occupiedDistrictIds,
    ownedDistrictIds,
    revealedDistrictIds,
    destroyedDistrictIds,
    effects: createEffectState(gameplaySlice, now, currentPlayerId)
  };
}
