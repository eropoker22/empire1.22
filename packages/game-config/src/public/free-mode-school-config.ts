import type { SchoolBalanceConfig } from "../contracts/balance-config";

export const freeModeSchoolConfig: SchoolBalanceConfig = {
  id: "school",
  buildingTypeId: "school",
  countOnMap: 6,
  category: ["population", "education", "talent_support", "city_life"],
  cleanCashPerMinute: 18,
  dirtyCashPerMinute: 0,
  influencePerMinute: 0.05,
  heatPerMinute: 0,
  populationPerMinute: 0.55,
  baseStudentCapacity: 20,
  noDirtyCash: true,
  noLaundering: true,
  noAuditRisk: true,
  noHeat: true,
  productionStopsAtCapacity: true,
  requiresManualCollect: true,
  allowPartialCollect: true,
  network: {
    populationProductionBonusPctPerExtraSchool: 8,
    studentCapacityBonusPctPerExtraSchool: 10,
    incomeBonusPctPerExtraSchool: 4,
    maxPopulationProductionMultiplier: 1.4,
    maxStudentCapacityMultiplier: 1.5,
    maxIncomeMultiplier: 1.2
  },
  talentPool: {
    baseChancePct: 12,
    chancePctPerExtraSchool: 5,
    maxChancePct: 38,
    eveningCourseTalentChanceBonusPct: 12,
    betterTalentChanceBonusPct: 20
  },
  eveningCourse: {
    actionId: "evening_course",
    cooldownMinutes: 35,
    durationMinutes: 20,
    costCleanCash: 600,
    heatGain: 0,
    populationProductionMultiplier: 1.6,
    talentChanceFlatBonusPct: 0,
    betterTalentChanceBonusPct: 0,
    cleanIncomeMultiplier: 1,
    stackable: false
  }
};
