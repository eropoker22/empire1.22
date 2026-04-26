import type { InstanceAdminCommand } from "@empire/shared-types";
import type { AdminCommandBoundary } from "./admin-command-boundary";

/**
 * Responsibility: Dispatches admin operations through the dedicated admin command boundary.
 * Belongs here: admin command submission flow only.
 * Does not belong here: admin read-model composition or gameplay logic.
 */
export interface AdminCommandDispatcher {
  dispatch(command: InstanceAdminCommand): void;
}

export const createAdminCommandDispatcher = (
  boundary: AdminCommandBoundary
): AdminCommandDispatcher => ({
  dispatch: (command) => boundary.execute(command)
});

