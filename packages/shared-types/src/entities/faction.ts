import type { AttackWeaponId, DefenseWeaponId } from "./weapon";

export const MAX_PLAYERS_PER_FACTION = 4;

export const PLAYER_FACTION_IDS = [
  "mafian",
  "kartel",
  "kult",
  "tajna-organizace",
  "hackeri",
  "motorkarsky-gang",
  "soukroma-armada",
  "korporace"
] as const;

export type PlayerFactionId = (typeof PLAYER_FACTION_IDS)[number];

export type FactionDifficulty = "snadná" | "střední" | "těžká";

export interface FactionStartingPackage {
  cash?: number;
  dirtyCash?: number;
  resources?: Record<string, number>;
  attackLoadout?: Partial<Record<AttackWeaponId, number>>;
  defenseLoadout?: Partial<Record<DefenseWeaponId, number>>;
  initialHeat?: number;
  initialInfluence?: number;
}

export interface FactionPassiveModifiers {
  cleanIncomeMultiplier?: number;
  dirtyIncomeMultiplier?: number;
  productionMultiplier?: number;
  illegalProductionMultiplier?: number;
  smugglingIncomeMultiplier?: number;
  techProductionMultiplier?: number;
  heatGainMultiplier?: number;
  illegalActionHeatGainMultiplier?: number;
  influenceGainMultiplier?: number;
  spySuccessChanceBonus?: number;
  spyInfoQualityMultiplier?: number;
  trapDetectionChanceBonus?: number;
  secretActionHeatGainMultiplier?: number;
  attackPowerMultiplier?: number;
  defensePowerMultiplier?: number;
  baseDefensePowerMultiplier?: number;
  cameraEffectivenessMultiplier?: number;
  alarmEffectivenessMultiplier?: number;
  occupyPowerMultiplier?: number;
  attackDurationMultiplier?: number;
  robberyCooldownMultiplier?: number;
  attackCooldownMultiplier?: number;
  occupyCooldownMultiplier?: number;
  robberyDirtyCashLootMultiplier?: number;
  robberyLootMultiplier?: number;
  aggressiveActionHeatGainMultiplier?: number;
  defenseSystemEffectivenessMultiplier?: number;
  populationGenerationMultiplier?: number;
  rumorGenerationMultiplier?: number;
  equipmentLossMultiplier?: number;
  marketFeeMultiplier?: number;
  rumorTruthMultiplier?: number;
  upkeepCostMultiplier?: number;
}

export const FACTION_PASSIVE_MODIFIER_KEYS = [
  "cleanIncomeMultiplier",
  "dirtyIncomeMultiplier",
  "productionMultiplier",
  "illegalProductionMultiplier",
  "smugglingIncomeMultiplier",
  "techProductionMultiplier",
  "heatGainMultiplier",
  "illegalActionHeatGainMultiplier",
  "influenceGainMultiplier",
  "spySuccessChanceBonus",
  "spyInfoQualityMultiplier",
  "trapDetectionChanceBonus",
  "secretActionHeatGainMultiplier",
  "attackPowerMultiplier",
  "defensePowerMultiplier",
  "baseDefensePowerMultiplier",
  "cameraEffectivenessMultiplier",
  "alarmEffectivenessMultiplier",
  "occupyPowerMultiplier",
  "attackDurationMultiplier",
  "robberyCooldownMultiplier",
  "attackCooldownMultiplier",
  "occupyCooldownMultiplier",
  "robberyDirtyCashLootMultiplier",
  "robberyLootMultiplier",
  "aggressiveActionHeatGainMultiplier",
  "defenseSystemEffectivenessMultiplier",
  "populationGenerationMultiplier",
  "rumorGenerationMultiplier",
  "equipmentLossMultiplier",
  "marketFeeMultiplier",
  "rumorTruthMultiplier",
  "upkeepCostMultiplier"
] as const satisfies readonly (keyof FactionPassiveModifiers)[];

export interface FactionUiTheme {
  accent: string;
  glow: string;
  surface: string;
  glyph: string;
}

export type FactionSpecialActionStatus = "preview" | "planned" | "implemented";

export interface FactionSpecialActionMetadata {
  name: string;
  description: string;
  status: FactionSpecialActionStatus;
  intendedFutureEffect?: string[];
}

export interface FactionDefinition {
  id: PlayerFactionId;
  name: string;
  tagline: string;
  description: string;
  playstyleSummary: string;
  strengths: string[];
  weaknesses: string[];
  startingPackage?: FactionStartingPackage;
  passiveModifiers: FactionPassiveModifiers;
  passiveEffectSummary: string[];
  plannedPassiveEffectSummary?: string[];
  specialAction?: FactionSpecialActionMetadata;
  uiTheme: FactionUiTheme;
  recommendedFor: string;
  difficulty: FactionDifficulty;
}
