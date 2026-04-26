/**
 * Responsibility: Admin-safe overview of one server instance for list pages and monitoring.
 * Belongs here: compact instance metadata and operational counters for read-only display.
 * Does not belong here: raw authoritative game state or runtime-only mutable objects.
 */
export interface InstanceSummary {
  instanceId: string;
  mode: string;
  status: string;
  tick: number;
  playerCount: number;
  allianceCount: number;
}

