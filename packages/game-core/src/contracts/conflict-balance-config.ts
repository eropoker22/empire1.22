export interface ConflictBalanceConfig {
  spyCooldownTicks: number;
  spyAuthorizationTtlTicks?: number;
  spySlotCooldownTicks?: number;
  defenseCapacity?: {
    baseCapacityPoints: number;
    zoneBonusPoints: Record<string, number>;
    itemWeights: Record<"vest" | "barricades" | "cameras" | "defense-tower" | "alarm", number>;
  };
  heist?: {
    globalCooldownTicks: number;
    sameTargetCooldownTicks: number;
    victimProtectionTicks: number;
    styles: Record<"stealth" | "balanced" | "all_in", {
      minMembers: number;
      maxMembers: number;
      baseSuccessChance: number;
      baseDetectionChance: number;
      lootMultiplier: number;
      detectedLossMultiplier: number;
      heatOnSuccess: number;
      heatOnDetected: number;
    }>;
    security: {
      camerasDetectionChancePerUnit: number;
      camerasMaxDetectionBonus: number;
      alarmDetectionChancePerUnit: number;
      alarmMaxDetectionBonus: number;
      defenseTowerResistancePerUnit: number;
      barricadesResistancePerUnit: number;
    };
  };
  robbery?: {
    cityDayRegenerationFraction: number;
    poolsByZone: Record<string, {
      cash: { min: number; max: number };
      dirtyCash: { min: number; max: number };
      chemicals: { min: number; max: number };
      biomass: { min: number; max: number };
      metalParts: { min: number; max: number };
    }>;
  };
  attackCooldownTicks: number;
  attackTargetProtectionTicks?: number;
  concurrency?: {
    offenseGlobalCooldownTicks: number;
    sourceConflictLockTicks: number;
    attackFailedCombatProtectionTicks: number;
    attackCaptureProtectionTicks: number;
    attackDestructionProtectionTicks: number;
  };
  captureStabilization?: {
    durationTicks: number;
    incomeMultiplier: number;
    productionSpeedMultiplier: number;
    cleanCaptureAttritionPct: number;
    successfulCaptureMinimumAttritionPct: number;
  };
  defenseCasualty?: {
    vestRelativeReductionPerUnit: number;
    vestRelativeReductionCap: number;
  };
  catastrophe?: {
    bazookaBonusPerUnit: number;
    bazookaBonusCap: number;
    finalChanceCap: number;
  };
  occupyOverextension?: {
    basePopulationCost: number;
    thirdDistrictInfluenceCost: number;
    fourthDistrictInfluenceCost: number;
    additionalDistrictInfluenceCost: number;
    additionalPopulationPerTwoDistricts: number;
  };
  trapRelocationCooldownTicks?: number;
  robCooldownTicks?: number;
  heistCooldownTicks?: number;
  occupyCooldownTicks?: number;
  occupyFailureChancePct?: number;
  minAttackDurationTicks?: number;
  attackHeatGain?: number;
  occupyHeatGain?: number;
  occupyInfluenceCost?: number;
  occupyPopulationRefundPct?: number;
  spyBaseSuccessChance: number;
  spyTrapRevealChance: number;
  trapAttackLosses: number;
  reportsLimit: number;
  catastropheChance?: number;
}
