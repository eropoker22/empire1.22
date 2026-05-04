export interface CraftRecipeBalanceConfig {
  label: string;
  durationTicks: number;
  inputCosts: Record<string, number>;
  outputResourceKey: string;
  outputResourceLabel: string;
  outputAmount: number;
}

export interface CraftBuildingBalanceConfig {
  recipes: Record<string, CraftRecipeBalanceConfig>;
}

export interface ConflictBalanceConfig {
  spyCooldownTicks: number;
  attackCooldownTicks: number;
  minAttackDurationTicks?: number;
  attackHeatGain?: number;
  spyBaseSuccessChance: number;
  spyTrapRevealChance: number;
  trapAttackLosses: number;
  reportsLimit: number;
  catastropheChance?: number;
}

export interface BuildingActionBalanceConfig {
  actionId: string;
  buildingType: string;
  label: string;
  description: string;
  durationMs: number;
  cooldownMs: number;
  inputCost: Record<string, number>;
  outputGain: Record<string, number>;
  heatGain: number;
  influenceChange: number;
  effectModifiers?: BuildingActionEffectModifiers;
  requiredOwner: boolean;
  allowedIfContested: boolean;
  reportText: string;
}

export interface BuildingActionEffectModifiers {
  incomeMultiplier?: number;
  cleanIncomeMultiplier?: number;
  dirtyIncomeMultiplier?: number;
  influenceMultiplier?: number;
  heatMultiplier?: number;
  influencePerDay?: number;
  heatPerDay?: number;
  attackMultiplier?: number;
  defenseMultiplier?: number;
}

export interface FixedBuildingBalanceConfig {
  cleanPerHour: number;
  dirtyPerHour: number;
  heatPerDay: number;
  influencePerDay: number;
  maxLevel: number;
}

export interface CasinoAuditRiskTierConfig {
  maxLaunderedAmount: number | null;
  riskPct: number;
}

export interface CasinoUpgradeConfig {
  level: number;
  cleanCashCost: number;
  techCoreCost?: number;
  combatModuleCost?: number;
  incomeBonusPct: number;
  launderingLimitBonusPct: number;
  feeReductionPct?: number;
  actionHeatReductionPct?: number;
}

export interface CasinoBalanceConfig {
  buildingTypeId: string;
  countOnMap: number;
  category: string[];
  cleanCashPerMinute: number;
  dirtyCashPerMinute: number;
  influencePerMinute: number;
  heatPerMinute: number;
  launderingCapacity: number;
  baseAuditRiskPct: number;
  auditWindowMinutes: number;
  auditCheckEveryMinutes: number;
  quietBackroom: {
    actionId: string;
    cooldownMinutes: number;
    minimumDirtyCash: number;
    dirtyCashSharePct: number;
    maxDirtyCashPerAction: number;
    feePct: number;
    heatGain: number;
    influenceGain: number;
    auditRiskBonusPct: number;
    auditRiskDurationMinutes: number;
  };
  vipNight: {
    actionId: string;
    cooldownMinutes: number;
    durationMinutes: number;
    cleanIncomeBonusPct: number;
    dirtyIncomeBonusPct: number;
    influenceBonusPct: number;
    heatBonusPct: number;
    auditRiskBonusPct: number;
  };
  bribedInspector: {
    actionId: string;
    cooldownMinutes: number;
    cleanCashCost: number;
    protectionMinutes: number;
    failureChancePct: number;
    successHeatReduction: number;
    successAuditRiskReductionPct: number;
    successInfluenceGain: number;
    failureHeatGain: number;
    failureAuditRiskBonusPct: number;
    failureAuditRiskDurationMinutes: number;
  };
  auditRiskTiers: CasinoAuditRiskTierConfig[];
  auditConsequences: {
    lightInspection: { incomePenaltyPct: number; durationMinutes: number };
    seizedBooks: { dirtyCashLossPct: number };
    frozenAccounts: { launderingBlockedMinutes: number };
    policeRaid: { heatGain: number; incomePenaltyPct: number; durationMinutes: number };
    closedVipLounge: { vipBlockedMinutes: number };
  };
  upgrades: CasinoUpgradeConfig[];
}

