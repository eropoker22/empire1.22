/**
 * Responsibility: Pure time helpers used by the server-side core.
 * Belongs here: deterministic timestamp/tick conversion helpers.
 * Does not belong here: scheduler implementations or wall-clock APIs.
 */
export const ticksToMs = (ticks: number, tickRateMs: number): number => ticks * tickRateMs;

