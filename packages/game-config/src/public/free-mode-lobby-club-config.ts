import type { LobbyClubBalanceConfig } from "../contracts/balance-config";

export const freeModeLobbyClubConfig: LobbyClubBalanceConfig = {
  id: "lobby_club",
  buildingTypeId: "lobby_club",
  countOnMap: 2,
  zone: "downtown",
  category: ["ultra_rare", "lobbying", "influence", "political_support"],
  cleanCashPerMinute: 95,
  dirtyCashPerMinute: 0,
  influencePerMinute: 0.65,
  populationPerMinute: 0,
  heatPerMinute: 0.1,
  noIntelPower: true,
  noDirtyCash: true,
  noPopulationProduction: true,
  noLaundering: true,
  noAuditRisk: true,
  lobbyPressureTiers: [
    { minOwned: 1, maxOwned: 1, pressurePct: 10, incomeMultiplier: 1, influenceMultiplier: 1, heatMultiplier: 1 },
    { minOwned: 2, maxOwned: 99, pressurePct: 22, incomeMultiplier: 1.12, influenceMultiplier: 1.18, heatMultiplier: 1.1 }
  ],
  influenceCostReduction: {
    oneClubPct: 8,
    twoClubPct: 15,
    maxCombinedPct: 25
  },
  negativeRumorReduction: {
    oneClubPct: 10,
    twoClubPct: 18,
    minNegativeRumorChancePct: 5
  },
  civilNetworkSupport: {
    restaurantCivilRumorTruthPct: 4,
    convenienceDistrictHintChancePct: 4,
    shoppingMallMarketFeeReductionPct: 3,
    vipLoungeTruthChancePct: 3
  },
  backroomPressure: {
    actionId: "backroom_pressure",
    cooldownMinutes: 20,
    durationMinutes: 8,
    costInfluence: 25,
    costCleanCash: 1200,
    heatGain: 3,
    influenceProductionBonusPct: 18,
    influenceActionCostReductionPct: 10,
    negativeRumorReductionPct: 15,
    districtControlPressurePct: 8,
    politicalActionHeatIncreasePct: 10,
    scandalRiskPct: 8
  },
  quietNegotiation: {
    actionId: "quiet_negotiation",
    cooldownMinutes: 24,
    costCleanCash: 1500,
    costInfluence: 15,
    heatGain: 2,
    cooldownRemainingReductionPct: 20,
    riskReductionPct: 10,
    riskReductionMinutes: 8,
    nextInfluenceActionDiscountPct: 8,
    nextInfluenceActionDiscountMinutes: 8,
    scandalRiskPct: 6,
    targetBuildingTypeIds: ["city_hall", "vip_lounge", "strip_club", "stock_exchange", "central_bank", "port", "airport"]
  },
  mediaScreen: {
    actionId: "media_screen",
    cooldownMinutes: 26,
    durationMinutes: 8,
    costCleanCash: 2000,
    heatGain: 4,
    negativeRumorReductionPct: 35,
    negativeRumorTruthReductionPct: 15,
    policeRaidWarningChancePct: 6,
    civilRumorTruthPct: 6,
    weakRewriteChancePct: 35,
    scandalRiskPct: 7
  },
  lobbyScandal: {
    intervalMinutes: 8,
    passiveRiskPct: 2,
    cityHallRiskPct: 3,
    stockExchangeRiskPct: 3,
    heatThreshold: 150,
    heatRiskPct: 8,
    influenceLoss: 10,
    incomePenaltyPct: 40,
    incomePenaltyMinutes: 8,
    influenceReductionDisabledMinutes: 8,
    policeHeatGain: 12
  },
  synergies: {
    cityHallOfficialCoverCostReductionPct: 5,
    cityHallContractRewardPct: 5,
    cityHallEmergencyDecreeCooldownMinutes: 2,
    cityHallCorruptionScandalRiskPct: 3,
    vipLoungeTruthChancePct: 3,
    vipLoungeNegativeRumorReductionPct: 5,
    vipLoungeBackroomWhisperCostReductionPct: 5,
    stripClubRumorTruthPct: 4,
    stripClubPrivatePartyScandalReductionPct: 4,
    stockExchangeSpeculativeBuyCostReductionPct: 5,
    stockExchangeFinancialInspectionRiskPct: 3
  }
};
