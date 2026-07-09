export interface GarageBalanceConfig {
  id: "garage";
  buildingTypeId: "garage";
  countOnMap: number;
  category: string[];
  cleanCashPerMinute: number;
  dirtyCashPerMinute: 0;
  influencePerMinute: 0;
  heatPerMinute: number;
  actions: [];
  noSpecialActions: true;
  noLaundering: true;
  noAuditRisk: true;
  cooldownReduction: {
    reductionPctPerGarage: number;
    maxReductionPct: number;
    fullBonusActionCategories: string[];
    halfBonusActionCategories: string[];
    excludedActionCategories: string[];
  };
  network: {
    incomeBonusPctPerExtraGarage: number;
    heatBonusPctPerExtraGarage: number;
    maxIncomeMultiplier: number;
    maxHeatMultiplier: number;
  };
}

export interface CarDealerBalanceConfig {
  id: "car_dealer";
  buildingTypeId: "car_dealer";
  legacyBuildingTypeIds?: string[];
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
  noPopulationProduction: true;
  noIntelPower: true;
  mobility: {
    bonusPctPerDealer: number;
    maxBonusPct: number;
    fullBonusActionCategories: string[];
    halfBonusActionCategories: string[];
    smallBonusActionCategories: string[];
    excludedActionCategories: string[];
  };
  cooldownReduction: {
    reductionPctPerDealer: number;
    maxReductionPct: number;
    combinedGarageDealerMaxReductionPct: number;
    fullBonusActionCategories: string[];
    halfBonusActionCategories: string[];
    smallBonusActionCategories: string[];
    excludedActionCategories: string[];
  };
  escapeChance: {
    bonusPctPerDealer: number;
    maxBonusPct: number;
    appliesTo: string[];
  };
  network: {
    cleanIncomeBonusPctPerExtraDealer: number;
    dirtyIncomeBonusPctPerExtraDealer: number;
    heatBonusPctPerExtraDealer: number;
    maxCleanIncomeMultiplier: number;
    maxDirtyIncomeMultiplier: number;
    maxHeatMultiplier: number;
  };
}

export interface SmugglingTunnelBalanceConfig {
  id: "smuggling_tunnel";
  buildingTypeId: "smuggling_tunnel";
  countOnMap: number;
  category: string[];
  cleanCashPerMinute: 0;
  dirtyCashPerMinute: number;
  influencePerMinute: 0;
  populationPerMinute: 0;
  heatPerMinute: number;
  noCleanCash: true;
  noInfluence: true;
  noPopulationProduction: true;
  noIntelPower: true;
  noLaundering: true;
  noAuditRisk: true;
  openChannel: {
    actionId: "open_channel";
    cooldownMinutes: number;
    durationMinutes: number;
    costCleanCash: number;
    heatGain: number;
    tunnelDirtyProductionBonusPct: number;
    dealerSalePriceBonusPct: number;
    dealerSaleSpeedBonusPct: number;
    dealerCompletionRewardBonusPct: number;
    dealerSaleHeatBonusPct: number;
    streetIncidentFlatRiskPct: number;
    stackable: false;
  };
  dealerSupply: {
    bonusPctPerTunnel: number;
    maxBonusPct: number;
    salePriceSharePct: number;
    saleSpeedSharePct: number;
    streetRiskReductionSharePct: number;
    passiveDirtyIncomeSharePct: number;
    saleHeatRiskSharePct: number;
  };
  network: {
    dirtyProductionBonusPctPerExtraTunnel: number;
    maxDirtyProductionMultiplier: number;
    heatBonusPctPerExtraTunnel: number;
    maxHeatMultiplier: number;
  };
}

export interface StreetDealerDrugSaleConfig {
  itemId: string;
  label: string;
  aliases?: string[];
  basePriceDirtyCash: number;
  baseDurationMinutes: number;
  baseHeatPerUnit: number;
  maxAmountPerSlot: number;
  baseStreetRiskPct: number;
}

export interface StreetDealersBalanceConfig {
  id: "street_dealers";
  buildingTypeId: "street_dealers";
  name: "Pouliční dealeři";
  countOnMap: number;
  category: string[];
  cleanCashPerMinute: 0;
  dirtyCashPerMinute: number;
  influencePerMinute: 0;
  populationPerMinute: 0;
  heatPerMinute: number;
  noCleanCash: true;
  noInfluence: true;
  noPopulationProduction: true;
  noIntelPower: true;
  noLaundering: true;
  noAuditRisk: true;
  startDrugSale: {
    actionId: "start_drug_sale";
  };
  dealerSlots: Array<{
    minOwned: number;
    maxOwned: number | null;
    slots: number;
  }>;
  sellableDrugs: StreetDealerDrugSaleConfig[];
  streetIncidents: {
    extraCooldownMinutes: number;
    fakeCustomerRewardPenaltyPct: number;
    streetConflictHeatGain: number;
    lostPackageAmountPct: number;
    maxStreetRiskPct: number;
  };
  network: {
    passiveDirtyIncomeBonusPctPerExtraDealer: number;
    salePriceBonusPctPerExtraDealer: number;
    saleSpeedBonusPctPerExtraDealer: number;
    heatBonusPctPerExtraDealer: number;
    maxPassiveDirtyIncomeMultiplier: number;
    maxSalePriceMultiplier: number;
    maxSaleSpeedMultiplier: number;
    maxHeatMultiplier: number;
  };
}
