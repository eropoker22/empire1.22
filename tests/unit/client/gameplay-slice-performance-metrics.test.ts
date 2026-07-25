/* @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from "vitest";
import {
  getGameplaySlicePollerPerformanceOptions,
  recordGameplayPollError
} from "../../../apps/client/src/browser/gameplay-slice-performance-metrics";

describe("gameplay slice performance metrics", () => {
  beforeEach(() => {
    window.empireStreetsPerformanceMetrics = {};
    window.empireStreetsRuntimeDiagnostics = { debugEnabled: false };
  });

  it("does not collect poll diagnostics without the explicit debug flag", () => {
    const hooks = getGameplaySlicePollerPerformanceOptions();

    hooks.onAttempt();
    hooks.onSuccess();
    hooks.onSkipped();
    recordGameplayPollError();

    expect(window.empireStreetsPerformanceMetrics?.gameplayPollCount).toBeUndefined();
    expect(window.empireStreetsPerformanceMetrics?.gameplayPollErrorCount).toBeUndefined();
  });

  it("collects poll diagnostics when the explicit debug flag is enabled", () => {
    window.empireStreetsRuntimeDiagnostics = { debugEnabled: true };
    const hooks = getGameplaySlicePollerPerformanceOptions();

    hooks.onAttempt();
    hooks.onSuccess();
    hooks.onSkipped();
    recordGameplayPollError();

    expect(window.empireStreetsPerformanceMetrics?.gameplayPollCount).toBe(1);
    expect(window.empireStreetsPerformanceMetrics?.gameplayPollSuccessCount).toBe(1);
    expect(window.empireStreetsPerformanceMetrics?.gameplayPollSkippedCount).toBe(1);
    expect(window.empireStreetsPerformanceMetrics?.gameplayPollErrorCount).toBe(1);
  });
});
