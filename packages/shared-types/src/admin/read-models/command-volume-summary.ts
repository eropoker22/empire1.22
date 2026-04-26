/**
 * Responsibility: Summarizes command activity volume for monitoring and audit panels.
 * Belongs here: command counts over a read-only monitoring window.
 * Does not belong here: raw command payload history.
 */
export interface CommandVolumeSummary {
  instanceId: string;
  totalCommands: number;
}

