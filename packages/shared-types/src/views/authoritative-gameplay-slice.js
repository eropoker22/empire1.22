const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);

export function selectAuthoritativePlayerHeat(source) {
  const police = hasOwn(source, "player")
    ? source?.player?.police
    : source?.police ?? source;
  if (!police || !hasOwn(police, "heat")) return null;
  if (police.heat === null || police.heat === undefined || police.heat === "") return null;
  const heat = Number(police.heat);
  return Number.isFinite(heat) ? Math.max(0, heat) : null;
}

export function getGameplaySliceStateVersion(model) {
  const version = Number(model?.server?.stateVersion);
  return Number.isSafeInteger(version) && version >= 0 ? version : null;
}

export function getGameplaySliceAuthorityScope(model) {
  const playerId = String(model?.player?.playerId || "").trim();
  const playerInstanceId = String(model?.player?.instanceId || "").trim();
  const serverInstanceId = String(model?.server?.serverInstanceId || playerInstanceId).trim();
  if (!playerId || !serverInstanceId || (playerInstanceId && playerInstanceId !== serverInstanceId)) {
    return null;
  }
  return `${serverInstanceId}:${playerId}`;
}

const mergePoliceProjection = (current, next, nextOwner) => {
  if (!hasOwn(nextOwner, "police")) return current;
  if (!next || typeof next !== "object") return current ?? next;
  const validNext = { ...next };
  if (hasOwn(validNext, "heat") && selectAuthoritativePlayerHeat(validNext) === null) {
    delete validNext.heat;
  }
  return current && typeof current === "object" ? { ...current, ...validNext } : validNext;
};

/**
 * Applies a full or partial authoritative gameplay slice without allowing an
 * older state version to overwrite a newer one. Missing police fields retain
 * their last authoritative value; an explicit heat value of 0 is preserved.
 */
export function mergeAuthoritativeGameplaySlice(current, next, options = {}) {
  if (!next || typeof next !== "object") {
    return { accepted: false, model: current || null, reason: "invalid-model" };
  }
  if (!current) return { accepted: true, model: next, reason: "initial" };

  const currentScope = getGameplaySliceAuthorityScope(current);
  const nextScope = getGameplaySliceAuthorityScope(next);
  if (currentScope && nextScope && currentScope !== nextScope) {
    return options.allowScopeChange === true
      ? { accepted: true, model: next, reason: "scope-change" }
      : { accepted: false, model: current, reason: "scope-mismatch" };
  }

  const currentVersion = getGameplaySliceStateVersion(current);
  const nextVersion = getGameplaySliceStateVersion(next);
  if (currentVersion !== null && nextVersion !== null && nextVersion < currentVersion) {
    return { accepted: false, model: current, reason: "stale-version" };
  }

  const nextPlayer = next.player && typeof next.player === "object"
    ? {
        ...(current.player || {}),
        ...next.player,
        police: mergePoliceProjection(current.player?.police, next.player.police, next.player)
      }
    : current.player;
  const model = {
    ...current,
    ...next,
    player: nextPlayer,
    police: mergePoliceProjection(current.police, next.police, next)
  };
  return { accepted: true, model, reason: "merged" };
}
