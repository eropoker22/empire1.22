import { describe, expect, it } from "vitest";
import {
  summarizeDatabaseTelemetry,
  summarizeFlyTelemetry,
  summarizeRemoteLoadSamples
} from "../../scripts/remote-staging-load-metrics.mjs";

const healthy = {
  apiDurationsMs: [100, 150, 200, 250, 300],
  commandDurationsMs: [200, 300, 400],
  loginDurationsMs: [3_000, 4_000, 5_000],
  workerDurationsMs: [50, 70, 90],
  statusCodes: [200, 200, 200],
  ticks: [10, 11, 12],
  snapshotRecoveryHeadUpdates: [5, 7, 9],
  heartbeatAgesMs: [100, 200, 300]
};

describe("remote staging load metrics", () => {
  it("passes a progressing, error-free load sample", () => {
    expect(summarizeRemoteLoadSamples(healthy)).toMatchObject({
      passed: true,
      violations: [],
      http: { http429: 0, http5xx: 0 },
      tick: { min: 10, max: 12 }
    });
  });

  it("fails on stalled ticks, snapshots, stale heartbeat and HTTP bursts", () => {
    const result = summarizeRemoteLoadSamples({
      ...healthy,
      statusCodes: [429, 500],
      ticks: [10, 10],
      snapshotRecoveryHeadUpdates: [5, 5],
      heartbeatAgesMs: [45_000]
    });
    expect(result.passed).toBe(false);
    expect(result.violations).toEqual(expect.arrayContaining([
      "REMOTE_LOAD_HTTP_429",
      "REMOTE_LOAD_HTTP_5XX",
      "REMOTE_LOAD_TICK_STALLED",
      "REMOTE_LOAD_SNAPSHOT_STALLED",
      "REMOTE_LOAD_HEARTBEAT_STALE"
    ]));
  });

  it("enforces an explicit database connection threshold", () => {
    const samples = [
      { connectionCount: 5, activeConnectionCount: 2, probeDurationMs: 12 },
      { connectionCount: 9, activeConnectionCount: 4, probeDurationMs: 20 }
    ];
    expect(summarizeDatabaseTelemetry(samples, 10)).toMatchObject({
      passed: true,
      maximumObservedConnections: 9
    });
    expect(summarizeDatabaseTelemetry(samples, 8)).toMatchObject({
      passed: false,
      violations: ["REMOTE_LOAD_DB_CONNECTION_SATURATION"]
    });
  });

  it("enforces Fly memory, CPU and throttling thresholds", () => {
    const samples = [
      { memoryUsedBytes: 100, cpuUsedPct: 20, cpuThrottleIncrease: 0, appConcurrency: 2, queryDurationMs: 30 },
      { memoryUsedBytes: 200, cpuUsedPct: 30, cpuThrottleIncrease: 1, appConcurrency: 5, queryDurationMs: 40 }
    ];
    expect(summarizeFlyTelemetry(samples, {
      maxMemoryBytes: 300,
      maxCpuPct: 80,
      maxThrottleIncrease: 5
    })).toMatchObject({ passed: true, cpuThrottleIncrease: { max: 1 } });
    expect(summarizeFlyTelemetry(samples, {
      maxMemoryBytes: 150,
      maxCpuPct: 25,
      maxThrottleIncrease: 0
    }).violations).toEqual(expect.arrayContaining([
      "REMOTE_LOAD_WORKER_MEMORY_HIGH",
      "REMOTE_LOAD_WORKER_CPU_HIGH",
      "REMOTE_LOAD_WORKER_THROTTLED"
    ]));
  });

  it("fails closed for missing or errored provider telemetry", () => {
    expect(summarizeFlyTelemetry([{
      memoryUsedBytes: null,
      cpuUsedPct: null,
      cpuThrottleIncrease: null,
      errorCode: "REMOTE_LOAD_FLY_TELEMETRY_ERROR"
    }], {
      maxMemoryBytes: 300,
      maxCpuPct: 80,
      maxThrottleIncrease: 5
    })).toMatchObject({
      passed: false,
      errorSampleCount: 1,
      violations: expect.arrayContaining([
        "REMOTE_LOAD_FLY_TELEMETRY_MISSING",
        "REMOTE_LOAD_FLY_TELEMETRY_ERROR"
      ])
    });
  });
});
