import type { GameModeId } from "@empire/shared-types/ids/game-mode-id";

export interface ProductionBuildingBalanceConfig {
  resourceKey: string;
  resourceLabel: string;
  amountPerTick: number;
  storageCap: number;
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
 * Responsibility: Core-facing mode configuration contract used by runtime bootstrap.
 * Belongs here: serializable mode knobs grouped for balance and runtime decisions.
 * Does not belong here: server lifecycle logic or UI routing concerns.
 */
export interface GameModeConfig {
  mode: GameModeId;
  tickRateMs: number;
  balance: {
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
    productionBuildings?: Record<string, ProductionBuildingBalanceConfig>;
    craftBuildings?: Record<string, CraftBuildingBalanceConfig>;
    buildingActions?: Record<string, BuildingActionBalanceConfig>;
  };
  technical: {
    sessionTtlMs: number;
    gameDurationMs: number;
    storageKeyPrefix: string;
    snapshotIntervalTicks: number;
    notificationBatchWindowMs: number;
    debug: {
      allowDebugTools: boolean;
      enableDeterministicSeeds: boolean;
    };
  };
  publicMeta: {
    mode: GameModeId;
    label: string;
    matchStyle: "short" | "long";
    tickRateMs: number;
    sessionKeyPrefix: string;
  };
}

export type ResolvedGameModeConfig = GameModeConfig;
