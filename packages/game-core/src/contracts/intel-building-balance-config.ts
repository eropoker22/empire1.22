export interface StripClubBalanceConfig {
  id: "strip_club";
  buildingTypeId: "strip_club";
  countOnMap: number;
  category: string[];
  cleanCashPerMinute: number;
  dirtyCashPerMinute: number;
  influencePerMinute: number;
  heatPerMinute: number;
  noLaundering: true;
  noAuditRisk: true;
  passiveRumorIntervalMinutes: number;
  baseRumorChancePct: number;
  baseTruthChancePct: number;
  truthChancePctPerExtraClub: number;
  maxTruthChancePct: number;
  districtHintChancePct: number;
  buildingHintChancePct: number;
  rumorTypes: string[];
  network: {
    incomeBonusPctPerExtraStripClub: number;
    influenceBonusPctPerExtraStripClub: number;
    rumorChanceBonusPctPerExtraStripClub: number;
    heatBonusPctPerExtraStripClub: number;
    maxIncomeMultiplier: number;
    maxInfluenceMultiplier: number;
    maxRumorMultiplier: number;
    maxHeatMultiplier: number;
  };
  vipLounge: {
    actionId: "vip_lounge";
    cooldownMinutes: number;
    durationMinutes: number;
    cleanCashCost: number;
    cleanIncomeBonusPct: number;
    dirtyIncomeBonusPct: number;
    influenceBonusPct: number;
    heatBonusPct: number;
    rumorChanceFlatBonusPct: number;
  };
  barWhispers: {
    actionId: "bar_whispers";
    cooldownMinutes: number;
    influenceCost: number;
    heatGain: number;
  };
  privateParty: {
    actionId: "private_party";
    cooldownMinutes: number;
    durationMinutes: number;
    cleanCashCost: number;
    instantInfluenceGain: number;
    influenceProductionBonusPct: number;
    extraRumorChancePct: number;
    contactChancePct: number;
    heatGain: number;
    scandalChancePct: number;
    scandalHeatGain: number;
    scandalInfluenceLoss: number;
  };
  contacts: Array<{
    id: string;
    label: string;
    effectSummary: string;
    durationMinutes?: number;
  }>;
}

export interface RestaurantBalanceConfig {
  id: "restaurant";
  buildingTypeId: "restaurant";
  countOnMap: number;
  category: string[];
  cleanCashPerMinute: number;
  dirtyCashPerMinute: 0;
  influencePerMinute: number;
  heatPerMinute: number;
  noSpecialActions: boolean;
  noLaundering: true;
  noAuditRisk: true;
  passiveRumorIntervalMinutes: number;
  baseRumorChancePct: number;
  truthChanceByOwnedCount: Array<{
    minOwned: number;
    maxOwned: number | null;
    truthChancePct: number;
  }>;
  districtHintChancePct: number;
  buildingHintChancePct: number;
  rumorTypes: string[];
  network: {
    incomeBonusPctPerExtraRestaurant: number;
    influenceBonusPctPerExtraRestaurant: number;
    rumorChanceBonusPctPerExtraRestaurant: number;
    heatBonusPctPerExtraRestaurant: number;
    maxIncomeMultiplier: number;
    maxInfluenceMultiplier: number;
    maxRumorMultiplier: number;
    maxHeatMultiplier: number;
  };
}

export interface VipLoungeBalanceConfig {
  id: "vip_lounge";
  buildingTypeId: "vip_lounge";
  countOnMap: 3;
  category: string[];
  cleanCashPerMinute: number;
  dirtyCashPerMinute: number;
  influencePerMinute: number;
  populationPerMinute: 0;
  heatPerMinute: number;
  noIntelPower: true;
  noEliteContacts: true;
  noPopulationProduction: true;
  noLaundering: true;
  noAuditRisk: true;
  passiveRumor: {
    baseChancePct: number;
    reliabilityLabels: string[];
    rumorTypes: string[];
  };
  network: {
    tiers: Array<{
      minOwned: number;
      maxOwned: number | null;
      incomeMultiplier: number;
      influenceMultiplier: number;
      heatMultiplier: number;
      rumorIntervalMinutes: number;
      truthChancePct: number;
      districtHintChancePct: number;
      buildingHintChancePct: number;
      reliabilityLabelChancePct: number;
    }>;
  };
}

export interface ConvenienceStoreBalanceConfig {
  id: "convenience_store";
  buildingTypeId: "convenience_store";
  countOnMap: number;
  category: string[];
  cleanCashPerMinute: number;
  dirtyCashPerMinute: number;
  influencePerMinute: number;
  heatPerMinute: number;
  noSpecialActions: true;
  noLaundering: true;
  noAuditRisk: true;
  passiveRumorIntervalMinutes: number;
  baseRumorChancePct: number;
  truthChanceByOwnedCount: Array<{
    minOwned: number;
    maxOwned: number | null;
    truthChancePct: number;
  }>;
  districtHintChancePct: number;
  areaHintChancePct: number;
  buildingHintChancePct: number;
  rumorTypes: string[];
  network: {
    cleanIncomeBonusPctPerExtraStore: number;
    dirtyIncomeBonusPctPerExtraStore: number;
    influenceBonusPctPerExtraStore: number;
    rumorChanceBonusPctPerExtraStore: number;
    heatBonusPctPerExtraStore: number;
    maxCleanIncomeMultiplier: number;
    maxDirtyIncomeMultiplier: number;
    maxInfluenceMultiplier: number;
    maxRumorMultiplier: number;
    maxHeatMultiplier: number;
  };
  restaurantSynergy: {
    firstStoreThreshold: number;
    firstRestaurantThreshold: number;
    firstCivilRumorChanceBonusPct: number;
    secondStoreThreshold: number;
    secondRestaurantThreshold: number;
    secondCivilRumorChanceBonusPct: number;
    truthStoreThreshold: number;
    truthRestaurantThreshold: number;
    civilRumorTruthBonusPct: number;
  };
}
