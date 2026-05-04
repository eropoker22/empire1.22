import type { StripClubBalanceConfig } from "../contracts/balance-config";

export const freeModeStripClubConfig: StripClubBalanceConfig = {
  id: "strip_club",
  buildingTypeId: "strip_club",
  countOnMap: 17,
  category: ["economy", "influence", "rumors", "social_network"],
  cleanCashPerMinute: 75,
  dirtyCashPerMinute: 65,
  influencePerMinute: 0.38,
  heatPerMinute: 0.18,
  noLaundering: true,
  noAuditRisk: true,
  passiveRumorIntervalMinutes: 10,
  baseRumorChancePct: 18,
  baseTruthChancePct: 55,
  truthChancePctPerExtraClub: 3,
  maxTruthChancePct: 75,
  districtHintChancePct: 35,
  buildingHintChancePct: 20,
  rumorTypes: ["money", "relationships", "police", "attacks", "storage", "traps", "laundering", "fake"],
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
    cooldownMinutes: 18,
    durationMinutes: 8,
    cleanCashCost: 800,
    cleanIncomeBonusPct: 45,
    dirtyIncomeBonusPct: 35,
    influenceBonusPct: 55,
    heatBonusPct: 50,
    rumorChanceFlatBonusPct: 10
  },
  barWhispers: {
    actionId: "bar_whispers",
    cooldownMinutes: 14,
    influenceCost: 25,
    heatGain: 2
  },
  privateParty: {
    actionId: "private_party",
    cooldownMinutes: 24,
    durationMinutes: 10,
    cleanCashCost: 1500,
    instantInfluenceGain: 8,
    influenceProductionBonusPct: 70,
    extraRumorChancePct: 45,
    contactChancePct: 20,
    heatGain: 6,
    scandalChancePct: 12,
    scandalHeatGain: 10,
    scandalInfluenceLoss: 4
  },
  contacts: [
    { id: "city_official", label: "Městský úředník", effectSummary: "next heat gain -10 % na 10 minut", durationMinutes: 10 },
    { id: "dirty_lawyer", label: "Špinavý právník", effectSummary: "next audit or raid chance -8 % na 10 minut", durationMinutes: 10 },
    { id: "street_informant", label: "Pouliční informátor", effectSummary: "next rumor truth chance +20 %" },
    { id: "contact_dealer", label: "Dealer kontaktů", effectSummary: "next influence action cost -10 %" },
    { id: "bodyguard_broker", label: "Bodyguard broker", effectSummary: "next defense action effectiveness +10 %" }
  ]
};
