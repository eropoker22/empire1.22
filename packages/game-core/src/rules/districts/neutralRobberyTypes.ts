import type { NeutralDistrictLootPool } from "@empire/shared-types";

export type NeutralRobberyOutcome = "success" | "partial" | "failed" | "exhausted";

export interface NeutralRobberyResolution {
  outcome: NeutralRobberyOutcome;
  loot: Record<string, number>;
  nextPool: NeutralDistrictLootPool;
  playerHeat: number;
  districtHeat: number;
}

export interface NeutralRobberyTimingConfig {
  dayLengthTicks?: number;
  nightLengthTicks?: number;
}

export const DEFAULT_ZONE = "residential";
export const NEUTRAL_ROBBERY_MIN_CASH_LOOT = 1_000;
export const NEUTRAL_ROBBERY_MATERIAL_KEYS = [
  "chemicals",
  "biomass",
  "metal-parts",
  "stim-pack",
  "tech-core",
  "combat-module"
] as const;
export const NEUTRAL_ROBBERY_LOOT_KEYS = [
  "cash",
  "dirty-cash",
  ...NEUTRAL_ROBBERY_MATERIAL_KEYS
] as const;

export const MATERIAL_RARITY_MAX: Record<typeof NEUTRAL_ROBBERY_MATERIAL_KEYS[number], number> = {
  chemicals: 5,
  biomass: 5,
  "metal-parts": 5,
  "stim-pack": 4,
  "tech-core": 3,
  "combat-module": 2
};

