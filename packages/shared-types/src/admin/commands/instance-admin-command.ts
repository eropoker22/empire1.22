import type { AdminCommand } from "./admin-command";

/**
 * Responsibility: Union of instance-scoped admin operations.
 * Belongs here: transport-safe admin operation requests for server control actions.
 * Does not belong here: player gameplay actions or admin read-models.
 */
export type PauseInstanceCommand = AdminCommand<"pause-instance">;
export type ResumeInstanceCommand = AdminCommand<"resume-instance">;
export type RestartInstanceCommand = AdminCommand<"restart-instance">;
export type ForceSnapshotCommand = AdminCommand<"force-snapshot">;
export type InspectLogsCommand = AdminCommand<"inspect-logs", { limit: number }>;
export type EmergencyDisableJoinsCommand = AdminCommand<
  "emergency-disable-joins",
  { disabled: boolean }
>;

export type InstanceAdminCommand =
  | PauseInstanceCommand
  | ResumeInstanceCommand
  | RestartInstanceCommand
  | ForceSnapshotCommand
  | InspectLogsCommand
  | EmergencyDisableJoinsCommand;

