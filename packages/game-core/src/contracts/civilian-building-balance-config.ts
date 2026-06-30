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
    minCollectPopulation: number;
  };
}

export interface SchoolBalanceConfig {
  id: "school";
  buildingTypeId: "school";
  countOnMap: number;
  category: string[];
  cleanCashPerMinute: number;
  dirtyCashPerMinute: 0;
  influencePerMinute: number;
  heatPerMinute: 0;
  populationPerMinute: number;
  baseStudentCapacity: number;
  noDirtyCash: true;
  noLaundering: true;
  noAuditRisk: true;
  noHeat: true;
  productionStopsAtCapacity: true;
  requiresManualCollect: true;
  allowPartialCollect: true;
  network: {
    populationProductionBonusPctPerExtraSchool: number;
    studentCapacityBonusPctPerExtraSchool: number;
    incomeBonusPctPerExtraSchool: number;
    maxPopulationProductionMultiplier: number;
    maxStudentCapacityMultiplier: number;
    maxIncomeMultiplier: number;
  };
  talentPool: {
    baseChancePct: number;
    chancePctPerExtraSchool: number;
    maxChancePct: number;
    eveningCourseTalentChanceBonusPct: number;
    betterTalentChanceBonusPct: number;
  };
  collectStudents: {
    actionId: "collect_students";
    cooldownMinutes: number;
  };
  eveningCourse: {
    actionId: "evening_course";
    cooldownMinutes: number;
    durationMinutes: number;
    costCleanCash: number;
    heatGain: 0;
    populationProductionMultiplier: number;
    talentChanceFlatBonusPct: number;
    betterTalentChanceBonusPct: number;
    cleanIncomeMultiplier: number;
    stackable: false;
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
