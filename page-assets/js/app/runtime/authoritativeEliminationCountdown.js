import { readAuthoritativeSnapshotClock } from "../../../../packages/shared-types/src/views/authoritative-snapshot-clock.js";
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

export function resolveAuthoritativeEliminationCountdown(gameplaySlice = null, nowMs) {
  const source = gameplaySlice?.elimination || gameplaySlice?.player?.elimination || null;
  if (!source || typeof source !== "object") return unavailable("loading");
  const clock = readAuthoritativeSnapshotClock(gameplaySlice, nowMs);
  if (clock.state !== "running") return unavailable(clock.state);
  if (source.enabled !== true) return unavailable(source.enabled === false ? "disabled" : "loading");
  if (source.eliminationsStopped === true) return unavailable("stopped", { stopped: true });

  const tickRateMs = finiteNumber(gameplaySlice?.mode?.tickRateMs);
  const currentTick = finiteNumber(gameplaySlice?.server?.currentTick);
  const generatedAtMs = Date.parse(String(gameplaySlice?.server?.generatedAt || ""));
  const isQuietHours = source.isQuietHoursNow === true;
  const deadlineTick = finiteNumber(source.nextEliminationTick);
  const fallbackRemainingTicks = finiteNumber(source.ticksUntilNextElimination);
  const remainingTicks = deadlineTick !== null && currentTick !== null
    ? Math.max(0, deadlineTick - currentTick)
    : fallbackRemainingTicks === null ? null : Math.max(0, fallbackRemainingTicks);

  if (tickRateMs === null || tickRateMs <= 0 || remainingTicks === null || !Number.isFinite(generatedAtMs)) {
    return unavailable("loading", { isQuietHours, deadlineTick });
  }

  const remainingAtSnapshotMs = remainingTicks * tickRateMs;
  const elapsedSinceSnapshotMs = clock.elapsedMs;
  const remainingMs = Math.max(0, Math.ceil(remainingAtSnapshotMs - elapsedSinceSnapshotMs));
  const deadlineMs = (clock.serverNowMs ?? generatedAtMs) + remainingMs;
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

export function resolveAuthoritativeMatchCountdowns(gameplaySlice, nowMs) {
  const clock = readAuthoritativeSnapshotClock(gameplaySlice, nowMs);
  const elimination = gameplaySlice?.elimination || gameplaySlice?.player?.elimination;
  const final = gameplaySlice?.player?.finalLockdown;
  const rate = finiteNumber(gameplaySlice?.mode?.tickRateMs);
  const tick = finiteNumber(gameplaySlice?.server?.currentTick);
  const until = (deadline) => rate > 0 && tick !== null && finiteNumber(deadline) !== null && clock.state === "running"
    ? Math.max(0, (deadline - tick) * rate - clock.elapsedMs) : null;
  const quiet = elimination?.quietHoursWindow;
  const remaining = finiteNumber(final?.remainingActiveTicks);
  const activeElapsedMs = final?.pauseDuringQuietHours && !quiet?.active && quiet?.startTick != null && rate > 0 && tick !== null
    ? Math.min(clock.elapsedMs, Math.max(0, (quiet.startTick - tick) * rate)) : clock.elapsedMs;
  const finalActiveMs = final?.active && remaining !== null && rate > 0 && ["running", "paused"].includes(clock.state)
    ? Math.max(0, remaining * rate - (final.pausedByQuietHours || clock.state !== "running" ? 0 : activeElapsedMs)) : null;
  return { clockState: clock.state, elimination: resolveAuthoritativeEliminationCountdown(gameplaySlice, nowMs), finalActiveMs,
    quietRemainingMs: until(quiet?.active ? quiet.endTick : quiet?.startTick),
    earliestStartMs: until(final?.startConditions?.earliestStartTick),
    latestStartMs: until(final?.startConditions?.latestStartTick),
    untilTick: until };
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

export function resolveEliminationWarningMilestone(previousRemainingMs, remainingMs, initialCatchUpMs = 5 * 60_000) {
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
