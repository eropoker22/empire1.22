/* @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getGameplaySlicePollerPerformanceOptions,
  recordGameplayCommandResponse,
  recordGameplayCommandSubmitted,
  recordGameplayCommandUiRenderComplete,
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

  it("records submit, server, response and UI-render timing only in debug mode", () => {
    window.empireStreetsRuntimeDiagnostics = { debugEnabled: true };
    const now = vi.spyOn(Date, "now")
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(1_090)
      .mockReturnValueOnce(1_096);

    recordGameplayCommandSubmitted("command:timing:1");
    recordGameplayCommandResponse("command:timing:1", {
      commandId: "command:timing:1",
      commandType: "occupy-district",
      status: "applied",
      serverReceivedAtMs: 1_020,
      serverResolvedAtMs: 1_045,
      persistenceCompletedAtMs: 1_060,
      serverResolutionMs: 25,
      persistenceMs: 15,
      totalServerMs: 40
    });
    recordGameplayCommandUiRenderComplete();

    expect(window.empireStreetsPerformanceMetrics?.lastGameplayCommandTiming).toMatchObject({
      commandId: "command:timing:1",
      commandType: "occupy-district",
      roundTripMs: 90,
      serverResolutionMs: 25,
      persistenceMs: 15,
      totalServerMs: 40,
      uiAfterResponseMs: 6
    });
    now.mockRestore();
  });
});
