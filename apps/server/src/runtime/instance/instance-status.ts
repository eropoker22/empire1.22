/**
 * Responsibility: Shared lifecycle statuses for one server instance runtime.
 * Belongs here: explicit runtime lifecycle states used by manager and monitoring.
 * Does not belong here: transition side effects or persistence mechanics.
 */
export type InstanceStatus =
  | "created"
  | "lobby"
  | "booting"
  | "running"
  | "pausing"
  | "paused"
  | "full"
  | "stopping"
  | "stopped"
  | "ended"
  | "restarting"
  | "destroying"
  | "destroyed"
  | "crashed";
