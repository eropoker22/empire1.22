import type { ConvenienceStoreBalanceConfig } from "../contracts/balance-config";

export const freeModeConvenienceStoreConfig: ConvenienceStoreBalanceConfig = {
  id: "convenience_store",
  buildingTypeId: "convenience_store",
  countOnMap: 17,
  category: ["economy", "dirty_cash", "rumors", "influence", "street_life"],
  cleanCashPerMinute: 32,
  dirtyCashPerMinute: 18,
  influencePerMinute: 0.1,
  heatPerMinute: 0.05,
  noSpecialActions: true,
  noLaundering: true,
  noAuditRisk: true,
  passiveRumorIntervalMinutes: 10,
  baseRumorChancePct: 11,
  truthChanceByOwnedCount: [
    { minOwned: 1, maxOwned: 2, truthChancePct: 42 },
    { minOwned: 3, maxOwned: 5, truthChancePct: 48 },
    { minOwned: 6, maxOwned: 8, truthChancePct: 54 },
    { minOwned: 9, maxOwned: null, truthChancePct: 58 }
  ],
  districtHintChancePct: 22,
  areaHintChancePct: 12,
  buildingHintChancePct: 6,
  rumorTypes: [
    "night_movement",
    "suspicious_purchase",
    "courier_trace",
    "small_conflict",
    "police_patrol",
    "robbery_preparation",
    "weak_defense",
    "dirty_cash_movement",
    "fake"
  ],
  network: {
    cleanIncomeBonusPctPerExtraStore: 3.5,
    dirtyIncomeBonusPctPerExtraStore: 3.5,
    influenceBonusPctPerExtraStore: 4,
    rumorChanceBonusPctPerExtraStore: 6,
    heatBonusPctPerExtraStore: 2,
    maxCleanIncomeMultiplier: 1.25,
    maxDirtyIncomeMultiplier: 1.25,
    maxInfluenceMultiplier: 1.3,
    maxRumorMultiplier: 1.45,
    maxHeatMultiplier: 1.16
  },
  restaurantSynergy: {
    firstStoreThreshold: 3,
    firstRestaurantThreshold: 3,
    firstCivilRumorChanceBonusPct: 5,
    secondStoreThreshold: 6,
    secondRestaurantThreshold: 6,
    secondCivilRumorChanceBonusPct: 8,
    truthStoreThreshold: 8,
    truthRestaurantThreshold: 10,
    civilRumorTruthBonusPct: 5
  }
};
