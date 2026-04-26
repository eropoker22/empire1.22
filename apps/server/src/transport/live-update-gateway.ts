import type { InstanceRuntimeEvent } from "@empire/shared-types";

/**
 * Responsibility: Transport-facing boundary for future websocket/live update fanout.
 * Belongs here: subscription/publish contracts at the edge of the server app.
 * Does not belong here: gameplay logic or instance state mutation.
 */
export interface LiveUpdateGateway {
  publish(instanceId: string, event: InstanceRuntimeEvent): void;
}

export const createLiveUpdateGateway = (): LiveUpdateGateway => ({
  publish: (_instanceId, _event) => {
    return;
  }
});

