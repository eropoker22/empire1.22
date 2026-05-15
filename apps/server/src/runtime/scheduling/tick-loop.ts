import type { TickOrchestrator } from "../orchestration/tick-orchestrator";

export interface TimerDriver {
  setInterval(callback: () => void, intervalMs: number): unknown;
  clearInterval(handle: unknown): void;
}

export interface TickLoop {
  start(): void;
  stop(): void;
  isRunning(): boolean;
}

export interface TickLoopOptions {
  tickOrchestrator: Pick<TickOrchestrator, "tickActiveInstances"> | {
    tickActiveInstances(): void | Promise<void>;
  };
  intervalMs: number;
  timerDriver?: TimerDriver;
}

const systemTimerDriver: TimerDriver = {
  setInterval: (callback, intervalMs) => globalThis.setInterval(callback, intervalMs),
  clearInterval: (handle) => globalThis.clearInterval(handle as ReturnType<typeof globalThis.setInterval>)
};

/**
 * Responsibility: explicit timer loop for authoritative instance ticks.
 * Belongs here: start/stop timer ownership and overlap protection.
 * Does not belong here: gameplay rules, persistence, or websocket fanout.
 */
export const createTickLoop = ({
  tickOrchestrator,
  intervalMs,
  timerDriver = systemTimerDriver
}: TickLoopOptions): TickLoop => {
  const safeIntervalMs = Math.max(1, Math.floor(intervalMs));
  let intervalHandle: unknown | null = null;
  let tickInProgress = false;

  const runScheduledTick = (): void => {
    if (tickInProgress) {
      return;
    }

    tickInProgress = true;

    try {
      const result = tickOrchestrator.tickActiveInstances();
      if (isPromiseLike(result)) {
        void Promise.resolve(result)
          .catch(() => undefined)
          .finally(() => {
            tickInProgress = false;
          });
        return;
      }
    } catch (_error) {
      // Instance-level crashes are handled by runInstanceTick; keep the loop alive.
    }

    tickInProgress = false;
  };

  return {
    start: () => {
      if (intervalHandle !== null) {
        return;
      }
      intervalHandle = timerDriver.setInterval(runScheduledTick, safeIntervalMs);
    },
    stop: () => {
      if (intervalHandle === null) {
        return;
      }
      timerDriver.clearInterval(intervalHandle);
      intervalHandle = null;
    },
    isRunning: () => intervalHandle !== null
  };
};

const isPromiseLike = (value: unknown): value is Promise<void> =>
  typeof (value as { then?: unknown } | null)?.then === "function";
