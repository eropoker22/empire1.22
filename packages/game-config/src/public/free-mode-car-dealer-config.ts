import type { CarDealerBalanceConfig } from "../contracts/balance-config";

export const freeModeCarDealerConfig: CarDealerBalanceConfig = {
  id: "car_dealer",
  buildingTypeId: "car_dealer",
  legacyBuildingTypeIds: ["auto_salon"],
  countOnMap: 10,
  category: ["economy", "mobility", "logistics", "cooldown_multiplier"],
  cleanCashPerMinute: 2145 / 60,
  dirtyCashPerMinute: 650 / 60,
  influencePerMinute: 1 / 60,
  heatPerMinute: 60 / (60 * 24),
  actions: [],
  noSpecialActions: true,
  noLaundering: true,
  noAuditRisk: true,
  noPopulationProduction: true,
  noIntelPower: true,
  mobility: {
    bonusPctPerDealer: 3,
    maxBonusPct: 21,
    fullBonusActionCategories: [
      "districtRobbery",
      "districtOccupy",
      "attackPreparation"
    ],
    halfBonusActionCategories: [],
    smallBonusActionCategories: [
      "clinicEvacuationRecovery",
      "recyclingSalvageTransport"
    ],
    excludedActionCategories: [
      "moneyLaundering",
      "casinoActions",
      "exchangeOfficeActions",
      "arcadeLaunderingActions",
      "rumorGeneration",
      "passiveProduction",
      "intelScan",
      "trapDetection"
    ]
  },
  cooldownReduction: {
    reductionPctPerDealer: 1.5,
    maxReductionPct: 10.5,
    combinedGarageDealerMaxReductionPct: 22,
    fullBonusActionCategories: [
      "districtRobbery",
      "districtOccupy",
      "attackPreparation"
    ],
    halfBonusActionCategories: [],
    smallBonusActionCategories: [
      "clinicEvacuationRecovery",
      "recyclingSalvageTransport"
    ],
    excludedActionCategories: [
      "moneyLaundering",
      "casinoActions",
      "exchangeOfficeActions",
      "arcadeLaunderingActions",
      "rumorGeneration",
      "passiveProduction",
      "intelScan",
      "trapDetection"
    ]
  },
  escapeChance: {
    bonusPctPerDealer: 2,
    maxBonusPct: 12,
    appliesTo: [
      "attackFailure"
    ]
  },
  network: {
    cleanIncomeBonusPctPerExtraDealer: 4,
    dirtyIncomeBonusPctPerExtraDealer: 4,
    heatBonusPctPerExtraDealer: 3,
    maxCleanIncomeMultiplier: 1.24,
    maxDirtyIncomeMultiplier: 1.24,
    maxHeatMultiplier: 1.18
  }
};
