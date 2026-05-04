import type { RestaurantBalanceConfig } from "../contracts/balance-config";

export const freeModeRestaurantConfig: RestaurantBalanceConfig = {
  id: "restaurant",
  buildingTypeId: "restaurant",
  countOnMap: 36,
  category: ["economy", "rumors", "influence", "city_life"],
  cleanCashPerMinute: 38,
  dirtyCashPerMinute: 0,
  influencePerMinute: 0.12,
  heatPerMinute: 0.04,
  noSpecialActions: true,
  noLaundering: true,
  noAuditRisk: true,
  passiveRumorIntervalMinutes: 10,
  baseRumorChancePct: 9,
  truthChanceByOwnedCount: [
    { minOwned: 1, maxOwned: 2, truthChancePct: 45 },
    { minOwned: 3, maxOwned: 5, truthChancePct: 50 },
    { minOwned: 6, maxOwned: 9, truthChancePct: 55 },
    { minOwned: 10, maxOwned: null, truthChancePct: 60 }
  ],
  districtHintChancePct: 18,
  buildingHintChancePct: 8,
  rumorTypes: [
    "civilian_movement",
    "suspicious_delivery",
    "police_interest",
    "economic_activity",
    "storage_movement",
    "attack_preparation",
    "weak_defense",
    "fake"
  ],
  network: {
    incomeBonusPctPerExtraRestaurant: 2.5,
    influenceBonusPctPerExtraRestaurant: 3,
    rumorChanceBonusPctPerExtraRestaurant: 4,
    heatBonusPctPerExtraRestaurant: 2,
    maxIncomeMultiplier: 1.25,
    maxInfluenceMultiplier: 1.3,
    maxRumorMultiplier: 1.4,
    maxHeatMultiplier: 1.2
  }
};
