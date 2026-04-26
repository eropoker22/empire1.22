import type { ServerInstanceManager } from "../server-instance-manager";

/**
 * Responsibility: Aggregates instance health for diagnostics and admin monitoring.
 * Belongs here: read-only health summary across active and inactive instances.
 * Does not belong here: lifecycle mutation or game state logic.
 */
export interface InstanceHealthService {
  getSummary(): {
    totalInstances: number;
    runningInstances: number;
    crashedInstances: number;
  };
}

export const createInstanceHealthService = (
  instanceManager: ServerInstanceManager
): InstanceHealthService => ({
  getSummary: () => {
    const instances = instanceManager.listInstances();
    return {
      totalInstances: instances.length,
      runningInstances: instances.filter((runtime) => runtime.record.status === "running").length,
      crashedInstances: instances.filter((runtime) => runtime.record.status === "crashed").length
    };
  }
});