export interface ExchangeOfficeBalanceConfig {
  id: string;
  buildingTypeId: string;
  countOnMap: number;
  category: string[];
  cleanCashPerMinute: number;
  dirtyCashPerMinute: number;
  influencePerMinute: number;
  heatPerMinute: number;
  launderingCapacity: number;
  baseAuditRiskPct: number;
  auditWindowMinutes: number;
  auditCheckEveryMinutes: number;
  network: {
    incomeBonusPctPerExtraExchange: number;
    launderingLimitBonusPctPerExtraExchange: number;
    heatBonusPctPerExtraExchange: number;
    maxIncomeMultiplier: number;
    maxLaunderingLimitMultiplier: number;
    maxHeatMultiplier: number;
  };
  goodRate: {
    actionId: string;
    cooldownMinutes: number;
    minimumDirtyCash: number;
    dirtyCashSharePct: number;
    maxDirtyCashPerAction: number;
    feePct: number;
    heatGain: number;
    influenceGain: number;
    auditRiskBonusPct: number;
    auditRiskDurationMinutes: number;
  };
  auditRiskTiers: CasinoAuditRiskTierConfig[];
  auditConsequences: {
    suspiciousTransaction: { incomePenaltyPct: number; durationMinutes: number };
    blockedTransfer: { actionBlockedMinutes: number };
    lostClient: { dirtyIncomePenaltyPct: number; durationMinutes: number };
    documentCheck: { heatGain: number };
    seizedCash: { dirtyCashLossPct: number };
  };
}

export interface ArcadeBalanceConfig {
  id: string;
  buildingTypeId: string;
  countOnMap: number;
  category: string[];
  cleanCashPerMinute: number;
  dirtyCashPerMinute: number;
  influencePerMinute: number;
  heatPerMinute: number;
  launderingCapacity: number;
  baseAuditRiskPct: number;
  auditWindowMinutes: number;
  auditCheckEveryMinutes: number;
  network: {
    incomeBonusPctPerExtraArcade: number;
    launderingLimitBonusPctPerExtraArcade: number;
    heatBonusPctPerExtraArcade: number;
    maxIncomeMultiplier: number;
    maxLaunderingLimitMultiplier: number;
    maxHeatMultiplier: number;
  };
  nightMachines: {
    actionId: string;
    cooldownMinutes: number;
    durationMinutes: number;
    cleanIncomeBonusPct: number;
    dirtyIncomeBonusPct: number;
    influenceBonusPct: number;
    heatBonusPct: number;
    auditRiskBonusPct: number;
  };
  backCashdesk: {
    actionId: string;
    cooldownMinutes: number;
    minimumDirtyCash: number;
    dirtyCashSharePct: number;
    maxDirtyCashPerAction: number;
    feePct: number;
    heatGain: number;
    influenceGain: number;
    auditRiskBonusPct: number;
    auditRiskDurationMinutes: number;
  };
  auditRiskTiers: CasinoAuditRiskTierConfig[];
  auditConsequences: {
    machineInspection: { incomePenaltyPct: number; durationMinutes: number };
    seizedMachine: { dirtyIncomePenaltyPct: number; durationMinutes: number };
    closedBackRoom: { actionBlockedMinutes: number };
    operatingFine: { cleanCashLoss: number };
    localRaid: { heatGain: number };
  };
}

export interface ApartmentBlockBalanceConfig {
  id: string;
  buildingTypeId: string;
  countOnMap: number;
  category: string[];
  populationPerMinute: number;
  baseCapacity: number;
  cleanCashPerMinute: 0;
  dirtyCashPerMinute: 0;
  influencePerMinute: 0;
  heatPerMinute: 0;
  noAuditRisk: true;
  noLaundering: true;
  productionStopsAtCapacity: true;
  requiresManualCollect: true;
  allowPartialCollect: true;
  network: {
    populationProductionBonusPctPerExtraBlock: number;
    capacityBonusPctPerExtraBlock: number;
    maxPopulationProductionMultiplier: number;
    maxCapacityMultiplier: number;
  };
  collectPopulation: {
    actionId: string;
    cooldownMinutes: number;
  };
}

export interface WarehouseBalanceConfig {
  id: string;
  buildingTypeId: string;
  countOnMap: number;
  category: string[];
  cleanCashPerMinute: number;
  dirtyCashPerMinute: 0;
  influencePerMinute: 0;
  heatPerMinute: number;
  auditRisk: 0;
  noLaundering: true;
  specialActions: "none";
  storageCapacityBonus: number;
  storageCapacities: {
    genericResources: number;
    chemicals: number;
    biomass: number;
    metalParts: number;
    techCore: number;
    combatModule: number;
    drugsAndBoosts: number;
    weaponsAndDefense: number;
  };
  network: {
    incomeBonusPctPerExtraWarehouse: number;
    storageCapacityBonusPctPerExtraWarehouse: number;
    heatBonusPctPerExtraWarehouse: number;
    maxIncomeMultiplier: number;
    maxStorageCapacityMultiplier: number;
    maxHeatMultiplier: number;
  };
  upgrades?: Record<number, {
    cleanCashCost: number;
    metalPartsCost: number;
    techCoreCost: number;
    incomeBonusPct: number;
    storageBonusPct: number;
    heatReductionPct: number;
  }>;
}

