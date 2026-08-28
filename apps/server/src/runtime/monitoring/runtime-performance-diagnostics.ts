import type { InstanceSnapshotDto } from "../persistence/dto";
import type { ServerInstanceRuntime } from "../instance";

export interface RuntimePerformanceDiagnostics {
  tickCount: number;
  skippedTickCount: number;
  totalTickDurationMs: number;
  averageTickDurationMs: number;
  maxTickDurationMs: number;
  snapshotWriteCount: number;
  lastSnapshotSerializationDurationMs: number;
  lastSnapshotSizeBytes: number;
  commandCount: number;
  totalCommandDurationMs: number;
  averageCommandDurationMs: number;
  maxCommandDurationMs: number;
  lastCommand: RuntimeCommandPerformanceSample | null;
}

export interface RuntimeCommandPerformanceSample {
  commandId: string;
  commandType: string;
  status: "applied" | "rejected" | "error";
  serverReceivedAtMs: number;
  serverResolvedAtMs: number;
  persistenceCompletedAtMs: number;
  serverResolutionMs: number;
  persistenceMs: number;
  totalServerMs: number;
}

export interface RuntimeCommandPerformanceTracker {
  commandId: string;
  commandType: string;
  serverReceivedAtMs: number;
  startedAtMs: number;
  resolvedAtMs: number | null;
}

export const createRuntimePerformanceDiagnostics = (): RuntimePerformanceDiagnostics => ({
  tickCount: 0,
  skippedTickCount: 0,
  totalTickDurationMs: 0,
  averageTickDurationMs: 0,
  maxTickDurationMs: 0,
  snapshotWriteCount: 0,
  lastSnapshotSerializationDurationMs: 0,
  lastSnapshotSizeBytes: 0,
  commandCount: 0,
  totalCommandDurationMs: 0,
  averageCommandDurationMs: 0,
  maxCommandDurationMs: 0,
  lastCommand: null
});

export const isRuntimePerformanceDiagnosticsEnabled = (runtime: ServerInstanceRuntime): boolean => {
  if (runtime.config.technical.debug.allowDebugTools === true) return true;
  const environment = typeof process === "undefined" ? {} : process.env;
  const releaseEnvironment = String(environment.EMPIRE_RELEASE_ENVIRONMENT ?? "").trim().toLowerCase();
  const explicitlyEnabled = String(environment.EMPIRE_COMMAND_LATENCY_DIAGNOSTICS ?? "").trim().toLowerCase() === "true";
  return explicitlyEnabled && releaseEnvironment !== "production";
};

export const runtimePerformanceNow = (): number =>
  Number(globalThis.performance?.now?.() ?? Date.now());

export const beginRuntimeCommandPerformance = (
  runtime: ServerInstanceRuntime,
  command: { id: string; type: string }
): RuntimeCommandPerformanceTracker | null => {
  if (!isRuntimePerformanceDiagnosticsEnabled(runtime)) return null;
  return {
    commandId: command.id,
    commandType: command.type,
    serverReceivedAtMs: Date.now(),
    startedAtMs: runtimePerformanceNow(),
    resolvedAtMs: null
  };
};

export const markRuntimeCommandResolved = (
  tracker: RuntimeCommandPerformanceTracker | null
): void => {
  if (tracker && tracker.resolvedAtMs === null) tracker.resolvedAtMs = runtimePerformanceNow();
};

export const recordRuntimeCommandCompleted = (
  runtime: ServerInstanceRuntime,
  tracker: RuntimeCommandPerformanceTracker | null,
  status: RuntimeCommandPerformanceSample["status"]
): RuntimeCommandPerformanceSample | null => {
  if (!tracker || !isRuntimePerformanceDiagnosticsEnabled(runtime)) return null;
  const persistenceCompletedAt = runtimePerformanceNow();
  const resolvedAt = tracker.resolvedAtMs ?? persistenceCompletedAt;
  const serverResolutionMs = Math.max(0, resolvedAt - tracker.startedAtMs);
  const persistenceMs = Math.max(0, persistenceCompletedAt - resolvedAt);
  const totalServerMs = Math.max(0, persistenceCompletedAt - tracker.startedAtMs);
  const sample: RuntimeCommandPerformanceSample = {
    commandId: tracker.commandId,
    commandType: tracker.commandType,
    status,
    serverReceivedAtMs: tracker.serverReceivedAtMs,
    serverResolvedAtMs: tracker.serverReceivedAtMs + serverResolutionMs,
    persistenceCompletedAtMs: tracker.serverReceivedAtMs + totalServerMs,
    serverResolutionMs,
    persistenceMs,
    totalServerMs
  };
  const metrics = runtime.runtimeHealth.performanceDiagnostics;
  metrics.commandCount += 1;
  metrics.totalCommandDurationMs += totalServerMs;
  metrics.averageCommandDurationMs = metrics.totalCommandDurationMs / metrics.commandCount;
  metrics.maxCommandDurationMs = Math.max(metrics.maxCommandDurationMs, totalServerMs);
  metrics.lastCommand = sample;
  return sample;
};

export const recordRuntimeTickSkipped = (runtime: ServerInstanceRuntime): void => {
  if (!isRuntimePerformanceDiagnosticsEnabled(runtime)) return;
  runtime.runtimeHealth.performanceDiagnostics.skippedTickCount += 1;
};

export const recordRuntimeTickCompleted = (
  runtime: ServerInstanceRuntime,
  startedAtMs: number
): void => {
  if (!isRuntimePerformanceDiagnosticsEnabled(runtime)) return;
  const metrics = runtime.runtimeHealth.performanceDiagnostics;
  const durationMs = Math.max(0, runtimePerformanceNow() - startedAtMs);
  metrics.tickCount += 1;
  metrics.totalTickDurationMs += durationMs;
  metrics.averageTickDurationMs = metrics.totalTickDurationMs / metrics.tickCount;
  metrics.maxTickDurationMs = Math.max(metrics.maxTickDurationMs, durationMs);
};

export const recordRuntimeSnapshotWrite = (
  runtime: ServerInstanceRuntime,
  snapshot: InstanceSnapshotDto
): void => {
  if (!isRuntimePerformanceDiagnosticsEnabled(runtime)) return;
  const startedAtMs = runtimePerformanceNow();
  const serialized = JSON.stringify(snapshot);
  const metrics = runtime.runtimeHealth.performanceDiagnostics;
  metrics.snapshotWriteCount += 1;
  metrics.lastSnapshotSerializationDurationMs = Math.max(0, runtimePerformanceNow() - startedAtMs);
  metrics.lastSnapshotSizeBytes = new TextEncoder().encode(serialized).byteLength;
};
