import type { ArcadeBalanceConfig } from "../contracts/balance-config";

export const freeModeArcadeConfig: ArcadeBalanceConfig = {
  id: "arcade",
  buildingTypeId: "arcade",
  countOnMap: 20,
  category: ["economy", "dirty_cash", "laundering", "network"],
  cleanCashPerMinute: 42,
  dirtyCashPerMinute: 72,
  influencePerMinute: 0.18,
  heatPerMinute: 0.12,
  launderingCapacity: 3800,
  baseAuditRiskPct: 3,
  auditWindowMinutes: 30,
  auditCheckEveryMinutes: 7,
  network: {
    incomeBonusPctPerExtraArcade: 5,
    launderingLimitBonusPctPerExtraArcade: 6,
    heatBonusPctPerExtraArcade: 3,
    maxIncomeMultiplier: 1.45,
    maxLaunderingLimitMultiplier: 1.55,
    maxHeatMultiplier: 1.27
  },
  nightMachines: {
    actionId: "night_machines",
    cooldownMinutes: 16,
    durationMinutes: 7,
    cleanIncomeBonusPct: 35,
    dirtyIncomeBonusPct: 65,
    influenceBonusPct: 15,
    heatBonusPct: 45,
    auditRiskBonusPct: 4
  },
  backCashdesk: {
    actionId: "back_cashdesk",
    cooldownMinutes: 12,
    minimumDirtyCash: 500,
    dirtyCashSharePct: 13,
    maxDirtyCashPerAction: 3800,
    feePct: 15,
    heatGain: 3,
    influenceGain: 1,
    auditRiskBonusPct: 3,
    auditRiskDurationMinutes: 8
  },
  auditRiskTiers: [
    { maxLaunderedAmount: 2000, riskPct: 3 },
    { maxLaunderedAmount: 6000, riskPct: 7 },
    { maxLaunderedAmount: 12000, riskPct: 14 },
    { maxLaunderedAmount: 24000, riskPct: 24 },
    { maxLaunderedAmount: null, riskPct: 36 }
  ],
  auditConsequences: {
    machineInspection: { incomePenaltyPct: 6, durationMinutes: 8 },
    seizedMachine: { dirtyIncomePenaltyPct: 8, durationMinutes: 10 },
    closedBackRoom: { actionBlockedMinutes: 7 },
    operatingFine: { cleanCashLoss: 1200 },
    localRaid: { heatGain: 8 }
  }
};
