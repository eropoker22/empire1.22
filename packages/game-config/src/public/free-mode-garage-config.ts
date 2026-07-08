import type { GarageBalanceConfig } from "../contracts/balance-config";

export const freeModeGarageConfig: GarageBalanceConfig = {
  id: "garage",
  buildingTypeId: "garage",
  countOnMap: 16,
  category: ["economy", "logistics", "cooldown_multiplier"],
  cleanCashPerMinute: 42,
  dirtyCashPerMinute: 0,
  influencePerMinute: 0,
  heatPerMinute: 0.06,
  actions: [],
  noSpecialActions: true,
  noLaundering: true,
  noAuditRisk: true,
  cooldownReduction: {
    reductionPctPerGarage: 2,
    maxReductionPct: 16,
    fullBonusActionCategories: [
      "attackPreparation",
      "districtOccupy",
      "districtRobbery"
    ],
    halfBonusActionCategories: [
      "districtSpy",
      "trapDetection",
      "clinicRecovery",
      "factoryProductionActions",
      "armoryProductionActions"
    ],
    excludedActionCategories: [
      "moneyLaundering",
      "casinoActions",
      "exchangeOfficeActions",
      "arcadeLaunderingActions",
      "vipBoosts",
      "rumorGeneration",
      "passiveProduction"
    ]
  },
  network: {
    incomeBonusPctPerExtraGarage: 3,
    heatBonusPctPerExtraGarage: 2,
    maxIncomeMultiplier: 1.21,
    maxHeatMultiplier: 1.14
  }
};
