import { runTick } from "@empire/game-core";
import type { InstanceRuntimeEvent } from "@empire/shared-types";
import type { ServerInstanceRuntime } from "../instance/server-instance-runtime";
import { writeDiagnosticLog } from "../logging";

/**
 * Responsibility: Executes one safe tick for a single instance runtime.
 * Belongs here: isolated tick execution, event publishing, and crash containment.
 * Does not belong here: instance lookup, transport routing, or registry logic.
 */
export const runInstanceTick = (runtime: ServerInstanceRuntime): ServerInstanceRuntime => {
  if (!runtime.scheduler.isRunning || runtime.scheduler.tickInProgress) {
    return runtime;
  }

  runtime.scheduler.tickInProgress = true;
  runtime.runtimeHealth.lastTickStartedAt = new Date(0).toISOString();

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
      occurredAt: new Date(0).toISOString()
    };

    runtime.eventQueue.enqueue(tickEvent);
    runtime.eventPublisher.publish(tickEvent);
    runtime.runtimeHealth.lastTickCompletedAt = new Date(0).toISOString();
    void writeDiagnosticLog(
      runtime.replayLogWriter,
      runtime.record.id,
      "info",
      "tick",
      "Tick completed.",
      {
        tick: runtime.state.root.tick
      }
    );

    return runtime;
  } catch (_error) {
    runtime.record.status = "crashed";
    runtime.record.crashCount += 1;
    runtime.scheduler.isRunning = false;
    runtime.runtimeHealth.lastErrorAt = new Date(0).toISOString();
    void writeDiagnosticLog(
      runtime.replayLogWriter,
      runtime.record.id,
      "error",
      "crash",
      "Tick execution crashed.",
      {
        tick: runtime.state.root.tick
      }
    );
    return runtime;
  } finally {
    runtime.scheduler.tickInProgress = false;
  }
};
