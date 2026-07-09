import type { PowerStationBalanceConfig } from "../contracts/balance-config";

export const freeModePowerStationConfig: PowerStationBalanceConfig = {
  id: "power_station",
  buildingTypeId: "power_station",
  countOnMap: 9,
  category: ["infrastructure", "support", "defense_multiplier"],
  cleanCashPerMinute: 2780 / 60,
  dirtyCashPerMinute: 780 / 60,
  influencePerMinute: 0,
  heatPerMinute: 0.08,
  noPowerCapacity: true,
  noEnergyResource: true,
  noLaundering: true,
  noAuditRisk: true,
  infrastructure: {
    bonusPctPerStation: 4,
    maxBonusPct: 28,
    weights: {
      factoryProductionSpeed: 1,
      armoryProductionSpeed: 1,
      warehouseStorageCapacity: 0.7,
      clinicRecoveryRate: 0.5,
      casinoIncome: 0.4,
      arcadeIncome: 0.4,
      exchangeIncome: 0.4,
      stripClubIncome: 0.3,
      apartmentPopulationProduction: 0.25
    }
  },
  network: {
    incomeBonusPctPerExtraStation: 4,
    heatBonusPctPerExtraStation: 3,
    maxIncomeMultiplier: 1.24,
    maxHeatMultiplier: 1.18
  },
  defense: {
    cameraStrengthBonusPctPerStation: 5,
    alarmStrengthBonusPctPerStation: 5,
    maxCameraStrengthBonusPct: 35,
    maxAlarmStrengthBonusPct: 35
  },
  backupGridSwitch: {
    actionId: "backup_grid_switch",
    cooldownMinutes: 60,
    durationMinutes: 25,
    cleanCashCost: 3500,
    heatGain: 3,
    temporaryInfrastructureBonusPct: 12,
    cameraStrengthBonusPct: 20,
    alarmStrengthBonusPct: 20,
    factoryProductionSpeedBonusPct: 10,
    armoryProductionSpeedBonusPct: 10
  }
};
