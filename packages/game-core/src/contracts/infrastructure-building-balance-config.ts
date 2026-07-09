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
  dirtyCashPerMinute: number;
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
