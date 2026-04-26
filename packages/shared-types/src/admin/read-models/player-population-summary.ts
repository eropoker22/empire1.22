/**
 * Responsibility: Admin-safe summary of player population for one instance.
 * Belongs here: current active/connected counts for capacity monitoring.
 * Does not belong here: private player inventories or raw entity payloads.
 */
export interface PlayerPopulationSummary {
  instanceId: string;
  totalPlayers: number;
  connectedPlayers: number;
}

