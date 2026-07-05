export function getBountyDisplayType(bounty) {
  const objectiveType = String(bounty?.objectiveType || "attack-player");
  if (objectiveType === "destroy-player-district" && String(bounty?.targetDistrictId || "").trim()) {
    return "destroy-selected-district";
  }
  return objectiveType;
}

export function getBountyDisplayLabel(bounty) {
  const displayType = getBountyDisplayType(bounty);
  if (displayType === "attack-district") {
    return "Obsadit district";
  }
  if (displayType === "destroy-selected-district") {
    return "Zničit vybraný district";
  }
  if (displayType === "destroy-player-district") {
    return "Zničit jakýkoli district";
  }
  return "Útok na hráče";
}

export function getBountyIconType(bounty) {
  return getBountyDisplayType(bounty);
}

export function getBountyDistrictLabel(bounty) {
  if (!String(bounty?.targetDistrictId || "").trim()) {
    return "—";
  }
  return String(bounty?.targetDistrictName || bounty?.targetDistrictId || "—").trim() || "—";
}

export function withBountyCountdownSnapshot(bounty, receivedAtMs = Date.now()) {
  return {
    ...bounty,
    _bountyReceivedAtMs: Number.isFinite(Number(receivedAtMs)) ? Number(receivedAtMs) : Date.now()
  };
}

export function getBountyRemainingMs(bounty, nowMs = Date.now()) {
  const now = Number.isFinite(Number(nowMs)) ? Number(nowMs) : Date.now();
  const expiresAt = String(bounty?.expiresAt || bounty?.expiresAtIso || "").trim();
  const expiresAtMs = expiresAt ? Date.parse(expiresAt) : Number.NaN;
  if (Number.isFinite(expiresAtMs)) {
    return Math.max(0, expiresAtMs - now);
  }

  const remainingMs = Math.max(0, Number(bounty?.remainingMs || 0));
  const receivedAtMs = Number.isFinite(Number(bounty?._bountyReceivedAtMs))
    ? Number(bounty._bountyReceivedAtMs)
    : now;
  return Math.max(0, remainingMs - Math.max(0, now - receivedAtMs));
}
