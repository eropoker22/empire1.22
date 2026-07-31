/**
 * Responsibility: Per-instance scheduler state used by the runtime manager.
 * Belongs here: timer metadata and running flags for one instance.
 * Does not belong here: authoritative game state or gameplay resolution logic.
 */
export interface InstanceScheduler {
  tickRateMs: number;
  isRunning: boolean;
  tickInProgress: boolean;
  lastTickAtMs: number | null;
}

export const createInstanceScheduler = (tickRateMs: number): InstanceScheduler => ({
  tickRateMs,
  isRunning: false,
  tickInProgress: false,
  lastTickAtMs: null
});

export const isInstanceTickDue = (
  scheduler: InstanceScheduler,
  now: Date
): boolean => scheduler.lastTickAtMs === null
  || now.getTime() - scheduler.lastTickAtMs >= scheduler.tickRateMs;

export const recordInstanceTickCompletedAt = (
  scheduler: InstanceScheduler,
  now: Date
): void => {
  const nowMs = now.getTime();
  const previousTickAtMs = scheduler.lastTickAtMs;
  const tickRateMs = Math.max(1, Math.floor(scheduler.tickRateMs));
  scheduler.lastTickAtMs = previousTickAtMs === null || nowMs < previousTickAtMs
    ? nowMs
    : Math.min(nowMs, previousTickAtMs + tickRateMs);
};
