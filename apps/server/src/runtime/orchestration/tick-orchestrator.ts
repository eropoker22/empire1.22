import type { ServerInstanceManager } from "../server-instance-manager";

/**
 * Responsibility: Coordinates ticking across multiple isolated instances.
 * Belongs here: multi-instance tick iteration and future timer integration.
 * Does not belong here: gameplay tick logic or websocket fanout.
 */
export interface TickOrchestrator {
  tickActiveInstances(): void | Promise<void>;
}

export const createTickOrchestrator = (
  instanceManager: ServerInstanceManager
): TickOrchestrator => ({
  tickActiveInstances: () => {
    const tickLock = instanceManager.getPersistenceRepositories().tickLock;
    if (tickLock) {
      return Promise.all(
        instanceManager.listActiveInstances().map((runtime) =>
          tickLock.withTickLock(runtime.record.id, () => {
            instanceManager.tickInstance(runtime.record.id);
          })
        )
      ).then(() => undefined);
    }

    for (const runtime of instanceManager.listActiveInstances()) {
      instanceManager.tickInstance(runtime.record.id);
    }
  }
});
