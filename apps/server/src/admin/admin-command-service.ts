import type { InstanceAdminCommand } from "@empire/shared-types";
import type { ServerInstanceManager } from "../runtime";

/**
 * Responsibility: Server-side admin command boundary kept separate from player commands.
 * Belongs here: controlled server operations such as pause, restart, and force snapshot.
 * Does not belong here: gameplay player actions or direct game-core mutation.
 */
export const createServerAdminCommandService = (instanceManager: ServerInstanceManager) => ({
  execute(command: InstanceAdminCommand): void {
    switch (command.type) {
      case "pause-instance":
        instanceManager.pauseInstance(command.instanceId);
        return;
      case "resume-instance":
        instanceManager.startInstance(command.instanceId);
        return;
      case "restart-instance":
        instanceManager.restartInstance(command.instanceId);
        return;
      case "force-snapshot":
        void instanceManager.saveInstanceSnapshot(command.instanceId);
        return;
      case "inspect-logs":
      case "emergency-disable-joins":
        return;
    }
  }
});

