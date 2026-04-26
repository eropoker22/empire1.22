import type { ServerInstanceManager } from "../server-instance-manager";

/**
 * Responsibility: Coordinates ticking across multiple isolated instances.
 * Belongs here: multi-instance tick iteration and future timer integration.
 * Does not belong here: gameplay tick logic or websocket fanout.
 */
export interface TickOrchestrator {
  tickActiveInstances(): void;
}

export const createTickOrchestrator = (
  instanceManager: ServerInstanceManager
): TickOrchestrator => ({
  tickActiveInstances: () => {
    for (const runtime of instanceManager.listActiveInstances()) {
      instanceManager.tickInstance(runtime.record.id);
    }
  }
});

