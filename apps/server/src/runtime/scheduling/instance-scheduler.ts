/**
 * Responsibility: Per-instance scheduler state used by the runtime manager.
 * Belongs here: timer metadata and running flags for one instance.
 * Does not belong here: authoritative game state or gameplay resolution logic.
 */
export interface InstanceScheduler {
  tickRateMs: number;
  isRunning: boolean;
  tickInProgress: boolean;
}

export const createInstanceScheduler = (tickRateMs: number): InstanceScheduler => ({
  tickRateMs,
  isRunning: false,
  tickInProgress: false
});

