import { describe, expect, it } from "vitest";
import {
  classifyRemoteLoadActionOutcome,
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
  heartbeatAgesMs: [100, 200, 300],
  actionOutcomes: [
    { ...acceptedAction("buy-market-resource"), selectedDistrictChanged: true },
    acceptedAction("sell-market-resource"),
    acceptedAction("craft-item"),
    acceptedAction("run-building-action"),
    acceptedAction("send-city-chat-message")
  ]
};

describe("remote staging load metrics", () => {
  it("passes a progressing, error-free load sample", () => {
    expect(summarizeRemoteLoadSamples(healthy)).toMatchObject({
      passed: true,
      violations: [],
      http: { http429: 0, http5xx: 0 },
      actionMix: {
        distinctActualActionCount: 5,
        distinctAcceptedActionCount: 5,
        actual: {
          "buy-market-resource": 1,
          "sell-market-resource": 1,
          "craft-item": 1,
          "run-building-action": 1,
          "send-city-chat-message": 1
        }
      },
      rejectionClassification: { total: 0 },
      tick: { min: 10, max: 12 }
    });
  });

  it("fails on stalled progress, stale heartbeat and HTTP auth/error bursts", () => {
    const result = summarizeRemoteLoadSamples({
      ...healthy,
      statusCodes: [401, 404, 429, 500],
      ticks: [10, 10],
      snapshotRecoveryHeadUpdates: [5, 5],
      heartbeatAgesMs: [45_000]
    });
    expect(result.passed).toBe(false);
    expect(result.violations).toEqual(expect.arrayContaining([
      "REMOTE_LOAD_HTTP_429",
      "REMOTE_LOAD_HTTP_5XX",
      "REMOTE_LOAD_HTTP_AUTH",
      "REMOTE_LOAD_HTTP_UNEXPECTED_4XX",
      "REMOTE_LOAD_TICK_STALLED",
      "REMOTE_LOAD_SNAPSHOT_STALLED",
      "REMOTE_LOAD_HEARTBEAT_STALE"
    ]));
  });

  it("keeps legitimate stale and domain conflicts separate from fatal rejections", () => {
    const result = summarizeRemoteLoadSamples({
      ...healthy,
      actionOutcomes: [
        acceptedAction("buy-market-resource"),
        rejectedAction("craft-item", "server.state_version_conflict"),
        rejectedAction("collect-production", "production_empty"),
        {
          desiredAction: "attack-district",
          actualAction: null,
          outcome: "skipped",
          accepted: false,
          skipped: true,
          errorCodes: []
        }
      ]
    }, {
      minActualActionTypes: 1,
      minAcceptedActionTypes: 1,
      minDistrictSelectionChanges: 0
    });
    expect(result.passed).toBe(true);
    expect(result.actionMix).toMatchObject({
      sampleCount: 4,
      attemptedCount: 3,
      acceptedCount: 1,
      skippedCount: 1,
      districtSelectionChangeCount: 0
    });
    expect(result.rejectionClassification).toEqual({
      total: 2,
      staleConflict: 1,
      domainConflict: 1,
      auth: 0,
      rateLimit: 0,
      unexpected: 0,
      byCode: {
        "server.state_version_conflict": 1,
        production_empty: 1
      }
    });
  });

  it("fails on authentication, rate-limit, unexpected and insufficient-mix outcomes", () => {
    const result = summarizeRemoteLoadSamples({
      ...healthy,
      actionOutcomes: [
        acceptedAction("buy-market-resource"),
        rejectedAction("sell-market-resource", "SESSION_REVOKED"),
        rejectedAction("send-city-chat-message", "CITY_CHAT_RATE_LIMITED"),
        rejectedAction("craft-item", "transport.invalid_request")
      ]
    }, { minDistrictSelectionChanges: 0 });
    expect(result.passed).toBe(false);
    expect(result.violations).toEqual(expect.arrayContaining([
      "REMOTE_LOAD_ACTION_AUTH_FAILURE",
      "REMOTE_LOAD_ACTION_RATE_LIMIT_FAILURE",
      "REMOTE_LOAD_ACTION_UNEXPECTED_FAILURE",
      "REMOTE_LOAD_ACTION_MIX_INSUFFICIENT"
    ]));
    expect(result.rejectionClassification).toMatchObject({
      auth: 1,
      rateLimit: 1,
      unexpected: 1
    });
  });

  it("classifies a transport failure as unexpected even without a domain error code", () => {
    expect(classifyRemoteLoadActionOutcome({
      accepted: false,
      skipped: false,
      transportFailure: true,
      errorCodes: ["client.transport_error"]
    })).toBe("unexpected");
  });

  it("does not hide missing target identifiers as an expected domain race", () => {
    expect(classifyRemoteLoadActionOutcome(
      rejectedAction("attack-district", "DISTRICT_NOT_FOUND")
    )).toBe("unexpected");
    expect(classifyRemoteLoadActionOutcome(
      rejectedAction("rob-district", "TARGET_NOT_FOUND")
    )).toBe("unexpected");
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

function acceptedAction(action) {
  return {
    desiredAction: action,
    actualAction: action,
    outcome: "accepted",
    accepted: true,
    skipped: false,
    errorCodes: []
  };
}

function rejectedAction(action, errorCode) {
  return {
    desiredAction: action,
    actualAction: action,
    outcome: "error",
    accepted: false,
    skipped: false,
    errorCode,
    errorCodes: [errorCode]
  };
}
