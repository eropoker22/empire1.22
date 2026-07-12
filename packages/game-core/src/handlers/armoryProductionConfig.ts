import type { ArmoryBalanceConfig, ArmoryRecipeCategory, ArmoryRecipeId } from "../contracts";

const RECIPE_IDS: readonly ArmoryRecipeId[] = [
  "baseball-bat", "pistol", "grenade", "smg", "bazooka",
  "vest", "barricades", "cameras", "defense-tower", "alarm"
];
const ATTACK_RECIPES = new Set(["baseball-bat", "pistol", "grenade", "smg", "bazooka"]);
const MATERIALS = new Set(["metal-parts", "tech-core"]);

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
