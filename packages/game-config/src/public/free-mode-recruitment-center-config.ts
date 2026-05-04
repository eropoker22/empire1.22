import type { RecruitmentCenterBalanceConfig } from "../contracts/balance-config";

export const freeModeRecruitmentCenterConfig: RecruitmentCenterBalanceConfig = {
  id: "recruitment_center",
  buildingTypeId: "recruitment_center",
  countOnMap: 16,
  category: ["support", "population_support", "combat_multiplier"],
  cleanCashPerMinute: 35,
  dirtyCashPerMinute: 0,
  influencePerMinute: 0,
  heatPerMinute: 0.07,
  noSpecialActions: true,
  noLaundering: true,
  noAuditRisk: true,
  populationSupport: {
    populationProductionBonusPctPerCenter: 3,
    apartmentCapacityBonusPctPerCenter: 4,
    maxPopulationProductionBonusPct: 24,
    maxApartmentCapacityBonusPct: 32
  },
  combatSupport: {
    attackWeaponStrengthBonusPctPerCenter: 2,
    defenseItemStrengthBonusPctPerCenter: 1.5,
    maxAttackWeaponStrengthBonusPct: 16,
    maxDefenseItemStrengthBonusPct: 12,
    maxCombinedCameraAlarmBonusPct: 50
  },
  network: {
    incomeBonusPctPerExtraCenter: 3,
    heatBonusPctPerExtraCenter: 3,
    maxIncomeMultiplier: 1.21,
    maxHeatMultiplier: 1.21
  }
};
