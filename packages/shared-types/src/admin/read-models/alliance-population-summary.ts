/**
 * Responsibility: Admin-safe summary of alliance population for one instance.
 * Belongs here: aggregate alliance counts for monitoring and live ops.
 * Does not belong here: alliance domain rules or membership authority.
 */
export interface AlliancePopulationSummary {
  instanceId: string;
  totalAlliances: number;
}

