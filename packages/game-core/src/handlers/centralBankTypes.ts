import type { BuildingActionBalanceConfig, CentralBankBalanceConfig } from "../contracts";
export type CentralBankMarketCategory = "materials" | "weapons" | "defenseItems" | "rareComponents" | "drugsAndBoosts";

export interface CentralBankRiskEvent {
  actionId: string;
  riskPct: number;
  expiresAtTick: number;
  tick: number;
}

export interface CentralBankIntervention {
  id: string;
  category: CentralBankMarketCategory;
  startedAtTick: number;
  expiresAtTick: number;
  volatilityReductionPct: number;
  priceMoveCapPct: number;
  holderMarketFeeReductionPct: number;
  stockExchangeEffectReductionPct: number;
  ownerPlayerId: string;
}

export interface CentralBankOversightEvent {
  type: string;
  tick: number;
  label: string;
  riskPct: number;
  cleanCashLost?: number;
  rumorText?: string;
}

export interface CentralBankInterestEvent {
  tick: number;
  amount: number;
  cleanCashBefore: number;
  interestPct: number;
}

export interface CentralBankMetadata {
  frozenAccountsExpiresAtTick?: number;
  interestDisabledUntilTick?: number;
  liquidityBlockedUntilTick?: number;
  feeReductionDisabledUntilTick?: number;
  lastInterestTick?: number;
  lastOversightTick?: number;
  riskEvents: CentralBankRiskEvent[];
  currencyInterventions: CentralBankIntervention[];
  oversightEvents: CentralBankOversightEvent[];
  interestEvents: CentralBankInterestEvent[];
}

export interface CentralBankReserveStats {
  ownedCount: number;
  tier: CentralBankBalanceConfig["reserveTiers"][number] | null;
  cleanCashProtectionPct: number;
  dirtyCashProtectionPct: number;
  fineReductionPct: number;
  financialEventLossReductionPct: number;
  financialInspectionPenaltyReductionPct: number;
  economicCrisisImpactReductionPct: number;
  marketFeeReductionPct: number;
  interestPct: number;
  interestIntervalMinutes: number;
  maxInterestCleanCash: number;
  interestDisabled: boolean;
  liquidityBlocked: boolean;
  frozenAccountsActive: boolean;
  activeCurrencyInterventions: CentralBankIntervention[];
}

export interface CentralBankActionResolution {
  balances: Record<string, number>;
  buildingMetadata: Record<string, unknown>;
  heatGain: number;
  influenceChange: number;
  outputGain: Record<string, number>;
  inputCost: Record<string, number>;
  effectModifiers?: BuildingActionBalanceConfig["effectModifiers"];
  reportText: string;
  centralBankResult: Record<string, unknown>;
}
