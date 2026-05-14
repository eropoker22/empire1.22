export interface CityHallBalanceConfig {
  id: "city_hall";
  buildingTypeId: "city_hall";
  countOnMap: 1;
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
  cityAuthority: {
    influenceGenerationBonusPct: number;
    legalBuildingHeatReductionPct: number;
    policeRaidWarningChancePct: number;
    warningCooldownMinutes: number;
    influenceActionCostReductionPct: number;
    maxInfluenceActionCostReductionPct: number;
    districtControlPressurePct: number;
    legalBuildingTypeIds: string[];
  };
  officialCover: {
    actionId: "official_cover";
    cooldownMinutes: number;
    durationMinutes: number;
    costInfluence: number;
    costCleanCash: number;
    heatGain: number;
    heatGainReductionPct: number;
    policeControlChanceReductionPct: number;
    rumorChanceReductionPct: number;
    riskPct: number;
  };
  cityContract: {
    actionId: "city_contract";
    cooldownMinutes: number;
    costInfluence: number;
    heatGain: number;
    baseRewardCleanCash: number;
    rewardPerLegalBuilding: number;
    maxRewardCleanCash: number;
    restaurantConvenienceSynergyPct: number;
    restaurantSynergyThreshold: number;
    convenienceSynergyThreshold: number;
    riskPct: number;
    riskDurationMinutes: number;
    legalBuildingTypeIds: string[];
  };
  emergencyDecree: {
    actionId: "emergency_decree";
    cooldownMinutes: number;
    durationMinutes: number;
    costInfluence: number;
    costCleanCash: number;
    heatGain: number;
    riskPct: number;
    modes: {
      nightPatrols: {
        modeId: "night_patrols";
        incomingAttackPreparationIncreasePct: number;
        districtRobberyCooldownIncreasePct: number;
        defenseBonusPct: number;
      };
      suspendedChecks: {
        modeId: "suspended_checks";
        heatGainReductionPct: number;
        policeIncidentChanceReductionPct: number;
      };
      constructionClosure: {
        modeId: "construction_closure";
        enemyZoneMovementTimeIncreasePct: number;
        enemyZoneRobberyTimeIncreasePct: number;
      };
    };
  };
  corruptionScandal: {
    intervalMinutes: number;
    passiveRiskPct: number;
    heatThreshold: number;
    heatRiskPct: number;
    casinoOrStockExchangeRiskPct: number;
    stockExchangeSynergyRiskPct: number;
    airportSynergyRiskPct: number;
    influencePenaltyPct: number;
    influencePenaltyMinutes: number;
    cityContractBlockedMinutes: number;
    publicResistanceInfluenceLoss: number;
    policeOversightHeatGain: number;
  };
  synergies: {
    stripClubContactChancePct: number;
    stripClubPrivatePartyScandalReductionPct: number;
    civilRumorTruthRestaurantThreshold: number;
    civilRumorTruthConvenienceThreshold: number;
    civilRumorTruthBonusPct: number;
    stockExchangeFinancialInspectionRiskReductionPct: number;
    airportCustomsRiskReductionPct: number;
  };
}

export interface LobbyClubBalanceConfig {
  id: "lobby_club";
  buildingTypeId: "lobby_club";
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
  noAuditRisk: true;
  lobbyPressureTiers: Array<{
    minOwned: number;
    maxOwned: number;
    pressurePct: number;
    incomeMultiplier: number;
    influenceMultiplier: number;
    heatMultiplier: number;
  }>;
  influenceCostReduction: {
    oneClubPct: number;
    twoClubPct: number;
    maxCombinedPct: number;
  };
  negativeRumorReduction: {
    oneClubPct: number;
    twoClubPct: number;
    minNegativeRumorChancePct: number;
  };
  civilNetworkSupport: {
    restaurantCivilRumorTruthPct: number;
    convenienceDistrictHintChancePct: number;
    shoppingMallMarketFeeReductionPct: number;
    vipLoungeTruthChancePct: number;
  };
  backroomPressure: {
    actionId: "backroom_pressure";
    cooldownMinutes: number;
    durationMinutes: number;
    costInfluence: number;
    costCleanCash: number;
    heatGain: number;
    influenceProductionBonusPct: number;
    influenceActionCostReductionPct: number;
    negativeRumorReductionPct: number;
    districtControlPressurePct: number;
    politicalActionHeatIncreasePct: number;
    scandalRiskPct: number;
  };
  quietNegotiation: {
    actionId: "quiet_negotiation";
    cooldownMinutes: number;
    costCleanCash: number;
    costInfluence: number;
    heatGain: number;
    cooldownRemainingReductionPct: number;
    riskReductionPct: number;
    riskReductionMinutes: number;
    nextInfluenceActionDiscountPct: number;
    nextInfluenceActionDiscountMinutes: number;
    scandalRiskPct: number;
    targetBuildingTypeIds: string[];
  };
  mediaScreen: {
    actionId: "media_screen";
    cooldownMinutes: number;
    durationMinutes: number;
    costCleanCash: number;
    heatGain: number;
    negativeRumorReductionPct: number;
    negativeRumorTruthReductionPct: number;
    policeRaidWarningChancePct: number;
    civilRumorTruthPct: number;
    weakRewriteChancePct: number;
    scandalRiskPct: number;
  };
  lobbyScandal: {
    intervalMinutes: number;
    passiveRiskPct: number;
    cityHallRiskPct: number;
    stockExchangeRiskPct: number;
    heatThreshold: number;
    heatRiskPct: number;
    influenceLoss: number;
    incomePenaltyPct: number;
    incomePenaltyMinutes: number;
    influenceReductionDisabledMinutes: number;
    policeHeatGain: number;
  };
  synergies: {
    cityHallOfficialCoverCostReductionPct: number;
    cityHallContractRewardPct: number;
    cityHallEmergencyDecreeCooldownMinutes: number;
    cityHallCorruptionScandalRiskPct: number;
    vipLoungeTruthChancePct: number;
    vipLoungeNegativeRumorReductionPct: number;
    vipLoungeBackroomWhisperCostReductionPct: number;
    stripClubRumorTruthPct: number;
    stripClubPrivatePartyScandalReductionPct: number;
    stockExchangeSpeculativeBuyCostReductionPct: number;
    stockExchangeFinancialInspectionRiskPct: number;
  };
}

