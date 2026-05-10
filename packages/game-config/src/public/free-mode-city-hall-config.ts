import type { CityHallBalanceConfig } from "../contracts/balance-config";

export const freeModeCityHallConfig: CityHallBalanceConfig = {
  id: "city_hall",
  buildingTypeId: "city_hall",
  countOnMap: 1,
  zone: "downtown",
  category: ["ultra_rare", "politics", "city_control", "heat_management"],
  cleanCashPerMinute: 130,
  dirtyCashPerMinute: 0,
  influencePerMinute: 0.85,
  populationPerMinute: 0,
  heatPerMinute: 0.12,
  noIntelPower: true,
  noDirtyCash: true,
  noPopulationProduction: true,
  noLaundering: true,
  cityAuthority: {
    influenceGenerationBonusPct: 10,
    legalBuildingHeatReductionPct: 8,
    policeRaidWarningChancePct: 12,
    warningCooldownMinutes: 10,
    influenceActionCostReductionPct: 10,
    maxInfluenceActionCostReductionPct: 25,
    districtControlPressurePct: 8,
    legalBuildingTypeIds: [
      "restaurant",
      "convenience_store",
      "shopping_mall",
      "school",
      "fitness_club",
      "garage",
      "car_dealer",
      "warehouse",
      "clinic",
      "recruitment_center",
      "recycling_center",
      "power_station"
    ]
  },
  officialCover: {
    actionId: "official_cover",
    cooldownMinutes: 20,
    durationMinutes: 8,
    costInfluence: 25,
    costCleanCash: 1500,
    heatGain: 2,
    heatGainReductionPct: 35,
    policeControlChanceReductionPct: 20,
    rumorChanceReductionPct: 15,
    riskPct: 8
  },
  cityContract: {
    actionId: "city_contract",
    cooldownMinutes: 18,
    costInfluence: 20,
    heatGain: 3,
    baseRewardCleanCash: 1500,
    rewardPerLegalBuilding: 120,
    maxRewardCleanCash: 6500,
    restaurantConvenienceSynergyPct: 10,
    restaurantSynergyThreshold: 6,
    convenienceSynergyThreshold: 4,
    riskPct: 6,
    riskDurationMinutes: 8,
    legalBuildingTypeIds: [
      "restaurant",
      "convenience_store",
      "school",
      "warehouse",
      "clinic",
      "fitness_club",
      "garage",
      "car_dealer",
      "shopping_mall",
      "power_station",
      "recruitment_center",
      "recycling_center"
    ]
  },
  emergencyDecree: {
    actionId: "emergency_decree",
    cooldownMinutes: 28,
    durationMinutes: 6,
    costInfluence: 40,
    costCleanCash: 2500,
    heatGain: 8,
    riskPct: 12,
    modes: {
      nightPatrols: {
        modeId: "night_patrols",
        incomingAttackPreparationIncreasePct: 8,
        districtRobberyCooldownIncreasePct: 12,
        defenseBonusPct: 5
      },
      suspendedChecks: {
        modeId: "suspended_checks",
        heatGainReductionPct: 18,
        policeIncidentChanceReductionPct: 10
      },
      constructionClosure: {
        modeId: "construction_closure",
        enemyZoneMovementTimeIncreasePct: 10,
        enemyZoneRobberyTimeIncreasePct: 10
      }
    }
  },
  corruptionScandal: {
    intervalMinutes: 8,
    passiveRiskPct: 2,
    heatThreshold: 150,
    heatRiskPct: 8,
    casinoOrStockExchangeRiskPct: 4,
    stockExchangeSynergyRiskPct: 5,
    airportSynergyRiskPct: 4,
    influencePenaltyPct: 50,
    influencePenaltyMinutes: 8,
    cityContractBlockedMinutes: 8,
    publicResistanceInfluenceLoss: 12,
    policeOversightHeatGain: 14
  },
  synergies: {
    stripClubContactChancePct: 5,
    stripClubPrivatePartyScandalReductionPct: 3,
    civilRumorTruthRestaurantThreshold: 10,
    civilRumorTruthConvenienceThreshold: 8,
    civilRumorTruthBonusPct: 5,
    stockExchangeFinancialInspectionRiskReductionPct: 5,
    airportCustomsRiskReductionPct: 5
  }
};
