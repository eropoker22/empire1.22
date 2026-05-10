import type { VipLoungeBalanceConfig } from "../contracts/balance-config";

export const freeModeVipLoungeConfig: VipLoungeBalanceConfig = {
  id: "vip_lounge",
  buildingTypeId: "vip_lounge",
  countOnMap: 3,
  category: ["rare", "elite_rumors", "high_truth_intel", "influence"],
  cleanCashPerMinute: 105,
  dirtyCashPerMinute: 30,
  influencePerMinute: 0.48,
  populationPerMinute: 0,
  heatPerMinute: 0.13,
  noIntelPower: true,
  noEliteContacts: true,
  noPopulationProduction: true,
  noLaundering: true,
  noAuditRisk: true,
  passiveRumor: {
    baseChancePct: 32,
    reliabilityLabels: ["nízká spolehlivost", "střední spolehlivost", "vysoká spolehlivost"],
    rumorTypes: [
      "political_pressure",
      "financial_deal",
      "police_warning",
      "planned_attack",
      "revenge_plan",
      "casino_money",
      "smuggling_route",
      "drug_distribution",
      "hidden_weakness",
      "weak_defense",
      "storage_hint",
      "trap_suspicion",
      "fake"
    ]
  },
  network: {
    tiers: [
      {
        minOwned: 1,
        maxOwned: 1,
        incomeMultiplier: 1,
        influenceMultiplier: 1,
        heatMultiplier: 1,
        rumorIntervalMinutes: 6,
        truthChancePct: 68,
        districtHintChancePct: 35,
        buildingHintChancePct: 18,
        reliabilityLabelChancePct: 25
      },
      {
        minOwned: 2,
        maxOwned: 2,
        incomeMultiplier: 1.08,
        influenceMultiplier: 1.1,
        heatMultiplier: 1.06,
        rumorIntervalMinutes: 5,
        truthChancePct: 78,
        districtHintChancePct: 45,
        buildingHintChancePct: 26,
        reliabilityLabelChancePct: 40
      },
      {
        minOwned: 3,
        maxOwned: null,
        incomeMultiplier: 1.16,
        influenceMultiplier: 1.2,
        heatMultiplier: 1.12,
        rumorIntervalMinutes: 4,
        truthChancePct: 86,
        districtHintChancePct: 55,
        buildingHintChancePct: 34,
        reliabilityLabelChancePct: 55
      }
    ]
  }
};
