import { runTick } from "@empire/game-core";
import type { InstanceRuntimeEvent } from "@empire/shared-types";
import type { ServerInstanceRuntime } from "../instance/server-instance-runtime";
import { writeDiagnosticLog } from "../logging";
import { systemClock, type Clock } from "./clock";

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
    return runtime;
  }

  runtime.scheduler.tickInProgress = true;
  runtime.runtimeHealth.lastTickStartedAt = clock.nowIso();

  try {
    const result = runTick(runtime.state, {
      config: runtime.config
    });
    runtime.state = result.nextState;

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
    );

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
    );
    return runtime;
  } finally {
    runtime.scheduler.tickInProgress = false;
  }
};

const readRuntimeTick = (runtime: ServerInstanceRuntime): number => {
  const root = runtime.state.root as { tick?: unknown } | null | undefined;
  const tick = Number(root?.tick ?? 0);
  return Number.isFinite(tick) ? tick : 0;
};
