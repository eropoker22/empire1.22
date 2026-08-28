import type { PoliceSystemBalanceConfig } from "../contracts/police-balance-config";

export const basePoliceConfig: PoliceSystemBalanceConfig = {
  districtHeatPerHourByZone: {
    park: 3,
    commercial: 1,
    industrial: 1,
    downtown: 5,
    residential: 2
  },
  spyActionHeatGain: 2,
  districtHeatWeight: 1,
  highPressureRaidThreshold: 100,
  extremePressureRaidThreshold: 140,
  districtTargetHeatThreshold: 60,
  raidCooldownTicks: 4,
  raidDurationTicks: 360,
  pendingRaidTtlTicks: 360,
  maxPendingRaidsPerPlayer: 1,
  maxConcurrentRaidsByPhase: {
    day: 2,
    night: 1
  },
  raidSeverityThresholds: { low: 0, medium: 60, high: 100, extreme: 140 },
  dirtyCashSeizurePercentBySeverity: { low: 0, medium: 0.08, high: 0.18, extreme: 0.32 },
  resourceSeizurePercentBySeverity: { low: 0, medium: 0, high: 0.08, extreme: 0.16 },
  lockdownTicksBySeverity: { low: 0, medium: 0, high: 2, extreme: 4 },
  buildingDisruptionTicksBySeverity: { low: 0, medium: 0, high: 1, extreme: 3 },
  heatReductionBySeverity: { low: 0, medium: 10, high: 25, extreme: 45 },
  maxPoliticalRaidTriggerReductionPct: 45,
  extremePoliticalRaidReductionMultiplier: 0.5,
  protectedResources: ["cash", "population"],
  autoResolveExpiredPendingRaids: true
};
