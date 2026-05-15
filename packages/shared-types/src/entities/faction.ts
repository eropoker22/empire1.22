import type { AttackWeaponId, DefenseWeaponId } from "./weapon";

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
  techProductionMultiplier?: number;
  heatGainMultiplier?: number;
  influenceGainMultiplier?: number;
  spySuccessChanceBonus?: number;
  attackPowerMultiplier?: number;
  defensePowerMultiplier?: number;
  attackDurationMultiplier?: number;
  equipmentLossMultiplier?: number;
  marketFeeMultiplier?: number;
  rumorTruthMultiplier?: number;
  upkeepCostMultiplier?: number;
}

export interface FactionUiTheme {
  accent: string;
  glow: string;
  surface: string;
  glyph: string;
}

export interface FactionDefinition {
  id: PlayerFactionId;
  name: string;
  tagline: string;
  description: string;
  playstyleSummary: string;
  strengths: string[];
  weaknesses: string[];
  startingPackage: FactionStartingPackage;
  passiveModifiers: FactionPassiveModifiers;
  passiveEffectSummary: string[];
  uiTheme: FactionUiTheme;
  recommendedFor: string;
  difficulty: FactionDifficulty;
}
