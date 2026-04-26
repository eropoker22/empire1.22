import type { ServerInstanceRuntime } from "../instance/server-instance-runtime";

/**
 * Responsibility: Computes lightweight health diagnostics for one runtime instance.
 * Belongs here: health status, warning messages, and crash/tick guards.
 * Does not belong here: alert transport, logging sinks, or raw state mutation.
 */
export interface InstanceHealth {
  status: "healthy" | "degraded" | "unhealthy";
  warnings: string[];
  lastErrorAt: string | null;
}

export const getInstanceHealth = (runtime: ServerInstanceRuntime): InstanceHealth => {
  const warnings: string[] = [];

  if (runtime.record.status === "crashed") {
    warnings.push("Instance is crashed.");
  }

  if (runtime.scheduler.tickInProgress) {
    warnings.push("Tick is currently in progress.");
  }

  if (runtime.eventQueue.size() > 1000) {
    warnings.push("Event queue is unusually large.");
  }

  if (runtime.record.crashCount > 0) {
    warnings.push("Instance has recorded crashes.");
  }

  if (runtime.record.status === "crashed") {
    return {
      status: "unhealthy",
      warnings,
      lastErrorAt: runtime.runtimeHealth.lastErrorAt
    };
  }

  if (warnings.length > 0) {
    return {
      status: "degraded",
      warnings,
      lastErrorAt: runtime.runtimeHealth.lastErrorAt
    };
  }

  return {
    status: "healthy",
    warnings,
    lastErrorAt: runtime.runtimeHealth.lastErrorAt
  };
};

