export type PoliceRaidSeverityKey = "low" | "medium" | "high" | "extreme";
export type PoliceRaidPhaseKey = "day" | "night";

export interface PoliceSystemBalanceConfig {
  heatReduction?: {
    globalCooldownTicks: number;
    auditWindowTicks: number;
    auditRiskPerRecentActionPct: number;
    maxAuditRiskPct: number;
    auditHeatGain: number;
    auditFinePct: number;
    methods: Record<"dirty" | "clean" | "influence", { cost: number; heatReduction: number; cooldownTicks: number; baseAuditRiskPct: number }>;
  };
  districtHeatPerHourByZone: Record<string, number>;
  spyActionHeatGain: number;
  districtHeatWeight: number;
  districtPressureCap?: number;
  highPressureRaidThreshold: number;
  extremePressureRaidThreshold: number;
  districtTargetHeatThreshold: number;
  raidCooldownTicks: number;
  raidDurationTicks: number;
  pendingRaidTtlTicks: number;
  maxPendingRaidsPerPlayer: number;
  maxConcurrentRaidsByPhase: Record<PoliceRaidPhaseKey, number>;
  raidSeverityThresholds: Record<PoliceRaidSeverityKey, number>;
  dirtyCashSeizurePercentBySeverity: Record<PoliceRaidSeverityKey, number>;
  resourceSeizurePercentBySeverity: Record<PoliceRaidSeverityKey, number>;
  lockdownTicksBySeverity: Record<PoliceRaidSeverityKey, number>;
  buildingDisruptionTicksBySeverity: Record<PoliceRaidSeverityKey, number>;
  heatReductionBySeverity: Record<PoliceRaidSeverityKey, number>;
  maxPoliticalRaidTriggerReductionPct?: number;
  extremePoliticalRaidReductionMultiplier?: number;
  protectedResources?: string[];
  maxSeizedPerRaid?: number;
  autoResolveExpiredPendingRaids?: boolean;
}
