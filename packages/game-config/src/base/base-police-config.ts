import type { PoliceSystemBalanceConfig } from "../contracts/police-balance-config";

export const basePoliceConfig: PoliceSystemBalanceConfig = {
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
  heatDecay: {
    playerIntervalTicks: 30,
    playerDecayByWantedLevel: { 0: 4, 1: 3, 2: 2, 3: 1, 4: 1, 5: 1 },
    districtIntervalTicks: 60,
    districtBaseDecay: 3,
    districtHighPassiveHeatPerDayThreshold: 100,
    districtHighPassiveHeatMultiplier: 0.5,
    districtLockdownDecayMultiplier: 1.25
  },
  maxPoliticalRaidTriggerReductionPct: 45,
  extremePoliticalRaidReductionMultiplier: 0.5,
  protectedResources: ["cash", "gang-members", "population"],
  autoResolveExpiredPendingRaids: true
};
