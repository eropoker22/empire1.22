const SERVER_MISSION_EFFECT_TYPES = new Set(["spy", "robbery", "heist", "attack", "occupy"]);

const parseTimestamp = (value) => {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  const parsed = new Date(value || 0).getTime();
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const createMissionIdentity = ({ type, playerId, districtId, expiresAtTick, expiresAt }) => [
  type,
  playerId,
  districtId,
  Number.isFinite(expiresAtTick) && expiresAtTick > 0
    ? `tick:${expiresAtTick}`
    : `time:${Math.round(expiresAt / 1000)}`
].join(":");

export function selectServerPendingMissionCooldowns(readModel, now = Date.now()) {
  const playerId = String(readModel?.player?.playerId || "").trim();
  if (!playerId) return [];

  const selected = new Map();
  for (const effect of Array.isArray(readModel?.mapEffects) ? readModel.mapEffects : []) {
    const type = String(effect?.type || "").trim().toLowerCase();
    const effectPlayerId = String(effect?.playerId || "").trim();
    const districtId = String(effect?.districtId || "").trim();
    const expiresAt = parseTimestamp(effect?.expiresAt);
    const expiresAtTick = Number(effect?.expiresAtTick);
    if (
      !SERVER_MISSION_EFFECT_TYPES.has(type)
      || effectPlayerId !== playerId
      || !districtId
      || !expiresAt
      || expiresAt <= now
    ) {
      continue;
    }

    const identity = createMissionIdentity({
      type,
      playerId: effectPlayerId,
      districtId,
      expiresAtTick,
      expiresAt
    });
    if (!selected.has(identity)) {
      selected.set(identity, {
        identity,
        effectId: String(effect?.effectId || identity),
        type,
        playerId: effectPlayerId,
        districtId,
        expiresAt,
        ...(Number.isFinite(expiresAtTick) ? { expiresAtTick } : {})
      });
    }
  }

  return Array.from(selected.values())
    .sort((left, right) => left.expiresAt - right.expiresAt);
}

export function dedupeStreetNewsCooldownEntries(entries = []) {
  const seenCooldowns = new Set();
  const seenIds = new Set();

  return (Array.isArray(entries) ? entries : []).filter((entry) => {
    const id = String(entry?.id || "");
    if (String(entry?.sourceKind || "") !== "cooldown") {
      if (id && seenIds.has(id)) return false;
      if (id) seenIds.add(id);
      return true;
    }

    const title = String(entry?.title || "").trim().toLowerCase();
    const summary = String(entry?.summary || "").trim().toLowerCase();
    const identity = `${title}::${summary || id}`;
    if (seenCooldowns.has(identity)) return false;
    seenCooldowns.add(identity);
    return true;
  });
}
