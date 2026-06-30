export interface ProductionBuildingBalanceConfig {
  resourceKey: string;
  resourceLabel: string;
  amountPerTick: number;
  storageCap: number;
  upgrade?: BuildingUpgradeBalanceConfig;
}

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
  upgrade?: BuildingUpgradeBalanceConfig;
}

export interface BuildingUpgradeBalanceConfig {
  maxLevel: number;
  upgradeBaseCost: number;
  costGrowth: number;
  productionMultiplierPerLevel?: number;
  roundCostTo?: number;
}

export interface ConflictBalanceConfig {
  spyCooldownTicks: number;
  attackCooldownTicks: number;
  occupyCooldownTicks?: number;
  minAttackDurationTicks?: number;
  attackHeatGain?: number;
  occupyHeatGain?: number;
  occupyInfluenceCost?: number;
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
  effectModifiers?: BuildingActionEffectModifiers;
  requiredOwner: boolean;
  allowedIfContested: boolean;
  reportText: string;
}

export interface BuildingActionEffectModifiers {
  incomeMultiplier?: number;
  cleanIncomeMultiplier?: number;
  dirtyIncomeMultiplier?: number;
  influenceMultiplier?: number;
  heatMultiplier?: number;
  influencePerDay?: number;
  heatPerDay?: number;
  attackMultiplier?: number;
  defenseMultiplier?: number;
}

export interface FixedBuildingBalanceConfig {
  cleanPerHour: number;
  dirtyPerHour: number;
  heatPerDay: number;
  influencePerDay: number;
  maxLevel: number;
}

export interface CasinoAuditRiskTierConfig {
  maxLaunderedAmount: number | null;
  riskPct: number;
}

export interface CasinoUpgradeConfig {
  level: number;
  cleanCashCost: number;
  techCoreCost?: number;
  combatModuleCost?: number;
  incomeBonusPct: number;
  launderingLimitBonusPct: number;
  feeReductionPct?: number;
  actionHeatReductionPct?: number;
}
