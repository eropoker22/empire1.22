import type { ServerInstanceManager } from "../server-instance-manager";

/**
 * Responsibility: Coordinates snapshot persistence across active instances.
 * Belongs here: orchestration of snapshot scheduling separate from gameplay logic.
 * Does not belong here: storage implementation or command handling.
 */
export interface SnapshotOrchestrator {
  saveActiveInstances(): Promise<void>;
}

export const createSnapshotOrchestrator = (
  instanceManager: ServerInstanceManager
): SnapshotOrchestrator => ({
  saveActiveInstances: async () => {
    for (const runtime of instanceManager.listActiveInstances()) {
      await runtime.snapshotController.save(runtime);
    }
  }
});
