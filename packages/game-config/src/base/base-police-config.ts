import type { PoliceSystemBalanceConfig } from "../contracts/police-balance-config";

export const basePoliceConfig: PoliceSystemBalanceConfig = {
  districtHeatWeight: 1,
  highPressureRaidThreshold: 100,
  extremePressureRaidThreshold: 140,
  districtTargetHeatThreshold: 60,
  raidCooldownTicks: 4,
  pendingRaidTtlTicks: 2,
  maxPendingRaidsPerPlayer: 1,
  raidSeverityThresholds: { low: 0, medium: 60, high: 100, extreme: 140 },
  dirtyCashSeizurePercentBySeverity: { low: 0, medium: 0.08, high: 0.18, extreme: 0.32 },
  resourceSeizurePercentBySeverity: { low: 0, medium: 0, high: 0.08, extreme: 0.16 },
  lockdownTicksBySeverity: { low: 0, medium: 0, high: 2, extreme: 4 },
  buildingDisruptionTicksBySeverity: { low: 0, medium: 0, high: 1, extreme: 3 },
  heatReductionBySeverity: { low: 0, medium: 10, high: 25, extreme: 45 },
  protectedResources: ["cash", "gang-members", "population"],
  autoResolveExpiredPendingRaids: true
};
