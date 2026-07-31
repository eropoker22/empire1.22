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
