import { getPerformanceMetrics } from "./mobilePerformanceMode.js";
import {
  GAMEPLAY_EXECUTION_MODES,
  getGameplayExecutionMode,
  isDevelopmentGameplayHost,
  normalizeGameplayExecutionMode,
  readConfiguredGameplayExecutionMode,
  readRequestedGameplayExecutionMode
} from "../runtime/gameplayExecutionMode.js";

const RUNTIME_MODE_EVENT = "empire:runtime-mode-changed";
const METRIC_WINDOW_MS = 60_000;
const DEV_RUNTIME_MODES = new Set([GAMEPLAY_EXECUTION_MODES.localDemo]);

function pruneTimestamps(timestamps, nowMs) {
  const cutoff = nowMs - METRIC_WINDOW_MS;
  while (timestamps.length > 0 && timestamps[0] < cutoff) {
    timestamps.shift();
  }
  return timestamps.length;
}

export function isDevelopmentRuntime(windowRef = typeof window === "undefined" ? null : window) {
  return isDevelopmentGameplayHost(windowRef);
}

export function createServerSliceFingerprint(gameplaySlice = null) {
  if (!gameplaySlice || typeof gameplaySlice !== "object") {
    return "";
  }

  const server = gameplaySlice.server || {};
  const player = gameplaySlice.player || {};
  return JSON.stringify({
    instanceId: server.serverInstanceId || player.instanceId || "",
    playerId: player.playerId || "",
    stateVersion: server.stateVersion ?? null,
    currentTick: server.currentTick ?? null,
    selectedDistrictId: gameplaySlice.district?.districtId || server.selectedDistrictId || "",
    spawnStatus: gameplaySlice.spawnSelection?.status || "",
    gamePhase: gameplaySlice.gamePhase || ""
  });
}

function initializeRuntimeMetrics(metrics, initialMode) {
  metrics.runtimeMode = initialMode;
  metrics.localTickActive = false;
  metrics.localProjectionActive = DEV_RUNTIME_MODES.has(initialMode);
  metrics.serverSliceActive = false;
  metrics.serverSliceRefreshPerMinute = 0;
  metrics.clientStateRecomputePerMinute = 0;
  metrics.mapInvalidationReasonCounts = metrics.mapInvalidationReasonCounts || {};
  metrics.lastMapInvalidationReason = metrics.lastMapInvalidationReason || null;
  metrics.demoFallbackActive = initialMode === GAMEPLAY_EXECUTION_MODES.localDemo;
  metrics.serverSliceUnchangedRefreshCount = Number(metrics.serverSliceUnchangedRefreshCount || 0);
  metrics.localTickCount = Number(metrics.localTickCount || 0);
  return metrics;
}

