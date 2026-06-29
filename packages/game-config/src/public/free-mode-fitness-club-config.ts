import type { FitnessClubBalanceConfig } from "../contracts/balance-config";

export const freeModeFitnessClubConfig: FitnessClubBalanceConfig = {
  id: "fitness_club",
  buildingTypeId: "fitness_club",
  countOnMap: 5,
  category: ["economy", "combat_support", "physical_training"],
  cleanCashPerMinute: 72,
  dirtyCashPerMinute: 0,
  influencePerMinute: 0,
  populationPerMinute: 0,
  heatPerMinute: 0.04,
  actions: [],
  noSpecialActions: true,
  noLaundering: true,
  noAuditRisk: true,
  noPopulationProduction: true,
  noIntelPower: true,
  combatConditioning: {
    attackStrengthBonusPctPerClub: 3,
    defenseStrengthBonusPctPerClub: 2,
    maxAttackStrengthBonusPct: 15,
    maxDefenseStrengthBonusPct: 10,
    combinedRecruitmentFitnessAttackCapPct: 24,
    combinedRecruitmentFitnessDefenseCapPct: 18,
    attackApplication: {
      baseGangMemberAttack: 0.75,
      "baseball-bat": 0.75,
      pistol: 0.35,
      grenade: 0.15,
      smg: 0.25,
      bazooka: 0.1
    },
    defenseApplication: {
      baseGangMemberDefense: 0.75,
      vest: 0.4,
      barricades: 0.2,
      cameras: 0,
      "defense-tower": 0,
      alarm: 0
    }
  },
  network: {
    incomeBonusPctPerExtraClub: 5,
    heatBonusPctPerExtraClub: 3,
    maxIncomeMultiplier: 1.2,
    maxHeatMultiplier: 1.12
  }
};
