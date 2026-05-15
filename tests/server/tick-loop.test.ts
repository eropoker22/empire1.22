import { describe, expect, it } from "vitest";
import { createServerApp } from "../../apps/server/src/app";
import {
  createFixedClock,
  createTickLoop,
  runInstanceTick,
  type TimerDriver
} from "../../apps/server/src/runtime/scheduling";

interface FakeInterval {
  id: number;
  callback: () => void;
  intervalMs: number;
}

class FakeTimerDriver implements TimerDriver {
  readonly intervals: FakeInterval[] = [];
  readonly clearedHandles: unknown[] = [];

  setInterval(callback: () => void, intervalMs: number): unknown {
    const interval = {
      id: this.intervals.length + 1,
      callback,
      intervalMs
    };
    this.intervals.push(interval);
    return interval;
  }

  clearInterval(handle: unknown): void {
    this.clearedHandles.push(handle);
  }

  fire(index = 0): void {
    this.intervals[index]?.callback();
  }
}

const flushMicrotasks = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

describe("server tick loop", () => {
  it("start schedules one interval and repeated start does not schedule another", () => {
    const timerDriver = new FakeTimerDriver();
    const loop = createTickLoop({
      tickOrchestrator: { tickActiveInstances: () => undefined },
      intervalMs: 5000,
      timerDriver
    });

    loop.start();
    loop.start();

    expect(loop.isRunning()).toBe(true);
    expect(timerDriver.intervals).toHaveLength(1);
    expect(timerDriver.intervals[0]?.intervalMs).toBe(5000);
  });

  it("stop clears the scheduled interval", () => {
    const timerDriver = new FakeTimerDriver();
    const loop = createTickLoop({
      tickOrchestrator: { tickActiveInstances: () => undefined },
      intervalMs: 5000,
      timerDriver
    });

    loop.start();
    loop.stop();
    loop.stop();

    expect(loop.isRunning()).toBe(false);
    expect(timerDriver.clearedHandles).toHaveLength(1);
    expect(timerDriver.clearedHandles[0]).toBe(timerDriver.intervals[0]);
  });

  it("tick callback calls tickActiveInstances and tolerates an empty instance registry", () => {
    const server = createServerApp();
    const timerDriver = new FakeTimerDriver();
    let calls = 0;
    const loop = createTickLoop({
      tickOrchestrator: {
        tickActiveInstances: () => {
          calls += 1;
          server.tickOrchestrator.tickActiveInstances();
        }
      },
      intervalMs: 5000,
      timerDriver
    });

    loop.start();

    expect(() => timerDriver.fire()).not.toThrow();
    expect(calls).toBe(1);
  });

  it("does not overlap scheduled ticks when the previous tick is still running", async () => {
    const timerDriver = new FakeTimerDriver();
    let calls = 0;
    let releaseTick!: () => void;
    const pendingTick = new Promise<void>((resolve) => {
      releaseTick = resolve;
    });
    const loop = createTickLoop({
      tickOrchestrator: {
        tickActiveInstances: () => {
          calls += 1;
          return pendingTick;
        }
      },
      intervalMs: 5000,
      timerDriver
    });

    loop.start();
    timerDriver.fire();
    timerDriver.fire();

    expect(calls).toBe(1);

    releaseTick();
    await flushMicrotasks();
    timerDriver.fire();

    expect(calls).toBe(2);
  });
});

describe("server instance tick runner", () => {
  it("does not tick when scheduler is not running", () => {
    const server = createServerApp();
    const runtime = server.instanceManager.createInstance("instance:tick:not-running", "free");
    const initialTick = runtime.state.root.tick;

    runInstanceTick(runtime, createFixedClock("2026-05-15T05:00:00.000Z"));

    expect(runtime.state.root.tick).toBe(initialTick);
    expect(runtime.runtimeHealth.lastTickStartedAt).toBeNull();
  });

  it("does not run a parallel tick when tickInProgress is already true", () => {
    const server = createServerApp();
    const runtime = server.instanceManager.createInstance("instance:tick:in-progress", "free");
    server.instanceManager.startInstance(runtime.record.id);
    runtime.scheduler.tickInProgress = true;
    const initialTick = runtime.state.root.tick;

    runInstanceTick(runtime, createFixedClock("2026-05-15T05:01:00.000Z"));

    expect(runtime.state.root.tick).toBe(initialTick);
    expect(runtime.scheduler.tickInProgress).toBe(true);
  });

  it("increments state tick and writes tick health timestamps through the injected clock", () => {
    const server = createServerApp();
    const runtime = server.instanceManager.createInstance("instance:tick:success", "free");
    server.instanceManager.startInstance(runtime.record.id);

    runInstanceTick(runtime, createFixedClock("2026-05-15T05:02:00.000Z"));

    expect(runtime.state.root.tick).toBe(1);
    expect(runtime.runtimeHealth.lastTickStartedAt).toBe("2026-05-15T05:02:00.000Z");
    expect(runtime.runtimeHealth.lastTickCompletedAt).toBe("2026-05-15T05:02:00.000Z");
    expect(runtime.scheduler.tickInProgress).toBe(false);
  });

  it("marks the instance crashed and stops scheduler when tick execution throws", () => {
    const server = createServerApp();
    const runtime = server.instanceManager.createInstance("instance:tick:crash", "free");
    server.instanceManager.startInstance(runtime.record.id);
    runtime.state = {
      ...runtime.state,
      root: null as unknown as typeof runtime.state.root
    };

    runInstanceTick(runtime, createFixedClock("2026-05-15T05:03:00.000Z"));

    expect(runtime.record.status).toBe("crashed");
    expect(runtime.record.crashCount).toBe(1);
    expect(runtime.scheduler.isRunning).toBe(false);
    expect(runtime.scheduler.tickInProgress).toBe(false);
    expect(runtime.runtimeHealth.lastErrorAt).toBe("2026-05-15T05:03:00.000Z");
  });
});
