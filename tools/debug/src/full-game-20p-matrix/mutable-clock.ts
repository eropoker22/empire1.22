import type { Clock } from "../../../../apps/server/src/runtime/scheduling/clock";

export interface MutableSimulationClock extends Clock {
  advance(ms: number): void;
}

export const createMutableSimulationClock = (startAt: string): MutableSimulationClock => {
  let current = Date.parse(startAt);
  if (!Number.isFinite(current)) throw new Error(`Invalid simulation start time: ${startAt}`);
  return {
    now: () => new Date(current),
    nowIso: () => new Date(current).toISOString(),
    advance: (ms) => { current += ms; }
  };
};