export interface ClinicBalanceConfig {
  id: string;
  buildingTypeId: string;
  countOnMap: number;
  category: string[];
  cleanCashPerMinute: number;
  dirtyCashPerMinute: 0;
  influencePerMinute: 0;
  heatPerMinute: number;
  noLaundering: true;
  noAuditRisk: true;
  recovery: {
    baseRecoveryRatePct: number;
    recoveryRatePctPerExtraClinic: number;
    maxRecoveryRatePct: number;
    poolTtlMinutes: number;
    toxicTrapRateMultiplier: number;
  };
  network: {
    incomeBonusPctPerExtraClinic: number;
    heatBonusPctPerExtraClinic: number;
    maxIncomeMultiplier: number;
    maxHeatMultiplier: number;
  };
  stabilizationProtocol: {
    actionId: string;
    cooldownMinutes: number;
    cleanCashCost: number;
    heatGain: number;
  };
}

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

export interface RecruitmentCenterBalanceConfig {
  id: "recruitment_center";
  buildingTypeId: "recruitment_center";
  countOnMap: number;
  category: string[];
  cleanCashPerMinute: number;
  dirtyCashPerMinute: 0;
  influencePerMinute: 0;
  heatPerMinute: number;
  noSpecialActions: true;
  noLaundering: true;
  noAuditRisk: true;
  populationSupport: {
    populationProductionBonusPctPerCenter: number;
    apartmentCapacityBonusPctPerCenter: number;
    maxPopulationProductionBonusPct: number;
    maxApartmentCapacityBonusPct: number;
  };
  combatSupport: {
    attackWeaponStrengthBonusPctPerCenter: number;
    defenseItemStrengthBonusPctPerCenter: number;
    maxAttackWeaponStrengthBonusPct: number;
    maxDefenseItemStrengthBonusPct: number;
    maxCombinedCameraAlarmBonusPct: number;
  };
  network: {
    incomeBonusPctPerExtraCenter: number;
    heatBonusPctPerExtraCenter: number;
    maxIncomeMultiplier: number;
    maxHeatMultiplier: number;
  };
}

export interface FitnessClubBalanceConfig {
  id: "fitness_club";
  buildingTypeId: "fitness_club";
  countOnMap: number;
  category: string[];
  cleanCashPerMinute: number;
  dirtyCashPerMinute: 0;
  influencePerMinute: 0;
  populationPerMinute: 0;
  heatPerMinute: number;
  actions: [];
  noSpecialActions: true;
  noLaundering: true;
  noAuditRisk: true;
  noPopulationProduction: true;
  noIntelPower: true;
  combatConditioning: {
    attackStrengthBonusPctPerClub: number;
    defenseStrengthBonusPctPerClub: number;
    maxAttackStrengthBonusPct: number;
    maxDefenseStrengthBonusPct: number;
    combinedRecruitmentFitnessAttackCapPct: number;
    combinedRecruitmentFitnessDefenseCapPct: number;
    attackApplication: Record<string, number>;
    defenseApplication: Record<string, number>;
  };
  network: {
    incomeBonusPctPerExtraClub: number;
    heatBonusPctPerExtraClub: number;
    maxIncomeMultiplier: number;
    maxHeatMultiplier: number;
  };
}

export interface ShoppingMallBalanceConfig {
  id: "shopping_mall";
  buildingTypeId: "shopping_mall";
  countOnMap: number;
  category: string[];
  cleanCashPerMinute: number;
  dirtyCashPerMinute: number;
  influencePerMinute: number;
  heatPerMinute: number;
  actions: [];
  noSpecialActions: true;
  noLaundering: true;
  noAuditRisk: true;
  marketDiscount: {
    discountPctPerMall: number;
    maxDiscountPct: number;
    regularMarketWeight: number;
    blackMarketWeight: number;
    playerMarketWeight: number;
    emergencyMarketWeight: number;
    minFinalPriceMultiplier: number;
  };
  marketFeeReduction: {
    feeReductionPctPerMall: number;
    maxFeeReductionPct: number;
  };
  network: {
    cleanIncomeBonusPctPerExtraMall: number;
    dirtyIncomeBonusPctPerExtraMall: number;
    influenceBonusPctPerExtraMall: number;
    heatBonusPctPerExtraMall: number;
    maxCleanIncomeMultiplier: number;
    maxDirtyIncomeMultiplier: number;
    maxInfluenceMultiplier: number;
    maxHeatMultiplier: number;
  };
}

