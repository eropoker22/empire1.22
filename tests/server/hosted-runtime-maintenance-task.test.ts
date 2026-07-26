import { describe, expect, it, vi } from "vitest";
import { createHostedRuntimeMaintenanceTask } from "../../apps/server/src/admin/hosted";

describe("hosted runtime maintenance task", () => {
  it("runs once without overlap and drains before shutdown completes", async () => {
    const entered = deferred<void>();
    const gate = deferred<void>();
    const run = vi.fn(async () => {
      entered.resolve();
      await gate.promise;
    });
    const task = createHostedRuntimeMaintenanceTask(run);

    expect(task.schedule("2026-07-26T12:00:00.000Z")).toBe(true);
    await entered.promise;
    expect(task.isRunning()).toBe(true);
    expect(task.schedule("2026-07-26T12:00:05.000Z")).toBe(false);

    let drained = false;
    const draining = task.drain().then(() => {
      drained = true;
    });
    expect(drained).toBe(false);
    expect(task.schedule("2026-07-26T12:00:10.000Z")).toBe(false);

    gate.resolve();
    await draining;
    expect(drained).toBe(true);
    expect(task.isRunning()).toBe(false);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("contains maintenance failures so gameplay scheduling remains independent", async () => {
    const task = createHostedRuntimeMaintenanceTask(async () => {
      throw new Error("Injected maintenance failure.");
    });

    expect(task.schedule("2026-07-26T12:00:00.000Z")).toBe(true);
    await expect(task.drain()).resolves.toBeUndefined();
  });
});

const deferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
};