export interface CourthouseBalanceConfig {
  id: "courthouse";
  buildingTypeId: "court";
  countOnMap: 2;
  zone: "downtown";
  category: string[];
  cleanCashPerMinute: number;
  dirtyCashPerMinute: 0;
  influencePerMinute: number;
  populationPerMinute: 0;
  heatPerMinute: number;
  actions: [];
  noSpecialActions: true;
  noIntelPower: true;
  noDirtyCash: true;
  noPopulationProduction: true;
  noLaundering: true;
  noAuditRisk: true;
  legalProtectionTiers: Array<{
    minOwned: number;
    maxOwned: number;
    cleanIncomeMultiplier: number;
    influenceMultiplier: number;
    heatMultiplier: number;
    policeRaidConsequencesReductionPct: number;
  }>;
}

export interface AirportBalanceConfig {
  id: "airport";
  buildingTypeId: "airport";
  countOnMap: 1;
  zone: "downtown";
  category: string[];
  cleanCashPerMinute: number;
  dirtyCashPerMinute: number;
  influencePerMinute: number;
  populationPerMinute: 0;
  heatPerMinute: number;
  noIntelPower: true;
  noPopulationProduction: true;
  noLaundering: true;
  importDiscount: {
    materialsPct: number;
    rareComponentsPct: number;
    weaponsPct: number;
    defenseItemsPct: number;
    drugsAndBoostsPct: number;
    blackMarketItemsPct: number;
    shoppingMallMaterialsSynergyPct: number;
  };
  cooldownReduction: {
    marketDeliveryPct: number;
    blackMarketDeliveryPct: number;
    resourceTransferPct: number;
    equipmentTransferPct: number;
    shoppingMallMarketDeliverySynergyPct: number;
    combinedLogisticsMaxReductionPct: number;
  };
  blackMarketSignal: {
    rareItemOfferChanceBonusPct: number;
    extraStockRefreshOffers: number;
    weaponsAndComponentsChanceBonusPct: number;
  };
  expressImport: {
    actionId: "express_import";
    cooldownMinutes: number;
    durationSeconds: number;
    costCleanCash: number;
    nextImportCostPenaltyPct: number;
    heatGain: number;
    targetCategories: string[];
    customsRiskPct: number;
    customsHeatGain: number;
    customsShipmentPenaltyPct: number;
    shipmentValueRanges: Record<string, { min: number; max: number }>;
  };
  blackCharter: {
    actionId: "black_charter";
    cooldownMinutes: number;
    durationMinutes: number;
    costDirtyCash: number;
    heatGain: number;
    specialOfferDiscountPct: number;
    purchaseCustomsRiskPct: number;
    offerItems: string[];
  };
  evacuationCorridor: {
    actionId: "evacuation_corridor";
    cooldownMinutes: number;
    durationMinutes: number;
    costCleanCash: number;
    heatGain: number;
    escapeChanceBonusPct: number;
    peopleLossReductionPct: number;
    equipmentLossReductionPct: number;
    retreatReturnTimeReductionPct: number;
    gangMovementTimeReductionPct: number;
    customsRiskPct: number;
  };
  customsInspection: {
    intervalMinutes: number;
    passiveRiskPct: number;
    heatThreshold: number;
    heatRiskPct: number;
    smugglingTunnelThreshold: number;
    smugglingTunnelRiskPct: number;
    stockExchangeSynergyRiskPct: number;
    discountDisabledMinutes: number;
    hangarHeatGain: number;
    nextImportCostPenaltyPct: number;
  };
}
