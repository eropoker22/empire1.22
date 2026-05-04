import type { CarDealerBalanceConfig } from "../contracts/balance-config";

export const freeModeCarDealerConfig: CarDealerBalanceConfig = {
  id: "car_dealer",
  buildingTypeId: "car_dealer",
  legacyBuildingTypeIds: ["auto_salon"],
  countOnMap: 10,
  category: ["economy", "mobility", "logistics", "cooldown_multiplier"],
  cleanCashPerMinute: 68,
  dirtyCashPerMinute: 18,
  influencePerMinute: 0,
  heatPerMinute: 0.08,
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
      "gangMovement",
      "equipmentTransfer",
      "resourceTransfer",
      "districtRobbery",
      "attackPreparation",
      "retreatReturn"
    ],
    halfBonusActionCategories: [
      "attackTravelTime",
      "defenseReposition"
    ],
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
      "gangMovement",
      "equipmentTransfer",
      "resourceTransfer",
      "districtRobbery",
      "attackPreparation",
      "retreatReturn"
    ],
    halfBonusActionCategories: [
      "attackTravelTime",
      "defenseReposition"
    ],
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
      "districtRobberyFailure",
      "spyDetectedFailure",
      "movementAmbush",
      "attackReturn"
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
