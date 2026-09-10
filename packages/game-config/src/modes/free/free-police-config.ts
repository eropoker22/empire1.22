import type { PoliceSystemBalanceConfig } from "../../contracts/police-balance-config";
import { ticksFromMinutes } from "./free-mode-timing";

const FREE_MODE_RAID_DURATION_TICKS = ticksFromMinutes(60);

export const freeModePoliceConfig: PoliceSystemBalanceConfig = {
  heatReduction: {
    globalCooldownTicks: ticksFromMinutes(10),
    auditWindowTicks: ticksFromMinutes(30),
    auditRiskPerRecentActionPct: 5,
    maxAuditRiskPct: 50,
    auditHeatGain: 5,
    auditFinePct: 25,
    methods: {
      dirty: { cost: 2500, heatReduction: 15, cooldownTicks: ticksFromMinutes(20), baseAuditRiskPct: 20 },
      clean: { cost: 5000, heatReduction: 25, cooldownTicks: ticksFromMinutes(30), baseAuditRiskPct: 5 },
      influence: { cost: 20, heatReduction: 25, cooldownTicks: ticksFromMinutes(45), baseAuditRiskPct: 0 }
    }
  },
  districtHeatPerHourByZone: {
    park: 3,
    commercial: 1,
    industrial: 1,
    downtown: 5,
    residential: 2
  },
  spyActionHeatGain: 2,
  districtHeatWeight: 0.9,
  districtPressureCap: 75,
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
