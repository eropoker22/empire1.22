import type { PoliceSystemBalanceConfig } from "../../contracts/police-balance-config";

export const freeModePoliceConfig: PoliceSystemBalanceConfig = {
  districtHeatWeight: 0.9,
  highPressureRaidThreshold: 115,
  extremePressureRaidThreshold: 180,
  districtTargetHeatThreshold: 70,
  raidCooldownTicks: 360,
  pendingRaidTtlTicks: 12,
  maxPendingRaidsPerPlayer: 1,
  raidSeverityThresholds: { low: 0, medium: 30, high: 115, extreme: 180 },
  dirtyCashSeizurePercentBySeverity: { low: 0, medium: 0.05, high: 0.12, extreme: 0.22 },
  resourceSeizurePercentBySeverity: { low: 0, medium: 0, high: 0.05, extreme: 0.1 },
  lockdownTicksBySeverity: { low: 0, medium: 0, high: 12, extreme: 24 },
  buildingDisruptionTicksBySeverity: { low: 0, medium: 0, high: 6, extreme: 18 },
  heatReductionBySeverity: { low: 0, medium: 8, high: 30, extreme: 55 },
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
