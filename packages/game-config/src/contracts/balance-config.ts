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
  requiredOwner: boolean;
  allowedIfContested: boolean;
  reportText: string;
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
  buildingActions?: Record<string, BuildingActionBalanceConfig>;
}
