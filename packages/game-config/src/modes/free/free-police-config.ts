import type { PoliceSystemBalanceConfig } from "../../contracts/police-balance-config";
import { ticksFromMinutes } from "./free-mode-timing";

const FREE_MODE_RAID_DURATION_TICKS = ticksFromMinutes(60);

export const freeModePoliceConfig: PoliceSystemBalanceConfig = {
  districtHeatPerHourByZone: {
    park: 3,
    commercial: 1,
    industrial: 1,
    downtown: 5,
    residential: 2
  },
  spyActionHeatGain: 2,
  districtHeatWeight: 0.9,
  highPressureRaidThreshold: 115,
  extremePressureRaidThreshold: 180,
  districtTargetHeatThreshold: 70,
  raidCooldownTicks: ticksFromMinutes(240),
  raidDurationTicks: FREE_MODE_RAID_DURATION_TICKS,
  pendingRaidTtlTicks: FREE_MODE_RAID_DURATION_TICKS,
  maxPendingRaidsPerPlayer: 1,
  maxConcurrentRaidsByPhase: {
    day: 1,
    night: 1
  },
  raidSeverityThresholds: { low: 0, medium: 30, high: 115, extreme: 180 },
  dirtyCashSeizurePercentBySeverity: { low: 0, medium: 0.05, high: 0.12, extreme: 0.22 },
  resourceSeizurePercentBySeverity: { low: 0, medium: 0, high: 0.05, extreme: 0.1 },
  lockdownTicksBySeverity: {
    low: 0,
    medium: 0,
    high: ticksFromMinutes(8),
    extreme: ticksFromMinutes(15)
  },
  buildingDisruptionTicksBySeverity: {
    low: 0,
    medium: 0,
    high: ticksFromMinutes(5),
    extreme: ticksFromMinutes(10)
  },
  heatReductionBySeverity: { low: 0, medium: 8, high: 30, extreme: 55 },
  maxPoliticalRaidTriggerReductionPct: 45,
  extremePoliticalRaidReductionMultiplier: 0.5,
  protectedResources: ["cash", "population"],
  autoResolveExpiredPendingRaids: true
};
