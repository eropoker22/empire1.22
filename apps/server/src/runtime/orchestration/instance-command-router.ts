import type { GameCommand } from "@empire/shared-types";
import type { ServerInstanceManager } from "../server-instance-manager";
import type { CommandDispatchOptions } from "./command-dispatch-options";

/**
 * Responsibility: Routes command ingress requests to the authoritative target instance.
 * Belongs here: instance existence checks and dispatch delegation.
 * Does not belong here: transport parsing or gameplay rules.
 */
export interface InstanceCommandRouter {
  dispatch(
    instanceId: string,
    command: GameCommand,
    options?: CommandDispatchOptions
  ): ReturnType<ServerInstanceManager["dispatchCommand"]>;
}

export const createInstanceCommandRouter = (
  instanceManager: ServerInstanceManager
): InstanceCommandRouter => ({
  dispatch: async (instanceId, command, options) => {
    const target = instanceManager.getInstanceById(instanceId);
    return target ? instanceManager.dispatchCommand(instanceId, command, options) : undefined;
  }
});
