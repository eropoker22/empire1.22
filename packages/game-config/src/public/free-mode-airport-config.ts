import type { AirportBalanceConfig } from "../contracts/balance-config";

export const freeModeAirportConfig: AirportBalanceConfig = {
  id: "airport",
  buildingTypeId: "airport",
  countOnMap: 1,
  zone: "downtown",
  category: ["ultra_rare", "logistics", "import", "black_market_support", "mobility"],
  cleanCashPerMinute: 180,
  dirtyCashPerMinute: 45,
  influencePerMinute: 0.2,
  populationPerMinute: 0,
  heatPerMinute: 0.2,
  noIntelPower: true,
  noPopulationProduction: true,
  noLaundering: true,
  importDiscount: {
    materialsPct: 8,
    rareComponentsPct: 6,
    weaponsPct: 5,
    defenseItemsPct: 5,
    drugsAndBoostsPct: 0,
    blackMarketItemsPct: 4,
    shoppingMallMaterialsSynergyPct: 2
  },
  cooldownReduction: {
    marketDeliveryPct: 15,
    blackMarketDeliveryPct: 10,
    resourceTransferPct: 8,
    equipmentTransferPct: 8,
    shoppingMallMarketDeliverySynergyPct: 5,
    combinedLogisticsMaxReductionPct: 30
  },
  blackMarketSignal: {
    rareItemOfferChanceBonusPct: 12,
    extraStockRefreshOffers: 1,
    weaponsAndComponentsChanceBonusPct: 10
  },
  expressImport: {
    actionId: "express_import",
    cooldownMinutes: 18,
    durationSeconds: 90,
    costCleanCash: 2000,
    nextImportCostPenaltyPct: 20,
    heatGain: 6,
    targetCategories: ["materials", "rareComponents", "weapons", "defenseItems"],
    customsRiskPct: 10,
    customsHeatGain: 10,
    customsShipmentPenaltyPct: 25,
    shipmentValueRanges: {
      materials: { min: 1800, max: 2800 },
      rareComponents: { min: 1200, max: 2000 },
      weapons: { min: 1500, max: 2400 },
      defenseItems: { min: 1500, max: 2400 }
    }
  },
  blackCharter: {
    actionId: "black_charter",
    cooldownMinutes: 24,
    durationMinutes: 8,
    costDirtyCash: 2500,
    heatGain: 9,
    specialOfferDiscountPct: 6,
    purchaseCustomsRiskPct: 15,
    offerItems: ["tech-core", "combat-module", "smg", "bazooka", "defense-tower", "cameras", "ghost-serum", "overdrive-x"]
  },
  evacuationCorridor: {
    actionId: "evacuation_corridor",
    cooldownMinutes: 26,
    durationMinutes: 7,
    costCleanCash: 1800,
    heatGain: 5,
    escapeChanceBonusPct: 18,
    peopleLossReductionPct: 10,
    equipmentLossReductionPct: 10,
    retreatReturnTimeReductionPct: 12,
    gangMovementTimeReductionPct: 10,
    customsRiskPct: 6
  },
  customsInspection: {
    intervalMinutes: 8,
    passiveRiskPct: 3,
    heatThreshold: 150,
    heatRiskPct: 8,
    smugglingTunnelThreshold: 6,
    smugglingTunnelRiskPct: 5,
    stockExchangeSynergyRiskPct: 5,
    discountDisabledMinutes: 8,
    hangarHeatGain: 14,
    nextImportCostPenaltyPct: 20
  }
};
