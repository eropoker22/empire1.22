export function createAllianceInviteResponseEligibility({
  invite = null,
  currentPlayerId = "",
  activeAlliance = null
} = {}) {
  const ownedByCurrentPlayer = Boolean(
    invite?.inviteId
    && String(invite.targetPlayerId || "") === String(currentPlayerId || "")
  );
  const isMemberInvite = String(invite?.kind || "member") === "member";
  const isAllianceManager = activeAlliance?.currentPlayerRole === "leader";
  const canRespond = ownedByCurrentPlayer && (isMemberInvite || isAllianceManager);

  return {
    canRespond,
    disabledReason: canRespond
      ? null
      : !ownedByCurrentPlayer
        ? "Pozvánka patří jinému hráči."
        : "Kontaktní pozvánku může potvrdit pouze leader aliance."
  };
}

export function resolveAllianceInviteDraftTargetPlayerId({
  draft = null,
  allianceId = "",
  canInvite = false,
  inviteTargets = []
} = {}) {
  const normalizedAllianceId = String(allianceId || "");
  const targetPlayerId = String(draft?.targetPlayerId || "");
  if (!canInvite || !normalizedAllianceId || draft?.allianceId !== normalizedAllianceId || !targetPlayerId) {
    return "";
  }
  const selectedTarget = inviteTargets.find((target) => (
    String(target?.playerId || "") === targetPlayerId && target?.canInvite !== false
  ));
  return selectedTarget ? targetPlayerId : "";
}
