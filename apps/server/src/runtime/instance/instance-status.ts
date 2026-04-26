/**
 * Responsibility: Shared lifecycle statuses for one server instance runtime.
 * Belongs here: explicit runtime lifecycle states used by manager and monitoring.
 * Does not belong here: transition side effects or persistence mechanics.
 */
export type InstanceStatus =
  | "created"
  | "booting"
  | "running"
  | "pausing"
  | "paused"
  | "stopping"
  | "stopped"
  | "restarting"
  | "destroying"
  | "destroyed"
  | "crashed";

