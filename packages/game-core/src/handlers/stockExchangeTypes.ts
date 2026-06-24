import type { BuildingActionBalanceConfig } from "../contracts";
export type StockExchangeMarketCategory = "materials" | "drugsAndBoosts" | "weapons" | "defenseItems" | "rareComponents";
export type StockExchangePressureMode = "pump" | "dump";

export interface StockExchangeRiskEvent {
  actionId: string;
  riskPct: number;
  expiresAtTick: number;
  tick: number;
}

export interface StockExchangeTrendHint {
  id: string;
  tick: number;
  category: StockExchangeMarketCategory;
  text: string;
}

export interface StockExchangeMarketEffect {
  id: string;
  category: StockExchangeMarketCategory;
  mode: StockExchangePressureMode;
  regularPriceModifierPct: number;
  blackMarketPriceModifierPct: number;
  startedAtTick: number;
  expiresAtTick: number;
  ownerPlayerId: string;
}

export interface StockExchangeInspectionEvent {
  type: string;
  tick: number;
  riskPct: number;
  label: string;
}

export interface StockExchangeMetadata {
  insiderWindowExpiresAtTick?: number;
  incomeFrozenUntilTick?: number;
  feeReductionDisabledUntilTick?: number;
  lastInspectionTick?: number;
  lastInsightTick?: number;
  actionHistory: Array<{ actionId: string; tick: number; category?: string; mode?: string }>;
  riskEvents: StockExchangeRiskEvent[];
  trendHints: StockExchangeTrendHint[];
  marketEffects: StockExchangeMarketEffect[];
  inspectionEvents: StockExchangeInspectionEvent[];
}

export interface StockExchangeActionResolution {
  balances: Record<string, number>;
  buildingMetadata: Record<string, unknown>;
  heatGain: number;
  influenceChange: number;
  outputGain: Record<string, number>;
  inputCost: Record<string, number>;
  effectModifiers?: BuildingActionBalanceConfig["effectModifiers"];
  reportText: string;
  stockExchangeResult: Record<string, unknown>;
}
