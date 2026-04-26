import type { InstanceRuntimeEvent } from "@empire/shared-types";

/**
 * Responsibility: Publish/subscribe boundary for per-instance live runtime events.
 * Belongs here: event publication contracts for websocket and monitoring layers.
 * Does not belong here: transport-specific connection management or business logic.
 */
export interface InstanceEventPublisher {
  publish(event: InstanceRuntimeEvent): void;
}

export const createNullInstanceEventPublisher = (): InstanceEventPublisher => ({
  publish: (_event) => {
    return;
  }
});

