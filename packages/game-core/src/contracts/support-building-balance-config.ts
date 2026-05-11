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
