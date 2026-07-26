/* @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { createRuntimePerformanceDiagnostics } from "../../page-assets/js/app/performance/runtimePerformanceDiagnostics.js";
import { getGameplayExecutionMode } from "../../page-assets/js/app/runtime/gameplayExecutionMode.js";

function createWindowFixture(search = "") {
  const store = new Map();
  return {
    location: { protocol: "http:", hostname: "127.0.0.1", search },
    document,
    CustomEvent,
    console: { info: vi.fn() },
    localStorage: {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => store.set(key, String(value))
    },
    empireStreetsPerformanceMode: { active: true }
  };
}

describe("runtime performance diagnostics", () => {
  it("keeps an explicit local-demo boundary even when a server slice is available", () => {
    const meta = document.createElement("meta");
    meta.name = "empire-gameplay-execution-mode";
    meta.content = "local-demo";
    document.head.append(meta);
    const windowRef = createWindowFixture();

    expect(getGameplayExecutionMode({ windowRef, serverReady: true, diagnosticsMode: "server-authoritative" })).toBe("local-demo");

    meta.remove();
  });

  it("keeps the entrypoint server authority ahead of stale local demo storage", () => {
    const windowRef = createWindowFixture();
    windowRef.localStorage.setItem("empire:demo:execution-mode:v1", "local-demo");
    windowRef.__EMPIRE_GAMEPLAY_EXECUTION_MODE__ = "server-authoritative";

    expect(getGameplayExecutionMode({
      windowRef,
      serverReady: false,
      diagnosticsMode: "local-demo"
    })).toBe("server-authoritative");
    expect(windowRef.__EMPIRE_GAMEPLAY_AUTHORITY_MATRIX__.attack.serverCommand).toBe(true);
    expect(windowRef.__EMPIRE_GAMEPLAY_AUTHORITY_MATRIX__.attack.localMutation).toBe(false);
  });

  it("keeps local demo isolated until server-authoritative mode is selected", () => {
    const windowRef = createWindowFixture();
    const meta = document.createElement("meta");
    meta.name = "empire-gameplay-execution-mode";
    meta.content = "local-demo";
    document.head.append(meta);
    const diagnostics = createRuntimePerformanceDiagnostics({
      windowRef,
      documentRef: document,
      development: true,
      debugEnabled: true
    });

    expect(diagnostics.getSummary()).toMatchObject({
      runtimeMode: "local-demo",
      localProjectionActive: true,
      serverSliceActive: false,
      demoFallbackActive: true
    });
    expect(diagnostics.getLocalTickIntervalMs(10_000)).toBe(10_000);

    diagnostics.setLocalTickActive("city-clock", true);
    diagnostics.recordLocalTick();
    diagnostics.recordClientStateRecompute("legacy-refresh");
    diagnostics.recordMapInvalidation("ui:settings-change");
    const firstObservation = diagnostics.observeServerSlice({
      server: { serverInstanceId: "instance:test", stateVersion: 2, currentTick: 4 },
      player: { playerId: "player:test" },
      district: { districtId: "district:1" }
    });
    const repeatedObservation = diagnostics.observeServerSlice({
      server: { serverInstanceId: "instance:test", stateVersion: 2, currentTick: 4 },
      player: { playerId: "player:test" },
      district: { districtId: "district:1" }
    });

    expect(firstObservation.changed).toBe(true);
    expect(repeatedObservation.changed).toBe(false);
    expect(diagnostics.getSummary()).toMatchObject({
      runtimeMode: "local-demo",
      localTickActive: true,
      localProjectionActive: true,
      serverSliceActive: false,
      serverSliceRefreshPerMinute: 2,
      clientStateRecomputePerMinute: 1,
      mapInvalidationReasonCounts: { "ui:settings-change": 1 },
      lastMapInvalidationReason: "ui:settings-change",
      demoFallbackActive: true
    });

    diagnostics.setMode("server-authoritative", { reason: "test-server-selection" });
    diagnostics.observeServerSlice({
      server: { serverInstanceId: "instance:test", stateVersion: 3, currentTick: 5 },
      player: { playerId: "player:test" },
      district: { districtId: "district:1" }
    });

    expect(diagnostics.getSummary()).toMatchObject({
      runtimeMode: "server-authoritative",
      localTickActive: false,
      localProjectionActive: false,
      serverSliceActive: true,
      serverSliceRefreshPerMinute: 3,
      clientStateRecomputePerMinute: 1,
      mapInvalidationReasonCounts: { "ui:settings-change": 1 },
      lastMapInvalidationReason: "ui:settings-change",
      mapEffectsQuality: "full",
      demoFallbackActive: false
    });

    meta.remove();
  });

  it("requires an explicit local-demo mode before enabling local authority on development hosts", () => {
    const windowRef = createWindowFixture();
    const diagnostics = createRuntimePerformanceDiagnostics({
      windowRef,
      documentRef: document,
      development: true
    });

    expect(diagnostics.getSummary()).toMatchObject({
      runtimeMode: "unavailable",
      localTickActive: false,
      localProjectionActive: false,
      serverSliceActive: false,
      demoFallbackActive: false
    });
    expect(diagnostics.shouldAllowDemoFallback()).toBe(false);
  });

  it("accepts an explicit demo mode selected by the game entry after diagnostics boot", () => {
    const windowRef = createWindowFixture();
    const diagnostics = createRuntimePerformanceDiagnostics({
      windowRef,
      documentRef: document,
      development: true
    });

    windowRef.__EMPIRE_GAMEPLAY_EXECUTION_MODE__ = "local-demo";
    expect(diagnostics.setMode("local-demo", { reason: "game-entry-mode-selected" })).toBe("local-demo");
    expect(diagnostics.getSummary()).toMatchObject({
      runtimeMode: "local-demo",
      localProjectionActive: true,
      demoFallbackActive: true
    });
  });

  it("refuses demo mode outside development", () => {
    const windowRef = createWindowFixture("?runtimeMode=demo");
    windowRef.location.hostname = "streets.example";
    const diagnostics = createRuntimePerformanceDiagnostics({
      windowRef,
      documentRef: document,
      development: false
    });

    diagnostics.setMode("demo", { reason: "test" });

    expect(diagnostics.getSummary()).toMatchObject({
      runtimeMode: "unavailable",
      localTickActive: false,
      localProjectionActive: false,
      serverSliceActive: false,
      demoFallbackActive: false
    });
    expect(diagnostics.shouldAllowDemoFallback()).toBe(false);
  });

  it("collects render diagnostics only behind the explicit debug flag", () => {
    const disabled = createRuntimePerformanceDiagnostics({
      windowRef: createWindowFixture(),
      documentRef: document,
      development: true,
      debugEnabled: false
    });
    const enabled = createRuntimePerformanceDiagnostics({
      windowRef: createWindowFixture("?performanceDebug=1"),
      documentRef: document,
      development: true,
      debugEnabled: true
    });

    disabled.recordMapLayerRedraw("static");
    disabled.recordEffectFrame();
    enabled.recordMapLayerRedraw("static");
    enabled.recordEffectFrame();
    enabled.setMapRafActive(true);

    expect(disabled.getSummary()).toMatchObject({
      debugEnabled: false,
      mapStaticRedrawCount: 0,
      mapEffectFrameCount: 0,
      activeMapRafLoops: 0
    });
    expect(enabled.getSummary()).toMatchObject({
      debugEnabled: true,
      mapStaticRedrawCount: 1,
      mapEffectFrameCount: 1,
      activeMapRafLoops: 1
    });
  });
});
