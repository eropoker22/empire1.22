import type { ExchangeOfficeBalanceConfig } from "../contracts/balance-config";

export const freeModeExchangeOfficeConfig: ExchangeOfficeBalanceConfig = {
  id: "exchange_office",
  buildingTypeId: "exchange",
  countOnMap: 11,
  category: ["economy", "laundering", "network"],
  cleanCashPerMinute: 70,
  dirtyCashPerMinute: 95,
  influencePerMinute: 0.28,
  heatPerMinute: 0.16,
  launderingCapacity: 6000,
  baseAuditRiskPct: 4,
  auditWindowMinutes: 30,
  auditCheckEveryMinutes: 6,
  network: {
    incomeBonusPctPerExtraExchange: 8,
    launderingLimitBonusPctPerExtraExchange: 10,
    heatBonusPctPerExtraExchange: 4,
    maxIncomeMultiplier: 1.48,
    maxLaunderingLimitMultiplier: 1.6,
    maxHeatMultiplier: 1.24
  },
  goodRate: {
    actionId: "good_rate",
    cooldownMinutes: 11,
    minimumDirtyCash: 800,
    dirtyCashSharePct: 16,
    maxDirtyCashPerAction: 6000,
    feePct: 12,
    heatGain: 4,
    influenceGain: 1.5,
    auditRiskBonusPct: 4,
    auditRiskDurationMinutes: 8
  },
  auditRiskTiers: [
    { maxLaunderedAmount: 3000, riskPct: 4 },
    { maxLaunderedAmount: 8000, riskPct: 9 },
    { maxLaunderedAmount: 16000, riskPct: 17 },
    { maxLaunderedAmount: 30000, riskPct: 28 },
    { maxLaunderedAmount: null, riskPct: 42 }
  ],
  auditConsequences: {
    suspiciousTransaction: { incomePenaltyPct: 8, durationMinutes: 8 },
    blockedTransfer: { actionBlockedMinutes: 7 },
    lostClient: { dirtyIncomePenaltyPct: 10, durationMinutes: 10 },
    documentCheck: { heatGain: 10 },
    seizedCash: { dirtyCashLossPct: 8 }
  }
};
