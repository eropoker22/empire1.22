export interface ShoppingMallBalanceConfig {
  id: "shopping_mall";
  buildingTypeId: "shopping_mall";
  countOnMap: number;
  category: string[];
  cleanCashPerMinute: number;
  dirtyCashPerMinute: number;
  influencePerMinute: number;
  heatPerMinute: number;
  actions: [];
  noSpecialActions: true;
  noLaundering: true;
  noAuditRisk: true;
  marketDiscount: {
    discountPctPerMall: number;
    maxDiscountPct: number;
    regularMarketWeight: number;
    blackMarketWeight: number;
    playerMarketWeight: number;
    emergencyMarketWeight: number;
    minFinalPriceMultiplier: number;
  };
  marketFeeReduction: {
    feeReductionPctPerMall: number;
    maxFeeReductionPct: number;
  };
  network: {
    cleanIncomeBonusPctPerExtraMall: number;
    dirtyIncomeBonusPctPerExtraMall: number;
    influenceBonusPctPerExtraMall: number;
    heatBonusPctPerExtraMall: number;
    maxCleanIncomeMultiplier: number;
    maxDirtyIncomeMultiplier: number;
    maxInfluenceMultiplier: number;
    maxHeatMultiplier: number;
  };
}

export interface StockExchangeBalanceConfig {
  id: "stock_exchange";
  buildingTypeId: "stock_exchange";
  countOnMap: 1;
  zone: "downtown";
  category: string[];
  cleanCashPerMinute: number;
  dirtyCashPerMinute: 0;
  influencePerMinute: number;
  populationPerMinute: 0;
  heatPerMinute: number;
  noDirtyCash: true;
  noPopulationProduction: true;
  noIntelPower: true;
  noLaundering: true;
  marketInsight: {
    intervalMinutes: number;
    baseHintCount: number;
    insiderHintCount: number;
  };
  marketFeeReduction: {
    regularMarketPct: number;
    playerMarketPct: number;
    blackMarketPct: number;
    insiderExtraPct: number;
  };
  speculativeBuy: {
    actionId: "speculative_buy";
    cooldownMinutes: number;
    costCleanCash: number;
    maxInvestmentCleanCash: number;
    heatGain: number;
    targetCategories: string[];
    successChancePct: number;
    insiderSuccessChanceBonusPct: number;
    successProfitMinPct: number;
    successProfitMaxPct: number;
    neutralChancePct: number;
    neutralReturnMinPct: number;
    neutralReturnMaxPct: number;
    lossReturnMinPct: number;
    lossReturnMaxPct: number;
    riskPct: number;
    riskDurationMinutes: number;
  };
  marketPressure: {
    actionId: "market_pressure";
    cooldownMinutes: number;
    durationMinutes: number;
    costCleanCash: number;
    costInfluence: number;
    heatGain: number;
    targetCategories: string[];
    pumpRegularPct: number;
    dumpRegularPct: number;
    blackMarketEffectSharePct: number;
    riskPct: number;
    riskDurationMinutes: number;
  };
  insiderWindow: {
    actionId: "insider_window";
    cooldownMinutes: number;
    durationMinutes: number;
    costCleanCash: number;
    heatGain: number;
    financialInspectionRiskPct: number;
  };
  financialInspection: {
    intervalMinutes: number;
    multiActionWindowMinutes: number;
    multiActionThreshold: number;
    multiActionRiskPct: number;
    heatThreshold: number;
    heatRiskPct: number;
    frozenIncomeMinutes: number;
    feeReductionDisabledMinutes: number;
    fineCleanCash: number;
    panicVolatilityPct: number;
    panicDurationMinutes: number;
    scandalHeatGain: number;
  };
}

export interface CentralBankBalanceConfig {
  id: "central_bank";
  buildingTypeId: "central_bank";
  countOnMap: 2;
  zone: "downtown";
  category: string[];
  cleanCashPerMinute: number;
  dirtyCashPerMinute: 0;
  influencePerMinute: number;
  populationPerMinute: 0;
  heatPerMinute: number;
  noIntelPower: true;
  noDirtyCash: true;
  noPopulationProduction: true;
  noLaundering: true;
  reserveTiers: Array<{
    minOwned: number;
    maxOwned: number;
    cleanCashProtectionPct: number;
    interestIntervalMinutes: number;
    interestPct: number;
    maxInterestCleanCash: number;
    incomeMultiplier: number;
    influenceMultiplier: number;
    heatMultiplier: number;
    fineReductionPct: number;
    marketFeeReductionPct: number;
    financialInspectionPenaltyReductionPct: number;
    economicCrisisImpactReductionPct: number;
  }>;
  liquidityInjection: {
    actionId: "liquidity_injection";
    cooldownMinutes: number;
    costInfluence: number;
    heatGain: number;
    baseRewardCleanCash: number;
    rewardPerCleanEconomyBuilding: number;
    maxRewardCleanCash: number;
    shoppingMallRewardBonusPct: number;
    riskPct: number;
    riskDurationMinutes: number;
    cleanEconomyBuildingTypeIds: string[];
  };
  frozenAccounts: {
    actionId: "frozen_accounts";
    cooldownMinutes: number;
    durationMinutes: number;
    costCleanCash: number;
    heatGain: number;
    cleanCashProtectionBonusPct: number;
    dirtyCashProtectionPct: number;
    fineReductionPct: number;
    financialEventLossReductionPct: number;
    marketFeePenaltyPct: number;
    riskPct: number;
  };
  currencyIntervention: {
    actionId: "currency_intervention";
    cooldownMinutes: number;
    durationMinutes: number;
    costCleanCash: number;
    costInfluence: number;
    heatGain: number;
    targetCategories: string[];
    volatilityReductionPct: number;
    priceMoveCapPct: number;
    holderMarketFeeReductionPct: number;
    stockExchangeEffectReductionPct: number;
    stockExchangeSynergyEffectBonusPct: number;
    riskPct: number;
  };
  financialOversight: {
    intervalMinutes: number;
    passiveRiskPct: number;
    heatThreshold: number;
    heatRiskPct: number;
    stockExchangeRiskPct: number;
    cityHallRiskReductionPct: number;
    interestDisabledMinutes: number;
    liquidityBlockedMinutes: number;
    regulatoryFineCleanCash: number;
    feeReductionDisabledMinutes: number;
  };
  synergies: {
    stockExchangeSpeculativeRiskReductionPct: number;
    cityHallCorruptionPenaltyReductionPct: number;
    cityHallInfluenceActionCostReductionPct: number;
    shoppingMallMarketFeeReductionPct: number;
    shoppingMallCleanIncomeBonusPct: number;
  };
}
