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
}

export const createRuntimePerformanceDiagnostics = (): RuntimePerformanceDiagnostics => ({
  tickCount: 0,
  skippedTickCount: 0,
  totalTickDurationMs: 0,
  averageTickDurationMs: 0,
  maxTickDurationMs: 0,
  snapshotWriteCount: 0,
  lastSnapshotSerializationDurationMs: 0,
  lastSnapshotSizeBytes: 0
});

export const isRuntimePerformanceDiagnosticsEnabled = (runtime: ServerInstanceRuntime): boolean =>
  runtime.config.technical.debug.allowDebugTools === true;

export const runtimePerformanceNow = (): number =>
  Number(globalThis.performance?.now?.() ?? Date.now());

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