export function createRuntimePerformanceDiagnostics(options = {}) {
  const windowRef = options.windowRef || (typeof window === "undefined" ? null : window);
  const documentRef = options.documentRef || windowRef?.document || (typeof document === "undefined" ? null : document);
  const development = options.development ?? isDevelopmentRuntime(windowRef);
  const requestedMode = readRequestedGameplayExecutionMode(windowRef);
  const configuredMode = readConfiguredGameplayExecutionMode(windowRef);
  const allowLocalDemo = development || configuredMode === GAMEPLAY_EXECUTION_MODES.localDemo;
  let runtimeMode = requestedMode || getGameplayExecutionMode({ windowRef });
  const metrics = initializeRuntimeMetrics(getPerformanceMetrics(windowRef), runtimeMode);
  const activeLocalTickLabels = new Set();
  const serverSliceRefreshTimestamps = [];
  const clientStateRecomputeTimestamps = [];
  let lastServerSliceFingerprint = "";
  let lastLoggedSummary = "";

  const syncRates = (nowMs = Date.now()) => {
    metrics.serverSliceRefreshPerMinute = pruneTimestamps(serverSliceRefreshTimestamps, nowMs);
    metrics.clientStateRecomputePerMinute = pruneTimestamps(clientStateRecomputeTimestamps, nowMs);
  };

  const syncDocumentMarkers = () => {
    for (const element of [documentRef?.documentElement, documentRef?.body]) {
      if (!element?.dataset) continue;
      element.dataset.runtimeMode = runtimeMode;
      element.dataset.localTickActive = metrics.localTickActive ? "true" : "false";
      element.dataset.serverSliceActive = metrics.serverSliceActive ? "true" : "false";
      element.dataset.demoFallbackActive = metrics.demoFallbackActive ? "true" : "false";
    }
  };

  const getSummary = () => {
    syncRates();
    return {
      runtimeMode: metrics.runtimeMode,
      localTickActive: Boolean(metrics.localTickActive),
      localProjectionActive: Boolean(metrics.localProjectionActive),
      serverSliceActive: Boolean(metrics.serverSliceActive),
      serverSliceRefreshPerMinute: Number(metrics.serverSliceRefreshPerMinute || 0),
      clientStateRecomputePerMinute: Number(metrics.clientStateRecomputePerMinute || 0),
      mapInvalidationReasonCounts: { ...(metrics.mapInvalidationReasonCounts || {}) },
      lastMapInvalidationReason: metrics.lastMapInvalidationReason || null,
      demoFallbackActive: Boolean(metrics.demoFallbackActive),
      mapRenderFpsCap: Number(metrics.mapRenderFpsCap || 0),
      mapEffectsFpsCap: Number(metrics.mapEffectsFpsCap || 0),
      mapEffectsQuality: metrics.mapEffectsQuality || "full",
      lastRenderDurationMs: Number(metrics.lastRenderDurationMs || 0),
      clientWorkSummary: metrics.serverSliceActive && !metrics.localTickActive
        ? "server slice render only; local gameplay tick is stopped"
        : runtimeMode === GAMEPLAY_EXECUTION_MODES.localDemo
          ? "local demo runtime is computing on this device"
          : "gameplay runtime is unavailable; no local authority is running"
    };
  };

  const logSummary = (force = false) => {
    const summary = getSummary();
    const fingerprint = JSON.stringify(summary);
    if (force || fingerprint !== lastLoggedSummary) {
      lastLoggedSummary = fingerprint;
      windowRef?.console?.info?.("[Empire Streets runtime]", summary);
    }
    return summary;
  };

  const dispatchModeChange = (reason) => {
    syncDocumentMarkers();
    const summary = logSummary();
    const CustomEventCtor = windowRef?.CustomEvent || globalThis.CustomEvent;
    documentRef?.dispatchEvent?.(CustomEventCtor
      ? new CustomEventCtor(RUNTIME_MODE_EVENT, { detail: { ...summary, reason } })
      : { type: RUNTIME_MODE_EVENT, detail: { ...summary, reason } });
  };

  const setMode = (nextMode, details = {}) => {
    const normalizedMode = normalizeGameplayExecutionMode(nextMode) || GAMEPLAY_EXECUTION_MODES.unavailable;
    runtimeMode = !allowLocalDemo && DEV_RUNTIME_MODES.has(normalizedMode)
      ? GAMEPLAY_EXECUTION_MODES.unavailable
      : normalizedMode;
    metrics.runtimeMode = runtimeMode;
    metrics.serverSliceActive = runtimeMode === GAMEPLAY_EXECUTION_MODES.serverAuthoritative
      ? Boolean(details.serverSliceActive ?? metrics.serverSliceActive)
      : false;
    metrics.localProjectionActive = DEV_RUNTIME_MODES.has(runtimeMode);
    metrics.demoFallbackActive = runtimeMode === GAMEPLAY_EXECUTION_MODES.localDemo;
    if (runtimeMode !== GAMEPLAY_EXECUTION_MODES.localDemo) {
      activeLocalTickLabels.clear();
      metrics.localTickActive = false;
    }
    dispatchModeChange(details.reason || "runtime-mode-update");
    return runtimeMode;
  };

  const setLocalTickActive = (label, active) => {
    const key = String(label || "local-runtime");
    if (active && allowLocalDemo && DEV_RUNTIME_MODES.has(runtimeMode)) {
      activeLocalTickLabels.add(key);
    } else {
      activeLocalTickLabels.delete(key);
    }
    metrics.localTickActive = activeLocalTickLabels.size > 0;
    syncDocumentMarkers();
    return metrics.localTickActive;
  };

  const observeServerSlice = (gameplaySlice, observation = {}) => {
    const nowMs = Number(observation.nowMs || Date.now());
    const fingerprint = createServerSliceFingerprint(gameplaySlice);
    const changed = Boolean(fingerprint && fingerprint !== lastServerSliceFingerprint);
    if (fingerprint) {
      lastServerSliceFingerprint = fingerprint;
    }
    serverSliceRefreshTimestamps.push(nowMs);
    syncRates(nowMs);
    if (!changed) {
      metrics.serverSliceUnchangedRefreshCount += 1;
    }
    // Local demo is an explicit authority boundary. A development server may
    // still expose read models for diagnostics, but observing one must not
    // silently start the server runtime beside the local simulation.
    if (!(allowLocalDemo && runtimeMode === GAMEPLAY_EXECUTION_MODES.localDemo)) {
      setMode(GAMEPLAY_EXECUTION_MODES.serverAuthoritative, {
        serverSliceActive: Boolean(gameplaySlice),
        reason: changed ? "server-slice-changed" : "server-slice-unchanged"
      });
    } else {
      metrics.serverSliceActive = false;
      syncDocumentMarkers();
    }
    return { changed, fingerprint, summary: getSummary() };
  };

  const api = {
    development,
    get requestedMode() {
      return requestedMode;
    },
    getSummary,
    logSummary: () => logSummary(true),
    setMode,
    setLocalTickActive,
    shouldAllowDemoFallback: () => allowLocalDemo && runtimeMode === GAMEPLAY_EXECUTION_MODES.localDemo,
    shouldRunLocalTick: () => allowLocalDemo && DEV_RUNTIME_MODES.has(runtimeMode),
    shouldRunLocalProjection: () => allowLocalDemo && DEV_RUNTIME_MODES.has(runtimeMode),
    getLocalTickIntervalMs: (baseIntervalMs) => {
      const safeBase = Math.max(1, Number(baseIntervalMs || 1));
      const isDemoFallback = runtimeMode === GAMEPLAY_EXECUTION_MODES.localDemo;
      return isDemoFallback && windowRef?.empireStreetsPerformanceMode?.active ? safeBase * 3 : safeBase;
    },
    recordLocalTick: () => {
      if (!api.shouldRunLocalTick()) return false;
      metrics.localTickCount += 1;
      return true;
    },
    recordClientStateRecompute: (reason = "unknown") => {
      const nowMs = Date.now();
      clientStateRecomputeTimestamps.push(nowMs);
      metrics.lastClientStateRecomputeReason = String(reason || "unknown");
      syncRates(nowMs);
      return metrics.clientStateRecomputePerMinute;
    },
    recordMapInvalidation: (reason = "state-change") => {
      const normalizedReason = String(reason || "state-change");
      const counts = metrics.mapInvalidationReasonCounts || {};
      counts[normalizedReason] = Number(counts[normalizedReason] || 0) + 1;
      metrics.mapInvalidationReasonCounts = counts;
      metrics.lastMapInvalidationReason = normalizedReason;
      return counts[normalizedReason];
    },
    observeServerSlice
  };

  syncDocumentMarkers();
  logSummary(true);
  return api;
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  window.empireStreetsRuntimeDiagnostics ??= createRuntimePerformanceDiagnostics({ windowRef: window, documentRef: document });
}
