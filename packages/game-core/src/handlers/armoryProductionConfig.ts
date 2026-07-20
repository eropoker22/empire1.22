import type { ArmoryBalanceConfig, ArmoryRecipeCategory, ArmoryRecipeId } from "../contracts";
import { MINIMUM_PRODUCTION_QUEUE_RESERVE } from "./productionLineShared";

const RECIPE_IDS: readonly ArmoryRecipeId[] = [
  "baseball-bat", "pistol", "grenade", "smg", "bazooka",
  "vest", "barricades", "cameras", "defense-tower", "alarm"
];
const ATTACK_RECIPES = new Set(["baseball-bat", "pistol", "grenade", "smg", "bazooka"]);
const MATERIALS = new Set(["metal-parts", "tech-core", "combat-module"]);
const HIGH_TIER_INPUTS = {
  smg: { "metal-parts": 2, "combat-module": 1 },
  bazooka: { "metal-parts": 3, "combat-module": 2 },
  "defense-tower": { "tech-core": 3, "combat-module": 2 }
} as const;

const hasExactInputCosts = (actual: Record<string, number>, expected: Record<string, number>): boolean => {
  const actualEntries = Object.entries(actual);
  const expectedEntries = Object.entries(expected);
  return actualEntries.length === expectedEntries.length
    && expectedEntries.every(([resourceKey, amount]) => actual[resourceKey] === amount);
};

export const validateArmoryProductionConfig = (config: ArmoryBalanceConfig): void => {
  if (config.independentProductionLines !== true || Object.keys(config.recipes).length !== RECIPE_IDS.length) {
    throw new Error("Armory requires exactly ten independent production lines.");
  }
  for (const recipeId of RECIPE_IDS) {
    const recipe = config.recipes[recipeId];
    const expectedCategory: ArmoryRecipeCategory = ATTACK_RECIPES.has(recipeId) ? "attack" : "defense";
    if (!recipe || recipe.category !== expectedCategory || recipe.outputResourceKey !== recipeId || recipe.outputAmount !== 1) {
      throw new Error("Armory recipe \"" + recipeId + "\" must produce exactly one matching item in its category.");
    }
    if (recipe.cleanCashCostPerUnit !== 0) {
      throw new Error("Armory recipes do not charge clean cash.");
    }
    const inputs = Object.entries(recipe.inputCosts);
    if (inputs.length < 1 || inputs.length > 2 || inputs.some(([key, amount]) =>
      !MATERIALS.has(key) || !Number.isInteger(amount) || amount <= 0 || key === recipe.outputResourceKey
    )) {
      throw new Error("Armory recipe \"" + recipeId + "\" has invalid material inputs.");
    }
    for (const value of [recipe.durationTicksPerUnit, recipe.localOutputCap, recipe.queueCap]) {
      if (!Number.isInteger(value) || value <= 0) {
        throw new Error("Armory recipe \"" + recipeId + "\" requires positive integer timing and capacities.");
      }
    }
    if (recipe.queueCap < recipe.localOutputCap + MINIMUM_PRODUCTION_QUEUE_RESERVE) {
      throw new Error("Armory recipe \"" + recipeId + "\" requires room for three queued items above local output capacity.");
    }
    if (recipeId in HIGH_TIER_INPUTS
      && !hasExactInputCosts(recipe.inputCosts, HIGH_TIER_INPUTS[recipeId as keyof typeof HIGH_TIER_INPUTS])) {
      throw new Error("Armory high-tier recipe \"" + recipeId + "\" has invalid Combat Module inputs.");
    }
    if (!(recipeId in HIGH_TIER_INPUTS) && "combat-module" in recipe.inputCosts) {
      throw new Error("Combat Module is reserved for Armory high-tier recipes only.");
    }
  }
  for (const count of [1, 2, 3, 4] as const) {
    const multiplier = config.network.speedMultipliers[count];
    if (!Number.isFinite(multiplier) || multiplier <= 0 || multiplier > config.network.maxSpeedMultiplier) {
      throw new Error("Armory network multiplier is invalid.");
    }
  }
  if (config.network.maxSpeedMultiplier !== 1.3
    || config.network.speedMultipliers[1] !== 1
    || config.network.speedMultipliers[2] !== 1.1
    || config.network.speedMultipliers[3] !== 1.2
    || config.network.speedMultipliers[4] !== 1.3) {
    throw new Error("Armory network speed multipliers must resolve to 1.00, 1.10, 1.20 and 1.30.");
  }
};
