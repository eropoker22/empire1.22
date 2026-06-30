import type { ApartmentBlockBalanceConfig } from "../contracts/balance-config";

export const freeModeApartmentBlockConfig: ApartmentBlockBalanceConfig = {
  id: "apartment_block",
  buildingTypeId: "apartment_block",
  countOnMap: 29,
  category: ["population", "gang_members"],
  populationPerMinute: 2,
  baseCapacity: 50,
  cleanCashPerMinute: 0,
  dirtyCashPerMinute: 0,
  influencePerMinute: 0,
  heatPerMinute: 0,
  noAuditRisk: true,
  noLaundering: true,
  productionStopsAtCapacity: true,
  requiresManualCollect: true,
  allowPartialCollect: true,
  network: {
    populationProductionBonusPctPerExtraBlock: 6,
    capacityBonusPctPerExtraBlock: 8,
    maxPopulationProductionMultiplier: 1.55,
    maxCapacityMultiplier: 1.75
  },
  collectPopulation: {
    actionId: "collect_population",
    cooldownMinutes: 0,
    minCollectPopulation: 10
  }
};
