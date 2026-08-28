export type RaidTriggerDecisionType =
  | "no_raid"
  | "warning_only"
  | "pending_raid_created"
  | "political_cover_delayed"
  | "existing_pending_raid_kept"
  | "concurrent_raid_limit_active"
  | "cooldown_active";

export interface RaidTriggerDecision {
  playerId: string;
  type: RaidTriggerDecisionType;
  aggregatePressure: number;
  raidId?: string;
}
