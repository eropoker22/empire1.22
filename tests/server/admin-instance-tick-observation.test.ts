import { describe, expect, it } from "vitest";
import {
  createAdminInstanceTickObservationCache,
  type AdminInstanceTickSample
} from "../../apps/server/src/admin/read-only/admin-instance-tick-observation";

describe("admin per-instance tick observation", () => {
  it("requires two samples before reporting pass and expires stale proof", () => {
    const cache = createAdminInstanceTickObservationCache();

    expect(cache.observe(sample())).toEqual({
      status: "pending",
      reasonCode: "tick-observation-first-sample",
      observedAt: "2026-07-31T10:00:00.000Z"
    });
    expect(cache.observe(sample({
      observedAt: "2026-07-31T10:00:10.000Z",
      currentTick: 11,
      rootTick: 11,
      stateVersion: 101
    }))).toEqual({
      status: "pass",
      reasonCode: "tick-advance-two-sample",
      observedAt: "2026-07-31T10:00:10.000Z"
    });
    expect(cache.observe(sample({
      observedAt: "2026-07-31T10:00:20.000Z",
      currentTick: 11,
      rootTick: 11,
      stateVersion: 101
    }))).toMatchObject({
      status: "pass",
      reasonCode: "tick-advance-two-sample"
    });
    expect(cache.observe(sample({
      observedAt: "2026-07-31T10:00:41.000Z",
      currentTick: 11,
      rootTick: 11,
      stateVersion: 101
    }))).toEqual({
      status: "fail",
      reasonCode: "tick-not-advancing",
      observedAt: "2026-07-31T10:00:41.000Z"
    });
  });

  it("does not claim progress from samples separated by more than the proof window", () => {
    const cache = createAdminInstanceTickObservationCache();
    cache.observe(sample());

    expect(cache.observe(sample({
      observedAt: "2026-07-31T10:00:31.000Z",
      currentTick: 13,
      rootTick: 13,
      stateVersion: 103
    }))).toEqual({
      status: "pending",
      reasonCode: "tick-observation-gap-too-large",
      observedAt: "2026-07-31T10:00:31.000Z"
    });
    expect(cache.observe(sample({
      observedAt: "2026-07-31T10:00:41.000Z",
      currentTick: 14,
      rootTick: 14,
      stateVersion: 104
    }))).toMatchObject({
      status: "pass",
      reasonCode: "tick-advance-two-sample"
    });
  });

  it("allows command-only stateVersion changes while waiting for the next full tick", () => {
    const cache = createAdminInstanceTickObservationCache();
    cache.observe(sample());

    expect(cache.observe(sample({
      observedAt: "2026-07-31T10:00:05.000Z",
      stateVersion: 101
    }))).toMatchObject({
      status: "pending",
      reasonCode: "tick-observation-window-open"
    });
    expect(cache.observe(sample({
      observedAt: "2026-07-31T10:00:10.000Z",
      currentTick: 11,
      rootTick: 11,
      stateVersion: 102
    }))).toMatchObject({
      status: "pass",
      reasonCode: "tick-advance-two-sample"
    });
  });

  it("fails inconsistent snapshot progress and resets after lifecycle inactivity", () => {
    const cache = createAdminInstanceTickObservationCache();
    cache.observe(sample());

    expect(cache.observe(sample({
      observedAt: "2026-07-31T10:00:10.000Z",
      currentTick: 11,
      rootTick: 10,
      stateVersion: 101
    }))).toMatchObject({
      status: "fail",
      reasonCode: "tick-observation-inconsistent"
    });
    expect(cache.observe(sample({
      lifecycleStatus: "paused",
      observedAt: "2026-07-31T10:00:20.000Z",
      currentTick: 11,
      rootTick: 11,
      stateVersion: 101
    }))).toMatchObject({
      status: "pending",
      reasonCode: "tick-observation-not-required"
    });
    expect(cache.observe(sample({
      observedAt: "2026-07-31T10:00:30.000Z",
      currentTick: 12,
      rootTick: 12,
      stateVersion: 102
    }))).toMatchObject({
      status: "pending",
      reasonCode: "tick-observation-first-sample"
    });
  });

  it("resets proof when the lifecycle start marker changes", () => {
    const cache = createAdminInstanceTickObservationCache();
    cache.observe(sample());
    cache.observe(sample({
      observedAt: "2026-07-31T10:00:10.000Z",
      currentTick: 11,
      rootTick: 11,
      stateVersion: 101
    }));

    expect(cache.observe(sample({
      observedAt: "2026-07-31T10:00:20.000Z",
      currentTick: 12,
      rootTick: 12,
      stateVersion: 102,
      lastStartedAt: "2026-07-31T10:00:15.000Z"
    }))).toMatchObject({
      status: "pending",
      reasonCode: "tick-observation-first-sample"
    });
  });
});

const sample = (
  overrides: Partial<AdminInstanceTickSample> = {}
): AdminInstanceTickSample => ({
  serverInstanceId: "instance:free:tick-proof",
  lifecycleStatus: "running",
  observedAt: "2026-07-31T10:00:00.000Z",
  currentTick: 10,
  rootTick: 10,
  stateVersion: 100,
  lastStartedAt: "2026-07-31T09:55:00.000Z",
  observationWindowMs: 30_000,
  ...overrides
});
