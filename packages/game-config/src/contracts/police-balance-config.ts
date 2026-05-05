export type PoliceRaidSeverityKey = "low" | "medium" | "high" | "extreme";

export interface PoliceSystemBalanceConfig {
  districtHeatWeight: number;
  highPressureRaidThreshold: number;
  extremePressureRaidThreshold: number;
  districtTargetHeatThreshold: number;
  raidCooldownTicks: number;
  pendingRaidTtlTicks: number;
  maxPendingRaidsPerPlayer: number;
  raidSeverityThresholds: Record<PoliceRaidSeverityKey, number>;
  dirtyCashSeizurePercentBySeverity: Record<PoliceRaidSeverityKey, number>;
  resourceSeizurePercentBySeverity: Record<PoliceRaidSeverityKey, number>;
  lockdownTicksBySeverity: Record<PoliceRaidSeverityKey, number>;
  buildingDisruptionTicksBySeverity: Record<PoliceRaidSeverityKey, number>;
  heatReductionBySeverity: Record<PoliceRaidSeverityKey, number>;
  protectedResources?: string[];
  maxSeizedPerRaid?: number;
  autoResolveExpiredPendingRaids?: boolean;
}
