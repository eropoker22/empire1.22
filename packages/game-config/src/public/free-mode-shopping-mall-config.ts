import type { ShoppingMallBalanceConfig } from "../contracts/balance-config";

export const freeModeShoppingMallConfig: ShoppingMallBalanceConfig = {
  id: "shopping_mall",
  buildingTypeId: "shopping_mall",
  countOnMap: 10,
  category: ["economy", "market", "influence", "multiplier"],
  cleanCashPerMinute: 3700 / 60,
  dirtyCashPerMinute: 22,
  influencePerMinute: 95 / (60 * 24),
  heatPerMinute: 65 / (60 * 24),
  actions: [],
  noSpecialActions: true,
  noLaundering: true,
  noAuditRisk: true,
  marketDiscount: {
    discountPctPerMall: 2,
    maxDiscountPct: 14,
    regularMarketWeight: 1,
    blackMarketWeight: 0.4,
    playerMarketWeight: 0,
    emergencyMarketWeight: 0,
    minFinalPriceMultiplier: 0.7
  },
  marketFeeReduction: {
    feeReductionPctPerMall: 5,
    maxFeeReductionPct: 30
  },
  network: {
    cleanIncomeBonusPctPerExtraMall: 5,
    dirtyIncomeBonusPctPerExtraMall: 5,
    influenceBonusPctPerExtraMall: 4,
    heatBonusPctPerExtraMall: 3,
    maxCleanIncomeMultiplier: 1.3,
    maxDirtyIncomeMultiplier: 1.3,
    maxInfluenceMultiplier: 1.24,
    maxHeatMultiplier: 1.18
  }
};
