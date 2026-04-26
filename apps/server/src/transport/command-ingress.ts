import type { GameCommand } from "@empire/shared-types";
import type { InstanceCommandRouter } from "../runtime/orchestration/instance-command-router";

/**
 * Responsibility: Player/admin command ingress boundary into the authoritative server.
 * Belongs here: instance lookup delegation and transport-safe result shaping.
 * Does not belong here: gameplay rules or direct state mutation.
 */
export interface ServerCommandIngress {
  submit(command: GameCommand): ReturnType<InstanceCommandRouter["dispatch"]>;
}

export const createCommandIngress = (
  commandRouter: InstanceCommandRouter
): ServerCommandIngress => ({
  submit: (command) => commandRouter.dispatch(command.serverInstanceId, command)
});
