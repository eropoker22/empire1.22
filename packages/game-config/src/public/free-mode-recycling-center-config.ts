import type { RecyclingCenterBalanceConfig } from "../contracts/balance-config";

export const freeModeRecyclingCenterConfig: RecyclingCenterBalanceConfig = {
  id: "recycling_center",
  buildingTypeId: "recycling_center",
  countOnMap: 14,
  category: ["support", "salvage", "item_recovery"],
  cleanCashPerMinute: 40,
  dirtyCashPerMinute: 0,
  influencePerMinute: 0,
  heatPerMinute: 0.08,
  noLaundering: true,
  noAuditRisk: true,
  noPopulationProduction: true,
  noPopulationRecovery: true,
  salvage: {
    baseRatePct: 12,
    ratePctPerExtraCenter: 3,
    maxRatePct: 34,
    poolTtlMinutes: 18,
    rareItems: ["tech-core", "combat-module"],
    recoverableItems: {
      chemicals: { itemName: "Chemicals", category: "materials" },
      biomass: { itemName: "Biomass", category: "materials" },
      "metal-parts": { itemName: "Metal Parts", category: "materials" },
      "tech-core": { itemName: "Tech Core", category: "materials" },
      "combat-module": { itemName: "Bojový modul", category: "materials" }
    }
  },
  extractLosses: {
    actionId: "extract_losses",
    cooldownMinutes: 16,
    cleanCashCost: 900,
    heatGain: 2
  },
  network: {
    incomeBonusPctPerExtraCenter: 4,
    heatBonusPctPerExtraCenter: 3,
    maxIncomeMultiplier: 1.28,
    maxHeatMultiplier: 1.21
  }
};
