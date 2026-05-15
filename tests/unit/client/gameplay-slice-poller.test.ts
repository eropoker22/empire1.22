import type { GameplaySliceResponse, LoadGameplaySliceRequest } from "@empire/shared-types";
import { describe, expect, it, vi } from "vitest";
import {
  createGameplaySlicePoller,
  type PollingTimerDriver
} from "../../../apps/client/src/transport";

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
});
