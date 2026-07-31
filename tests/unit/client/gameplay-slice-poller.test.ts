import type { GameplaySliceResponse, LoadGameplaySliceRequest } from "@empire/shared-types";
import { describe, expect, it, vi } from "vitest";
import {
  createGameplaySlicePoller,
  type PollingTimerDriver
} from "../../../apps/client/src/transport";
import { GAMEPLAY_SLICE_STABLE_POLL_INTERVAL_MS } from "../../../apps/client/src/browser/gameplay-slice-timing";

interface FakeInterval {
  callback: () => void;
  intervalMs: number;
}

class FakeTimerDriver implements PollingTimerDriver {
  readonly intervals: FakeInterval[] = [];
  readonly clearedHandles: unknown[] = [];

  setInterval(callback: () => void, intervalMs: number): unknown {
    const interval = {
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

class FakeVisibilityDocument {
  hidden = false;
  readonly listeners = new Set<() => void>();

  addEventListener(_type: "visibilitychange", listener: () => void): void {
    this.listeners.add(listener);
  }

  removeEventListener(_type: "visibilitychange", listener: () => void): void {
    this.listeners.delete(listener);
  }

  dispatchVisibilityChange(): void {
    for (const listener of Array.from(this.listeners)) {
      listener();
    }
  }
}

const request: LoadGameplaySliceRequest = {
  serverInstanceId: "instance:poll",
  playerId: "player:poll",
  districtId: "district:poll"
};

const response: GameplaySliceResponse = {
  accepted: true,
  readModel: null,
  errors: []
};

const flushMicrotasks = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

describe("gameplay slice poller", () => {
  it("uses a separate canonical ten-second stable polling interval", () => {
    expect(GAMEPLAY_SLICE_STABLE_POLL_INTERVAL_MS).toBe(10_000);
  });

  it("start schedules one interval and repeated start does not schedule another", () => {
    const timerDriver = new FakeTimerDriver();
    const poller = createGameplaySlicePoller({
      load: async () => response,
      getRequest: () => request,
      intervalMs: 2500,
      timerDriver
    });

    poller.start();
    poller.start();

    expect(poller.isRunning()).toBe(true);
    expect(timerDriver.intervals).toHaveLength(1);
    expect(timerDriver.intervals[0]?.intervalMs).toBe(2500);
  });

  it("stop clears the scheduled interval", () => {
    const timerDriver = new FakeTimerDriver();
    const poller = createGameplaySlicePoller({
      load: async () => response,
      getRequest: () => request,
      intervalMs: 2500,
      timerDriver
    });

    poller.start();
    poller.stop();
    poller.stop();

    expect(poller.isRunning()).toBe(false);
    expect(timerDriver.clearedHandles).toHaveLength(1);
    expect(timerDriver.clearedHandles[0]).toBe(timerDriver.intervals[0]);
  });

  it("refreshOnce calls load with the current request", async () => {
    const load = vi.fn(async () => response);
    const poller = createGameplaySlicePoller({
      load,
      getRequest: () => request,
      intervalMs: 2500,
      timerDriver: new FakeTimerDriver()
    });

    await expect(poller.refreshOnce()).resolves.toBe(response);

    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith(request);
  });

  it("passes response read model data to the response callback", async () => {
    const onResponse = vi.fn();
    const poller = createGameplaySlicePoller({
      load: async () => response,
      getRequest: () => request,
      intervalMs: 2500,
      timerDriver: new FakeTimerDriver(),
      onResponse
    });

    await poller.refreshOnce();

    expect(onResponse).toHaveBeenCalledTimes(1);
    expect(onResponse).toHaveBeenCalledWith(response);
  });

  it("failed polling load does not kill the interval", async () => {
    const timerDriver = new FakeTimerDriver();
    const error = new Error("offline");
    const onError = vi.fn();
    const poller = createGameplaySlicePoller({
      load: async () => {
        throw error;
      },
      getRequest: () => request,
      intervalMs: 2500,
      timerDriver,
      onError
    });

    poller.start();
    timerDriver.fire();
    await flushMicrotasks();

    expect(poller.isRunning()).toBe(true);
    expect(onError).toHaveBeenCalledWith(error);
  });

  it("polling can be disabled", () => {
    const timerDriver = new FakeTimerDriver();
    const poller = createGameplaySlicePoller({
      load: async () => response,
      getRequest: () => request,
      intervalMs: 2500,
      enabled: false,
      timerDriver
    });

    poller.start();

    expect(poller.isEnabled()).toBe(false);
    expect(poller.isRunning()).toBe(false);
    expect(timerDriver.intervals).toHaveLength(0);

    poller.setEnabled(true);
    poller.start();
    poller.setEnabled(false);

    expect(poller.isEnabled()).toBe(false);
    expect(poller.isRunning()).toBe(false);
    expect(timerDriver.clearedHandles).toHaveLength(1);
  });

  it("allows at most one in-flight refresh", async () => {
    let resolveLoad!: (value: GameplaySliceResponse) => void;
    const load = vi.fn(() => new Promise<GameplaySliceResponse>((resolve) => {
      resolveLoad = resolve;
    }));
    const onSkipped = vi.fn();
    const poller = createGameplaySlicePoller({
      load,
      getRequest: () => request,
      intervalMs: 2500,
      timerDriver: new FakeTimerDriver(),
      onSkipped
    });

    const first = poller.refreshOnce();
    await expect(poller.refreshOnce()).resolves.toBeNull();
    expect(load).toHaveBeenCalledTimes(1);
    expect(onSkipped).toHaveBeenCalledWith("in-progress");

    resolveLoad(response);
    await first;
  });

  it("does not poll while document is hidden and refreshes when visible again", async () => {
    const timerDriver = new FakeTimerDriver();
    const visibilityDocument = new FakeVisibilityDocument();
    const load = vi.fn(async () => response);
    visibilityDocument.hidden = true;
    const poller = createGameplaySlicePoller({
      load,
      getRequest: () => request,
      intervalMs: 2500,
      timerDriver,
      visibilityDocument
    });

    poller.start();

    expect(poller.isRunning()).toBe(false);
    expect(timerDriver.intervals).toHaveLength(0);

    visibilityDocument.hidden = false;
    visibilityDocument.dispatchVisibilityChange();
    await flushMicrotasks();

    expect(load).toHaveBeenCalledTimes(1);
    expect(poller.isRunning()).toBe(true);
    expect(timerDriver.intervals).toHaveLength(1);
  });

  it("repeated visibility cycles keep one interval and one refresh per return", async () => {
    const timerDriver = new FakeTimerDriver();
    const visibilityDocument = new FakeVisibilityDocument();
    const load = vi.fn(async () => response);
    const poller = createGameplaySlicePoller({
      load,
      getRequest: () => request,
      intervalMs: 2500,
      timerDriver,
      visibilityDocument
    });

    poller.start();
    for (let cycle = 0; cycle < 2; cycle += 1) {
      visibilityDocument.hidden = true;
      visibilityDocument.dispatchVisibilityChange();
      visibilityDocument.hidden = false;
      visibilityDocument.dispatchVisibilityChange();
      await flushMicrotasks();
    }

    expect(load).toHaveBeenCalledTimes(2);
    expect(timerDriver.intervals).toHaveLength(3);
    expect(timerDriver.clearedHandles).toHaveLength(2);
    expect(poller.isRunning()).toBe(true);
  });

  it("destroy clears active polling and removes visibility listener", () => {
    const timerDriver = new FakeTimerDriver();
    const visibilityDocument = new FakeVisibilityDocument();
    const onRunningChange = vi.fn();
    const poller = createGameplaySlicePoller({
      load: async () => response,
      getRequest: () => request,
      intervalMs: 2500,
      timerDriver,
      visibilityDocument,
      onRunningChange
    });

    poller.start();
    poller.destroy();
    poller.destroy();

    expect(poller.isRunning()).toBe(false);
    expect(timerDriver.clearedHandles).toHaveLength(1);
    expect(visibilityDocument.listeners.size).toBe(0);
    expect(onRunningChange).toHaveBeenNthCalledWith(1, 1);
    expect(onRunningChange).toHaveBeenNthCalledWith(2, -1);
  });

  it("backs off polling interval after repeated errors", async () => {
    const timerDriver = new FakeTimerDriver();
    const poller = createGameplaySlicePoller({
      load: async () => {
        throw new Error("offline");
      },
      getRequest: () => request,
      intervalMs: 1000,
      timerDriver,
      maxErrorIntervalMultiplier: 3
    });

    poller.start();
    timerDriver.fire();
    await flushMicrotasks();
    timerDriver.fire(1);
    await flushMicrotasks();

    expect(timerDriver.intervals.map((interval) => interval.intervalMs)).toEqual([1000, 2000, 3000]);
    expect(timerDriver.clearedHandles).toHaveLength(2);
  });

  it("backs off when a resolved response is classified as an error", async () => {
    const timerDriver = new FakeTimerDriver();
    const responseError = new Error("socket unavailable");
    const onError = vi.fn();
    const onResponse = vi.fn();
    const onSuccess = vi.fn();
    const poller = createGameplaySlicePoller({
      load: async () => ({ status: "error" as const }),
      getRequest: () => request,
      intervalMs: 10_000,
      timerDriver,
      getResponseError: (nextResponse) => nextResponse.status === "error" ? responseError : null,
      onError,
      onResponse,
      onSuccess
    });

    poller.start();
    timerDriver.fire();
    await flushMicrotasks();

    expect(timerDriver.intervals.map((interval) => interval.intervalMs)).toEqual([10_000, 20_000]);
    expect(onError).toHaveBeenCalledWith(responseError);
    expect(onResponse).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("resets resolved-response error backoff after a successful response", async () => {
    const timerDriver = new FakeTimerDriver();
    let hasError = true;
    const poller = createGameplaySlicePoller({
      load: async () => ({ hasError }),
      getRequest: () => request,
      intervalMs: 10_000,
      timerDriver,
      getResponseError: (nextResponse) => nextResponse.hasError ? new Error("offline") : null
    });

    poller.start();
    timerDriver.fire();
    await flushMicrotasks();
    hasError = false;
    timerDriver.fire(1);
    await flushMicrotasks();

    expect(timerDriver.intervals.map((interval) => interval.intervalMs)).toEqual([10_000, 20_000, 10_000]);
    expect(poller.isRunning()).toBe(true);
  });

  it("resets error backoff after a successful refresh", async () => {
    const timerDriver = new FakeTimerDriver();
    let shouldFail = true;
    const poller = createGameplaySlicePoller({
      load: async () => {
        if (shouldFail) throw new Error("offline");
        return response;
      },
      getRequest: () => request,
      intervalMs: 1000,
      timerDriver
    });

    poller.start();
    timerDriver.fire();
    await flushMicrotasks();
    shouldFail = false;
    timerDriver.fire(1);
    await flushMicrotasks();

    expect(timerDriver.intervals.map((interval) => interval.intervalMs)).toEqual([1000, 2000, 1000]);
    expect(poller.isRunning()).toBe(true);
  });
});
