import type { InstanceAdminCommand } from "@empire/shared-types";

/**
 * Responsibility: Client-side boundary for dispatching admin-only operations.
 * Belongs here: isolated admin command transport seam separate from player commands.
 * Does not belong here: read-model logic or gameplay rules.
 */
export interface AdminCommandBoundary {
  execute(command: InstanceAdminCommand): void;
}

