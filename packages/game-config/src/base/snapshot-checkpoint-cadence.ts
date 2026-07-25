export const SNAPSHOT_CHECKPOINT_CADENCE_MS = 5 * 60 * 1000;

export const resolveSnapshotCheckpointIntervalTicks = (
  tickRateMs: number
): number => {
  if (!Number.isFinite(tickRateMs) || tickRateMs <= 0) {
    throw new Error("Snapshot checkpoint cadence requires a positive tick rate.");
  }
  return Math.max(1, Math.ceil(SNAPSHOT_CHECKPOINT_CADENCE_MS / tickRateMs));
};
