import { describe, expect, it, vi } from "vitest";
import {
  createHostedRuntimeWorkerRunLoop,
  shutdownHostedRuntimeWorker
} from "../../apps/server/src/bootstrap/hosted-runtime-worker-run-loop";

describe("hosted runtime worker run loop", () => {
  it("requests drain immediately and waits for the active run before refusing later runs", async () => {
    const gate = deferred<void>();
    const runOnce = vi.fn(async () => { await gate.promise; });
    const requestDrain = vi.fn();
    const runLoop = createHostedRuntimeWorkerRunLoop({ runOnce, requestDrain });

    const running = runLoop.runNow();
    await vi.waitFor(() => expect(runOnce).toHaveBeenCalledTimes(1));
    let drainFinished = false;
    const draining = runLoop.drain().then(() => { drainFinished = true; });

    expect(requestDrain).toHaveBeenCalledTimes(1);
    expect(drainFinished).toBe(false);
    await expect(runLoop.runNow()).resolves.toBeUndefined();
    expect(runOnce).toHaveBeenCalledTimes(1);

    gate.resolve();
    await running;
    await draining;
    expect(drainFinished).toBe(true);
    await runLoop.runNow();
    expect(runOnce).toHaveBeenCalledTimes(1);
  });

  it("stops the worker and closes persistence only after the active run drains", async () => {
    const gate = deferred<void>();
    const events: string[] = [];
    const runLoop = createHostedRuntimeWorkerRunLoop({
      runOnce: async () => { events.push("run:start"); await gate.promise; events.push("run:end"); },
      requestDrain: () => { events.push("drain:requested"); }
    });
    const running = runLoop.runNow();
    await vi.waitFor(() => expect(events).toContain("run:start"));

    const shutdown = shutdownHostedRuntimeWorker({
      drain: runLoop.drain,
      closeHealthServer: async () => { events.push("health:closed"); },
      stopWorker: async () => { events.push("worker:stopped"); },
      closePersistence: async () => { events.push("persistence:closed"); }
    });
    await vi.waitFor(() => expect(events).toContain("health:closed"));
    expect(events).toEqual(["run:start", "drain:requested", "health:closed"]);

    gate.resolve();
    await running;
    await shutdown;
    expect(events).toEqual([
      "run:start", "drain:requested", "health:closed", "run:end", "worker:stopped", "persistence:closed"
    ]);
  });
});

const deferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((complete) => { resolve = complete; });
  return { promise, resolve };
};
