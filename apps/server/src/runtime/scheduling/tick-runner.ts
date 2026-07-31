import { runTick } from "@empire/game-core";
import type { InstanceRuntimeEvent } from "@empire/shared-types";
import type { ServerInstanceRuntime } from "../instance/server-instance-runtime";
import { writeDiagnosticLog } from "../logging";
import { systemClock, type Clock } from "./clock";
import {
  isInstanceTickDue,
  recordInstanceTickCompletedAt
} from "./instance-scheduler";
import {
  recordRuntimeTickCompleted,
  recordRuntimeTickSkipped,
  runtimePerformanceNow
} from "../monitoring/runtime-performance-diagnostics";

/**
 * Responsibility: Executes one safe tick for a single instance runtime.
 * Belongs here: isolated tick execution, event publishing, and crash containment.
 * Does not belong here: instance lookup, transport routing, or registry logic.
 */
export const runInstanceTick = (
  runtime: ServerInstanceRuntime,
  clock: Clock = systemClock
): ServerInstanceRuntime => {
  if (!runtime.scheduler.isRunning || runtime.scheduler.tickInProgress) {
    if (runtime.scheduler.tickInProgress) recordRuntimeTickSkipped(runtime);
    return runtime;
  }
  const tickNow = clock.now();
  if (!isInstanceTickDue(runtime.scheduler, tickNow)) return runtime;

  const tickStartedAtMs = runtimePerformanceNow();
  let tickCompleted = false;
  runtime.scheduler.tickInProgress = true;
  runtime.runtimeHealth.lastTickStartedAt = clock.nowIso();

  try {
    const previousRootVersion = runtime.state.root.version;
    const result = runTick(runtime.state, {
      config: runtime.config
    });
    runtime.state = result.nextState.root.version > previousRootVersion
      ? result.nextState
      : {
          ...result.nextState,
          root: {
            ...result.nextState.root,
            version: previousRootVersion + 1
          }
        };

    for (const event of result.events) {
      runtime.eventQueue.enqueue(event);
    }

    const tickEvent: InstanceRuntimeEvent = {
      type: "tick-completed",
      payload: { tick: runtime.state.root.tick },
      occurredAt: clock.nowIso()
    };

    runtime.eventQueue.enqueue(tickEvent);
    runtime.eventPublisher.publish(tickEvent);
    runtime.runtimeHealth.lastTickCompletedAt = clock.nowIso();
    recordInstanceTickCompletedAt(runtime.scheduler, tickNow);
    tickCompleted = true;
    void writeDiagnosticLog(
      runtime.replayLogWriter,
      runtime.record.id,
      "info",
      "tick",
      "Tick completed.",
      {
        tick: runtime.state.root.tick
      },
      clock
    ).catch(() => undefined);

    return runtime;
  } catch (_error) {
    runtime.record.status = "crashed";
    runtime.record.crashCount += 1;
    runtime.scheduler.isRunning = false;
    runtime.runtimeHealth.lastErrorAt = clock.nowIso();
    void writeDiagnosticLog(
      runtime.replayLogWriter,
      runtime.record.id,
      "error",
      "crash",
      "Tick execution crashed.",
      {
        tick: readRuntimeTick(runtime)
      },
      clock
    ).catch(() => undefined);
    return runtime;
  } finally {
    runtime.scheduler.tickInProgress = false;
    if (tickCompleted) recordRuntimeTickCompleted(runtime, tickStartedAtMs);
  }
};

const readRuntimeTick = (runtime: ServerInstanceRuntime): number => {
  const root = runtime.state.root as { tick?: unknown } | null | undefined;
  const tick = Number(root?.tick ?? 0);
  return Number.isFinite(tick) ? tick : 0;
};
