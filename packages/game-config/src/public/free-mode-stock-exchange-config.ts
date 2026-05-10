import type { StockExchangeBalanceConfig } from "../contracts/balance-config";

export const freeModeStockExchangeConfig: StockExchangeBalanceConfig = {
  id: "stock_exchange",
  buildingTypeId: "stock_exchange",
  countOnMap: 1,
  zone: "downtown",
  category: ["ultra_rare", "economy", "market_control", "financial_power"],
  cleanCashPerMinute: 220,
  dirtyCashPerMinute: 0,
  influencePerMinute: 0.45,
  populationPerMinute: 0,
  heatPerMinute: 0.18,
  noDirtyCash: true,
  noPopulationProduction: true,
  noIntelPower: true,
  noLaundering: true,
  marketInsight: {
    intervalMinutes: 8,
    baseHintCount: 1,
    insiderHintCount: 3
  },
  marketFeeReduction: {
    regularMarketPct: 10,
    playerMarketPct: 5,
    blackMarketPct: 3,
    insiderExtraPct: 8
  },
  speculativeBuy: {
    actionId: "speculative_buy",
    cooldownMinutes: 16,
    costCleanCash: 2500,
    maxInvestmentCleanCash: 10000,
    heatGain: 5,
    targetCategories: ["materials", "drugsAndBoosts", "weapons", "defenseItems", "rareComponents"],
    successChancePct: 65,
    insiderSuccessChanceBonusPct: 12,
    successProfitMinPct: 25,
    successProfitMaxPct: 45,
    neutralChancePct: 25,
    neutralReturnMinPct: -8,
    neutralReturnMaxPct: 8,
    lossReturnMinPct: -30,
    lossReturnMaxPct: -15,
    riskPct: 6,
    riskDurationMinutes: 8
  },
  marketPressure: {
    actionId: "market_pressure",
    cooldownMinutes: 22,
    durationMinutes: 10,
    costCleanCash: 3000,
    costInfluence: 15,
    heatGain: 8,
    targetCategories: ["materials", "drugsAndBoosts", "weapons", "defenseItems", "rareComponents"],
    pumpRegularPct: 12,
    dumpRegularPct: -10,
    blackMarketEffectSharePct: 40,
    riskPct: 12,
    riskDurationMinutes: 10
  },
  insiderWindow: {
    actionId: "insider_window",
    cooldownMinutes: 18,
    durationMinutes: 6,
    costCleanCash: 1500,
    heatGain: 4,
    financialInspectionRiskPct: 10
  },
  financialInspection: {
    intervalMinutes: 6,
    multiActionWindowMinutes: 20,
    multiActionThreshold: 2,
    multiActionRiskPct: 8,
    heatThreshold: 150,
    heatRiskPct: 10,
    frozenIncomeMinutes: 6,
    feeReductionDisabledMinutes: 8,
    fineCleanCash: 3000,
    panicVolatilityPct: 15,
    panicDurationMinutes: 8,
    scandalHeatGain: 12
  }
};
