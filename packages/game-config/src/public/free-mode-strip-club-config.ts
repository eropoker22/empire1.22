import type { StripClubBalanceConfig } from "../contracts/balance-config";

export const freeModeStripClubConfig: StripClubBalanceConfig = {
  id: "strip_club",
  buildingTypeId: "strip_club",
  countOnMap: 17,
  category: ["economy", "influence", "rumors", "social_network"],
  cleanCashPerMinute: 75,
  dirtyCashPerMinute: 65,
  influencePerMinute: 90 / 1_440,
  heatPerMinute: 85 / 1_440,
  noLaundering: true,
  noAuditRisk: true,
  passiveRumorIntervalMinutes: 30,
  baseRumorChancePct: 100,
  baseTruthChancePct: 55,
  truthChancePctPerExtraClub: 3,
  maxTruthChancePct: 75,
  districtHintChancePct: 35,
  buildingHintChancePct: 20,
  rumorTypes: ["money", "relationships", "police", "attacks", "storage", "laundering", "fake"],
  network: {
    incomeBonusPctPerExtraStripClub: 5,
    influenceBonusPctPerExtraStripClub: 7,
    rumorChanceBonusPctPerExtraStripClub: 8,
    heatBonusPctPerExtraStripClub: 4,
    maxIncomeMultiplier: 1.35,
    maxInfluenceMultiplier: 1.5,
    maxRumorMultiplier: 1.6,
    maxHeatMultiplier: 1.28
  },
  vipLounge: {
    actionId: "vip_lounge",
    cooldownMinutes: 60,
    durationMinutes: 30,
    cleanCashCost: 800,
    cleanIncomeBonusPct: 45,
    dirtyIncomeBonusPct: 35,
    influenceBonusPct: 55,
    heatBonusPct: 50,
    rumorChanceFlatBonusPct: 10
  },
  privateParty: {
    actionId: "private_party",
    cooldownMinutes: 30,
    durationMinutes: 10,
    cleanCashCost: 1500,
    instantInfluenceGain: 8,
    influenceProductionBonusPct: 70,
    extraRumorChancePct: 45,
    heatGain: 6,
    scandalChancePct: 12,
    scandalHeatGain: 10,
    scandalInfluenceLoss: 4
  }
};
