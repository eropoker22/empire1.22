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
    attackStrengthBonusPctPerClub: 4,
    defenseStrengthBonusPctPerClub: 3,
    maxAttackStrengthBonusPct: 20,
    maxDefenseStrengthBonusPct: 15,
    combinedRecruitmentFitnessAttackCapPct: 30,
    combinedRecruitmentFitnessDefenseCapPct: 24,
    attackApplication: {
      baseGangMemberAttack: 1,
      "baseball-bat": 1,
      pistol: 0.5,
      grenade: 0.25,
      smg: 0.4,
      bazooka: 0.15
    },
    defenseApplication: {
      baseGangMemberDefense: 1,
      vest: 0.6,
      barricades: 0.35,
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