export interface GarageBalanceConfig {
  id: "garage";
  buildingTypeId: "garage";
  countOnMap: number;
  category: string[];
  cleanCashPerMinute: number;
  dirtyCashPerMinute: 0;
  influencePerMinute: 0;
  heatPerMinute: number;
  actions: [];
  noSpecialActions: true;
  noLaundering: true;
  noAuditRisk: true;
  cooldownReduction: {
    reductionPctPerGarage: number;
    maxReductionPct: number;
    fullBonusActionCategories: string[];
    halfBonusActionCategories: string[];
    excludedActionCategories: string[];
  };
  network: {
    incomeBonusPctPerExtraGarage: number;
    heatBonusPctPerExtraGarage: number;
    maxIncomeMultiplier: number;
    maxHeatMultiplier: number;
  };
}

export interface CarDealerBalanceConfig {
  id: "car_dealer";
  buildingTypeId: "car_dealer";
  legacyBuildingTypeIds?: string[];
  countOnMap: number;
  category: string[];
  cleanCashPerMinute: number;
  dirtyCashPerMinute: number;
  influencePerMinute: 0;
  heatPerMinute: number;
  actions: [];
  noSpecialActions: true;
  noLaundering: true;
  noAuditRisk: true;
  noPopulationProduction: true;
  noIntelPower: true;
  mobility: {
    bonusPctPerDealer: number;
    maxBonusPct: number;
    fullBonusActionCategories: string[];
    halfBonusActionCategories: string[];
    smallBonusActionCategories: string[];
    excludedActionCategories: string[];
  };
  cooldownReduction: {
    reductionPctPerDealer: number;
    maxReductionPct: number;
    combinedGarageDealerMaxReductionPct: number;
    fullBonusActionCategories: string[];
    halfBonusActionCategories: string[];
    smallBonusActionCategories: string[];
    excludedActionCategories: string[];
  };
  escapeChance: {
    bonusPctPerDealer: number;
    maxBonusPct: number;
    appliesTo: string[];
  };
  network: {
    cleanIncomeBonusPctPerExtraDealer: number;
    dirtyIncomeBonusPctPerExtraDealer: number;
    heatBonusPctPerExtraDealer: number;
    maxCleanIncomeMultiplier: number;
    maxDirtyIncomeMultiplier: number;
    maxHeatMultiplier: number;
  };
}

export interface SmugglingTunnelBalanceConfig {
  id: "smuggling_tunnel";
  buildingTypeId: "smuggling_tunnel";
  countOnMap: number;
  category: string[];
  cleanCashPerMinute: 0;
  dirtyCashPerMinute: number;
  influencePerMinute: 0;
  populationPerMinute: 0;
  passiveHeatPerMinute: number;
  noCleanCash: true;
  noInfluence: true;
  noPopulationProduction: true;
  noIntelPower: true;
  noLaundering: true;
  noAuditRisk: true;
  batch: {
    baseCapacityDirtyCash: number;
    minCollectDirtyCash: number;
    heatByCollectedDirtyCash: Array<{
      minDirtyCash: number;
      maxDirtyCash?: number;
      heatGain: number;
    }>;
  };
  collectBatch: {
    actionId: "collect_smuggling_batch";
    minStoredDirtyCash: number;
  };
  silentChannel: {
    actionId: "silent_channel";
    cooldownMinutes: number;
    durationMinutes: number;
    costDirtyCash: number;
    dirtyProductionMultiplier: number;
    passiveHeatMultiplier: number;
    batchCapacityMultiplier: number;
    raidChancePct: number;
    blockedMinutesOnClosedEntrance: number;
  };
  network: {
    dirtyProductionBonusPctPerExtraTunnel: number;
    batchCapacityBonusPctPerExtraTunnel: number;
    passiveHeatBonusPctPerExtraTunnel: number;
    maxDirtyProductionMultiplier: number;
    maxBatchCapacityMultiplier: number;
    maxPassiveHeatMultiplier: number;
  };
}

