import type { CasinoAuditRiskTierConfig, CasinoUpgradeConfig } from "./building-balance-config";

export interface CasinoBalanceConfig {
  buildingTypeId: string;
  countOnMap: number;
  category: string[];
  cleanCashPerMinute: number;
  dirtyCashPerMinute: number;
  influencePerMinute: number;
  heatPerMinute: number;
  launderingCapacity: number;
  baseAuditRiskPct: number;
  auditWindowMinutes: number;
  auditCheckEveryMinutes: number;
  quietBackroom: {
    actionId: string;
    cooldownMinutes: number;
    minimumDirtyCash: number;
    dirtyCashSharePct: number;
    maxDirtyCashPerAction: number;
    feePct: number;
    heatGain: number;
    influenceGain: number;
    auditRiskBonusPct: number;
    auditRiskDurationMinutes: number;
  };
  vipNight: {
    actionId: string;
    cooldownMinutes: number;
    durationMinutes: number;
    cleanIncomeBonusPct: number;
    dirtyIncomeBonusPct: number;
    influenceBonusPct: number;
    heatBonusPct: number;
    auditRiskBonusPct: number;
  };
  bribedInspector: {
    actionId: string;
    cooldownMinutes: number;
    cleanCashCost: number;
    protectionMinutes: number;
    failureChancePct: number;
    successHeatReduction: number;
    successAuditRiskReductionPct: number;
    successInfluenceGain: number;
    failureHeatGain: number;
    failureAuditRiskBonusPct: number;
    failureAuditRiskDurationMinutes: number;
  };
  auditRiskTiers: CasinoAuditRiskTierConfig[];
  auditConsequences: {
    lightInspection: { incomePenaltyPct: number; durationMinutes: number };
    seizedBooks: { dirtyCashLossPct: number };
    frozenAccounts: { launderingBlockedMinutes: number };
    policeRaid: { heatGain: number; incomePenaltyPct: number; durationMinutes: number };
    closedVipLounge: { vipBlockedMinutes: number };
  };
  upgrades: CasinoUpgradeConfig[];
}

export interface ExchangeOfficeBalanceConfig {
  id: string;
  buildingTypeId: string;
  countOnMap: number;
  category: string[];
  cleanCashPerMinute: number;
  dirtyCashPerMinute: number;
  influencePerMinute: number;
  heatPerMinute: number;
  launderingCapacity: number;
  baseAuditRiskPct: number;
  auditWindowMinutes: number;
  auditCheckEveryMinutes: number;
  network: {
    incomeBonusPctPerExtraExchange: number;
    launderingLimitBonusPctPerExtraExchange: number;
    heatBonusPctPerExtraExchange: number;
    maxIncomeMultiplier: number;
    maxLaunderingLimitMultiplier: number;
    maxHeatMultiplier: number;
  };
  goodRate: {
    actionId: string;
    cooldownMinutes: number;
    minimumDirtyCash: number;
    dirtyCashSharePct: number;
    maxDirtyCashPerAction: number;
    feePct: number;
    heatGain: number;
    influenceGain: number;
    auditRiskBonusPct: number;
    auditRiskDurationMinutes: number;
  };
  auditRiskTiers: CasinoAuditRiskTierConfig[];
  auditConsequences: {
    suspiciousTransaction: { incomePenaltyPct: number; durationMinutes: number };
    blockedTransfer: { actionBlockedMinutes: number };
    lostClient: { dirtyIncomePenaltyPct: number; durationMinutes: number };
    documentCheck: { heatGain: number };
    seizedCash: { dirtyCashLossPct: number };
  };
}

export interface ArcadeBalanceConfig {
  id: string;
  buildingTypeId: string;
  countOnMap: number;
  category: string[];
  cleanCashPerMinute: number;
  dirtyCashPerMinute: number;
  influencePerMinute: number;
  heatPerMinute: number;
  launderingCapacity: number;
  baseAuditRiskPct: number;
  auditWindowMinutes: number;
  auditCheckEveryMinutes: number;
  network: {
    incomeBonusPctPerExtraArcade: number;
    launderingLimitBonusPctPerExtraArcade: number;
    heatBonusPctPerExtraArcade: number;
    maxIncomeMultiplier: number;
    maxLaunderingLimitMultiplier: number;
    maxHeatMultiplier: number;
  };
  nightMachines: {
    actionId: string;
    cooldownMinutes: number;
    durationMinutes: number;
    cleanIncomeBonusPct: number;
    dirtyIncomeBonusPct: number;
    influenceBonusPct: number;
    heatBonusPct: number;
    auditRiskBonusPct: number;
  };
  backCashdesk: {
    actionId: string;
    cooldownMinutes: number;
    minimumDirtyCash: number;
    dirtyCashSharePct: number;
    maxDirtyCashPerAction: number;
    feePct: number;
    heatGain: number;
    influenceGain: number;
    auditRiskBonusPct: number;
    auditRiskDurationMinutes: number;
  };
  auditRiskTiers: CasinoAuditRiskTierConfig[];
  auditConsequences: {
    machineInspection: { incomePenaltyPct: number; durationMinutes: number };
    seizedMachine: { dirtyIncomePenaltyPct: number; durationMinutes: number };
    closedBackRoom: { actionBlockedMinutes: number };
    operatingFine: { cleanCashLoss: number };
    localRaid: { heatGain: number };
  };
}
