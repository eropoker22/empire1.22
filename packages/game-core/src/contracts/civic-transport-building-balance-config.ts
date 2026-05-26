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

export interface PortBalanceConfig {
  id: "port";
  buildingTypeId: "port";
  countOnMap: 1;
  zone: "downtown";
  category: string[];
  cleanCashPerMinute: number;
  dirtyCashPerMinute: number;
  influencePerMinute: number;
  populationPerMinute: 0;
  heatPerMinute: number;
  noPopulationProduction: true;
  containerCut: {
    actionId: "port_container_cut";
    cooldownMinutes: number;
    heatGain: number;
    dirtyCashGain: number;
    metalPartsGain: number;
    influenceGain: number;
  };
}

export interface ParliamentBalanceConfig {
  id: "parliament";
  buildingTypeId: "parliament";
  countOnMap: 1;
  zone: "downtown";
  category: string[];
  cleanCashPerMinute: number;
  dirtyCashPerMinute: number;
  influencePerMinute: number;
  populationPerMinute: 0;
  heatPerMinute: number;
  noPopulationProduction: true;
  policyWindow: {
    actionId: "parliament_policy_window";
    cooldownMinutes: number;
    heatGain: number;
    cleanCashGain: number;
    influenceGain: number;
  };
}
