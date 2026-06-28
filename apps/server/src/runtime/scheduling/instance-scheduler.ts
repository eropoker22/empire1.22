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
