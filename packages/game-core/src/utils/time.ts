/**
 * Responsibility: Pure time helpers used by the server-side core.
 * Belongs here: deterministic timestamp/tick conversion helpers.
 * Does not belong here: scheduler implementations or wall-clock APIs.
 */
export const ticksToMs = (ticks: number, tickRateMs: number): number => ticks * tickRateMs;

const DEFAULT_PLAYER_TICK_RATE_MS = 10_000;

export const formatTickDuration = (
  ticks: number,
  tickRateMs = DEFAULT_PLAYER_TICK_RATE_MS
): string => {
  const totalSeconds = Math.max(
    0,
    Math.ceil(ticksToMs(Number(ticks) || 0, Math.max(1, Number(tickRateMs) || DEFAULT_PLAYER_TICK_RATE_MS)) / 1000)
  );
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  return `${seconds}s`;
};