export interface RecyclingCenterBalanceConfig {
  id: "recycling_center";
  buildingTypeId: "recycling_center";
  countOnMap: number;
  category: string[];
  cleanCashPerMinute: number;
  dirtyCashPerMinute: 0;
  influencePerMinute: 0;
  heatPerMinute: number;
  noLaundering: true;
  noAuditRisk: true;
  noPopulationProduction: true;
  noPopulationRecovery: true;
  salvage: {
    baseRatePct: number;
    ratePctPerExtraCenter: number;
    maxRatePct: number;
    poolTtlMinutes: number;
    rareItems: string[];
    recoverableItems: Record<string, { itemName: string; category: string }>;
  };
  extractLosses: {
    actionId: "extract_losses";
    cooldownMinutes: number;
    cleanCashCost: number;
    heatGain: number;
  };
  network: {
    incomeBonusPctPerExtraCenter: number;
    heatBonusPctPerExtraCenter: number;
    maxIncomeMultiplier: number;
    maxHeatMultiplier: number;
  };
}

export interface PowerStationBalanceConfig {
  id: "power_station";
  buildingTypeId: "power_station";
  countOnMap: number;
  category: string[];
  cleanCashPerMinute: number;
  dirtyCashPerMinute: 0;
  influencePerMinute: 0;
  heatPerMinute: number;
  noPowerCapacity: true;
  noEnergyResource: true;
  noLaundering: true;
  noAuditRisk: true;
  infrastructure: {
    bonusPctPerStation: number;
    maxBonusPct: number;
    weights: {
      factoryProductionSpeed: number;
      armoryProductionSpeed: number;
      warehouseStorageCapacity: number;
      clinicRecoveryRate: number;
      casinoIncome: number;
      arcadeIncome: number;
      exchangeIncome: number;
      stripClubIncome: number;
      apartmentPopulationProduction: number;
    };
  };
  network: {
    incomeBonusPctPerExtraStation: number;
    heatBonusPctPerExtraStation: number;
    maxIncomeMultiplier: number;
    maxHeatMultiplier: number;
  };
  defense: {
    cameraStrengthBonusPctPerStation: number;
    alarmStrengthBonusPctPerStation: number;
    maxCameraStrengthBonusPct: number;
    maxAlarmStrengthBonusPct: number;
  };
  backupGridSwitch: {
    actionId: "backup_grid_switch";
    cooldownMinutes: number;
    durationMinutes: number;
    cleanCashCost: number;
    heatGain: number;
    temporaryInfrastructureBonusPct: number;
    cameraStrengthBonusPct: number;
    alarmStrengthBonusPct: number;
    factoryProductionSpeedBonusPct: number;
    armoryProductionSpeedBonusPct: number;
  };
}

/**
 * Responsibility: Balance knobs consumed by the shared game core.
 * Belongs here: multipliers, limits, pacing values, and victory tuning.
 * Does not belong here: runtime process settings or transport-specific options.
 */
export interface BalanceConfig {
  incomeMultiplier: number;
  productionMultiplier: number;
  cooldownMultiplier: number;
  maxPlayersPerServer: number;
  maxAllianceSize: number;
  buildSlotLimit: number;
  eventFrequencyMultiplier: number;
  policePressureMultiplier: number;
  raidIntensityMultiplier: number;
  expansionSpeedMultiplier: number;
  dayLengthTicks: number;
  nightLengthTicks: number;
  victoryConditionKey: string;
  /**
   * Fraction of active districts required for control victory.
   * Defaults to 1 in older test fixtures that do not provide it.
   */
  districtControlVictoryThreshold?: number;
  startingResources: Record<string, number>;
  conflict?: ConflictBalanceConfig;
  productionBuildings?: Record<
    string,
    {
      resourceKey: string;
      resourceLabel: string;
      amountPerTick: number;
      storageCap: number;
    }
  >;
  craftBuildings?: Record<string, CraftBuildingBalanceConfig>;
  fixedBuildings?: Record<string, FixedBuildingBalanceConfig>;
  buildingActions?: Record<string, BuildingActionBalanceConfig>;
  casino?: CasinoBalanceConfig;
  exchangeOffice?: ExchangeOfficeBalanceConfig;
  arcade?: ArcadeBalanceConfig;
  apartmentBlock?: ApartmentBlockBalanceConfig;
  warehouse?: WarehouseBalanceConfig;
  clinic?: ClinicBalanceConfig;
  stripClub?: StripClubBalanceConfig;
  restaurant?: RestaurantBalanceConfig;
  convenienceStore?: ConvenienceStoreBalanceConfig;
    shoppingMall?: ShoppingMallBalanceConfig;
    recruitmentCenter?: RecruitmentCenterBalanceConfig;
    fitnessClub?: FitnessClubBalanceConfig;
    garage?: GarageBalanceConfig;
    carDealer?: CarDealerBalanceConfig;
    smugglingTunnel?: SmugglingTunnelBalanceConfig;
  recyclingCenter?: RecyclingCenterBalanceConfig;
  powerStation?: PowerStationBalanceConfig;
}
