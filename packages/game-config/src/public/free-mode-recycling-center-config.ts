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
    rareItems: ["tech-core", "combat-module", "ghost-serum", "overdrive-x", "grenade", "smg", "bazooka", "defense-tower"],
    recoverableItems: {
      chemicals: { itemName: "Chemicals", category: "materials" },
      biomass: { itemName: "Biomass", category: "materials" },
      "metal-parts": { itemName: "Metal Parts", category: "materials" },
      "tech-core": { itemName: "Tech Core", category: "rareComponents" },
      "combat-module": { itemName: "Combat Module", category: "rareComponents" },
      "neon-dust": { itemName: "Neon Dust", category: "drugsAndBoosts" },
      "pulse-shot": { itemName: "Pulse Shot", category: "drugsAndBoosts" },
      "velvet-smoke": { itemName: "Velvet Smoke", category: "drugsAndBoosts" },
      "ghost-serum": { itemName: "Ghost Serum", category: "drugsAndBoosts" },
      "overdrive-x": { itemName: "Overdrive X", category: "drugsAndBoosts" },
      "baseball-bat": { itemName: "Baseballová pálka", category: "weapons" },
      pistol: { itemName: "Pouliční pistole", category: "weapons" },
      grenade: { itemName: "Granát", category: "weapons" },
      smg: { itemName: "Samopal", category: "weapons" },
      bazooka: { itemName: "Bazuka", category: "weapons" },
      vest: { itemName: "Neprůstřelná vesta", category: "defenseItems" },
      barricades: { itemName: "Ocelové barikády", category: "defenseItems" },
      cameras: { itemName: "Bezpečnostní kamery", category: "defenseItems" },
      "defense-tower": { itemName: "Automatické kulometné stanoviště", category: "defenseItems" },
      alarm: { itemName: "Alarm", category: "defenseItems" }
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
