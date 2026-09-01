export const ELIMINATION_WARNING_MILESTONES_MS = Object.freeze([
  (7 * 60 + 59) * 60_000,
  4 * 60 * 60_000,
  60 * 60_000,
  15 * 60_000,
  5 * 60_000
]);

const finiteNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  return Number.isFinite(Number(value)) ? Number(value) : null;
};

export function resolveAuthoritativeEliminationCountdown(gameplaySlice = null, nowMs = Date.now()) {
  const source = gameplaySlice?.elimination || gameplaySlice?.player?.elimination || null;
  if (!source || typeof source !== "object") return unavailable("loading");
  if (source.enabled !== true) return unavailable(source.enabled === false ? "disabled" : "loading");
  if (source.eliminationsStopped === true) return unavailable("stopped", { stopped: true });

  const tickRateMs = finiteNumber(gameplaySlice?.mode?.tickRateMs);
  const currentTick = finiteNumber(gameplaySlice?.server?.currentTick);
  const generatedAtMs = Date.parse(String(gameplaySlice?.server?.generatedAt || ""));
  const isQuietHours = source.isQuietHoursNow === true;
  const deadlineTick = finiteNumber(isQuietHours ? source.quietHoursResumeTick : source.nextEliminationTick);
  const fallbackRemainingTicks = finiteNumber(source.ticksUntilNextElimination);
  const remainingTicks = deadlineTick !== null && currentTick !== null
    ? Math.max(0, deadlineTick - currentTick)
    : fallbackRemainingTicks === null ? null : Math.max(0, fallbackRemainingTicks);

  if (tickRateMs === null || tickRateMs <= 0 || remainingTicks === null || !Number.isFinite(generatedAtMs)) {
    return unavailable("loading", { isQuietHours, deadlineTick });
  }

  const safeNowMs = finiteNumber(nowMs) ?? generatedAtMs;
  const remainingAtSnapshotMs = remainingTicks * tickRateMs;
  const elapsedSinceSnapshotMs = Math.max(0, safeNowMs - generatedAtMs);
  const remainingMs = Math.max(0, Math.ceil(remainingAtSnapshotMs - elapsedSinceSnapshotMs));
  const deadlineMs = generatedAtMs + remainingAtSnapshotMs;
  const serverInstanceId = String(gameplaySlice?.server?.serverInstanceId || "server");

  return {
    state: remainingMs === 0 ? "evaluating" : isQuietHours ? "quiet_hours" : "counting",
    remainingMs,
    remainingAtSnapshotMs,
    elapsedSinceSnapshotMs,
    deadlineMs,
    deadlineTick,
    currentTick,
    tickRateMs,
    sourceGeneratedAtMs: generatedAtMs,
    isQuietHours,
    stopped: false,
    countdownKey: `${serverInstanceId}:${isQuietHours ? "quiet" : "purge"}:${deadlineTick ?? remainingTicks}`
  };
}

export function formatEliminationRemainingMs(remainingMs, options = {}) {
  const numeric = finiteNumber(remainingMs);
  if (numeric === null) return "—";
  const totalSeconds = Math.max(0, Math.ceil(numeric / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (options.compact === true) {
    if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
    if (totalSeconds >= 10 * 60) return `${minutes}m`;
    return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  }
  return hours > 0
    ? `${hours}h ${String(minutes).padStart(2, "0")}min ${String(seconds).padStart(2, "0")}s`
    : `${minutes}min ${String(seconds).padStart(2, "0")}s`;
}

export function resolveEliminationWarningMilestone(previousRemainingMs, remainingMs, initialCatchUpMs = 60_000) {
  const current = finiteNumber(remainingMs);
  if (current === null || current <= 0) return null;
  const previous = finiteNumber(previousRemainingMs);
  if (previous === null) {
    return ELIMINATION_WARNING_MILESTONES_MS.find((milestoneMs) => (
      current <= milestoneMs && milestoneMs - current <= Math.max(0, initialCatchUpMs)
    )) ?? null;
  }
  return ELIMINATION_WARNING_MILESTONES_MS.find((milestoneMs) => (
    previous > milestoneMs && current <= milestoneMs
  )) ?? null;
}

const unavailable = (state, overrides = {}) => ({
  state,
  remainingMs: null,
  remainingAtSnapshotMs: null,
  elapsedSinceSnapshotMs: null,
  deadlineMs: null,
  deadlineTick: null,
  currentTick: null,
  tickRateMs: null,
  sourceGeneratedAtMs: null,
  isQuietHours: false,
  stopped: false,
  countdownKey: null,
  ...overrides
});
