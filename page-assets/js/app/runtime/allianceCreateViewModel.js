export const ALLIANCE_CREATE_REQUIRED_INFLUENCE = 40;

export function createAllianceCreateEligibility({
  board = null,
  localDemo = false,
  localDemoInfluence = 0
} = {}) {
  const hasLocalDemoInfluence = Math.max(0, Number(localDemoInfluence || 0))
    >= ALLIANCE_CREATE_REQUIRED_INFLUENCE;
  const canCreate = board?.canCreateAlliance === true
    && (!localDemo || hasLocalDemoInfluence);
  const disabledReason = canCreate
    ? null
    : localDemo && !hasLocalDemoInfluence
      ? "ALLIANCE_CREATE_INSUFFICIENT_INFLUENCE"
      : board?.createDisabledReason || "not_available";

  return {
    canCreate,
    disabledReason,
    showInfluenceRequirement: disabledReason === "ALLIANCE_CREATE_INSUFFICIENT_INFLUENCE"
  };
}
