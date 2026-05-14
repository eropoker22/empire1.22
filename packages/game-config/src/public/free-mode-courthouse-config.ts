import type { CourthouseBalanceConfig } from "../contracts/balance-config";

export const freeModeCourthouseConfig: CourthouseBalanceConfig = {
  id: "courthouse",
  buildingTypeId: "court",
  countOnMap: 2,
  zone: "downtown",
  category: ["ultra_rare", "passive_legal_protection", "police_raid_mitigation", "influence"],
  cleanCashPerMinute: 105,
  dirtyCashPerMinute: 0,
  influencePerMinute: 0.72,
  populationPerMinute: 0,
  heatPerMinute: 0.08,
  actions: [],
  noSpecialActions: true,
  noIntelPower: true,
  noDirtyCash: true,
  noPopulationProduction: true,
  noLaundering: true,
  noAuditRisk: true,
  legalProtectionTiers: [
    {
      minOwned: 1,
      maxOwned: 1,
      cleanIncomeMultiplier: 1,
      influenceMultiplier: 1,
      heatMultiplier: 1,
      policeRaidConsequencesReductionPct: 50
    },
    {
      minOwned: 2,
      maxOwned: 99,
      cleanIncomeMultiplier: 1.14,
      influenceMultiplier: 1.18,
      heatMultiplier: 1.08,
      policeRaidConsequencesReductionPct: 75
    }
  ]
};
