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

export type PharmacyRecipeId = "chemicals" | "biomass" | "stim-pack";

export interface PharmacyRecipeBalanceConfig {
  label: string;
  outputResourceKey: PharmacyRecipeId;
  outputAmount: 1;
  cleanCashCostPerUnit: number;
  inputCosts: Record<string, never>;
  durationTicksPerUnit: number;
  localOutputCap: number;
  queueCap: number;
}

export interface PharmacyBalanceConfig {
  independentProductionLines: true;
  recipes: Record<PharmacyRecipeId, PharmacyRecipeBalanceConfig>;
  upgrade?: BuildingUpgradeBalanceConfig;
}

export type DrugLabRecipeId =
  | "neon-dust"
  | "pulse-shot"
  | "velvet-smoke"
  | "ghost-serum"
  | "overdrive-x";

export type DrugLabItemRole = "trade-material" | "boost-component";

export interface DrugLabRecipeBalanceConfig {
  label: string;
  description: string;
  outputResourceKey: DrugLabRecipeId;
  outputAmount: 1;
  itemRole: DrugLabItemRole;
  directlyUsable: false;
  cleanCashCostPerUnit: number;
  inputCosts: Record<string, number>;
  durationTicksPerUnit: number;
  localOutputCap: number;
  queueCap: number;
}

export interface DrugLabBalanceConfig {
  independentProductionLines: true;
  recipes: Record<DrugLabRecipeId, DrugLabRecipeBalanceConfig>;
  upgrade?: BuildingUpgradeBalanceConfig;
}

export type FactoryRecipeId = "metal-parts" | "tech-core" | "combat-module";

export interface FactoryRecipeBalanceConfig {
  label: string;
  outputResourceKey: FactoryRecipeId;
  outputAmount: 1;
  cleanCashCostPerUnit: number;
  inputCosts: Record<string, number>;
  durationTicksPerUnit: number;
  localOutputCap: number;
  queueCap: number;
}

export interface FactoryBalanceConfig {
  independentProductionLines: true;
  network: {
    speedMultipliers: Record<1 | 2 | 3 | 4, number>;
    maxSpeedMultiplier: number;
  };
  recipes: Record<FactoryRecipeId, FactoryRecipeBalanceConfig>;
  upgrade?: BuildingUpgradeBalanceConfig;
}

export type ArmoryRecipeId =
  | "baseball-bat"
  | "pistol"
  | "grenade"
  | "smg"
  | "bazooka"
  | "vest"
  | "barricades"
  | "cameras"
  | "defense-tower"
  | "alarm";

export type ArmoryRecipeCategory = "attack" | "defense";

export interface ArmoryRecipeBalanceConfig {
  category: ArmoryRecipeCategory;
  label: string;
  outputResourceKey: ArmoryRecipeId;
  outputAmount: 1;
  cleanCashCostPerUnit: 0;
  inputCosts: Record<string, number>;
  durationTicksPerUnit: number;
  localOutputCap: number;
  queueCap: number;
}

export interface ArmoryBalanceConfig {
  independentProductionLines: true;
  network: {
    speedMultipliers: Record<1 | 2 | 3 | 4, number>;
    maxSpeedMultiplier: number;
  };
  recipes: Record<ArmoryRecipeId, ArmoryRecipeBalanceConfig>;
  upgrade: BuildingUpgradeBalanceConfig;
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
