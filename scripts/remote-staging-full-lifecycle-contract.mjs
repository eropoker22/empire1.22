export const isLifecycleRegistrationSnapshotReady = (inspection, expected) => {
  if (!inspection || typeof inspection !== "object" || !expected || typeof expected !== "object") {
    return false;
  }
  return inspection.snapshotRegistrationClosed === true
    && inspection.snapshotRegistrationBaselinePlayers === expected.baselinePlayers
    && inspection.snapshotEffectiveFinalLockdownTrigger === expected.effectiveFinalLockdownTrigger
    && inspection.snapshotEffectiveFirstEliminationTick === expected.effectiveFirstEliminationTick;
};
