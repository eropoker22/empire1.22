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
  heatDecay?: PoliceHeatDecayConfig;
  maxPoliticalRaidTriggerReductionPct?: number;
  extremePoliticalRaidReductionMultiplier?: number;
  protectedResources?: string[];
  maxSeizedPerRaid?: number;
  autoResolveExpiredPendingRaids?: boolean;
}

export interface PoliceHeatDecayConfig {
  playerIntervalTicks: number;
  playerDecayByWantedLevel: Partial<Record<0 | 1 | 2 | 3 | 4 | 5, number>>;
  districtIntervalTicks: number;
  districtBaseDecay: number;
  districtHighPassiveHeatPerDayThreshold?: number;
  districtHighPassiveHeatMultiplier?: number;
  districtLockdownDecayMultiplier?: number;
}
