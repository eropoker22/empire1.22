import type { CasinoBalanceConfig } from "../contracts/balance-config";

export const freeModeCasinoConfig: CasinoBalanceConfig = {
  buildingTypeId: "casino",
  countOnMap: 3,
  category: ["economy", "laundering", "high-risk"],
  cleanCashPerMinute: 4500 / 60,
  dirtyCashPerMinute: 2500 / 60,
  influencePerMinute: 110 / (60 * 24),
  heatPerMinute: 150 / (60 * 24),
  launderingCapacity: 18000,
  baseAuditRiskPct: 8,
  auditWindowMinutes: 30,
  auditCheckEveryMinutes: 5,
  quietBackroom: {
    actionId: "quiet_backroom",
    cooldownMinutes: 14,
    minimumDirtyCash: 1500,
    dirtyCashSharePct: 24,
    maxDirtyCashPerAction: 18000,
    feePct: 9,
    heatGain: 7,
    influenceGain: 3,
    auditRiskBonusPct: 6,
    auditRiskDurationMinutes: 10
  },
  vipNight: {
    actionId: "vip_night",
    cooldownMinutes: 26,
    durationMinutes: 10,
    cleanIncomeBonusPct: 70,
    dirtyIncomeBonusPct: 55,
    influenceBonusPct: 25,
    heatBonusPct: 60,
    auditRiskBonusPct: 8
  },
  bribedInspector: {
    actionId: "bribed_inspector",
    cooldownMinutes: 105,
    cleanCashCost: 15000,
    protectionMinutes: 12,
    failureChancePct: 14,
    successHeatReduction: 15,
    successAuditRiskReductionPct: 35,
    successInfluenceGain: 4,
    failureHeatGain: 12,
    failureAuditRiskBonusPct: 10,
    failureAuditRiskDurationMinutes: 8
  },
  auditRiskTiers: [
    { maxLaunderedAmount: 5000, riskPct: 6 },
    { maxLaunderedAmount: 12000, riskPct: 13 },
    { maxLaunderedAmount: 25000, riskPct: 24 },
    { maxLaunderedAmount: 45000, riskPct: 38 },
    { maxLaunderedAmount: null, riskPct: 55 }
  ],
  auditConsequences: {
    lightInspection: { incomePenaltyPct: 10, durationMinutes: 8 },
    seizedBooks: { dirtyCashLossPct: 12 },
    frozenAccounts: { launderingBlockedMinutes: 8 },
    policeRaid: { heatGain: 20, incomePenaltyPct: 20, durationMinutes: 10 },
    closedVipLounge: { vipBlockedMinutes: 12 }
  },
  upgrades: [
    { level: 1, cleanCashCost: 0, incomeBonusPct: 0, launderingLimitBonusPct: 0 },
    { level: 2, cleanCashCost: 7500, techCoreCost: 3, incomeBonusPct: 12, launderingLimitBonusPct: 8 },
    { level: 3, cleanCashCost: 18000, techCoreCost: 7, incomeBonusPct: 25, launderingLimitBonusPct: 16, feeReductionPct: 2 },
    { level: 4, cleanCashCost: 38000, techCoreCost: 14, combatModuleCost: 3, incomeBonusPct: 40, launderingLimitBonusPct: 25, actionHeatReductionPct: 8 }
  ]
};
