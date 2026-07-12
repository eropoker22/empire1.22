import type { FactoryBalanceConfig } from "../contracts";

const REQUIRED_RECIPES = ["metal-parts", "tech-core", "combat-module"] as const;
const KNOWN_RESOURCES = new Set(["metal-parts", "tech-core", "combat-module"]);

export const validateFactoryProductionConfig = (config: FactoryBalanceConfig): void => {
  if (config.independentProductionLines !== true) throw new Error("Factory requires independent production lines.");
  for (const recipeId of REQUIRED_RECIPES) {
    const recipe = config.recipes[recipeId];
    if (!recipe || recipe.outputResourceKey !== recipeId || recipe.outputAmount !== 1) {
      throw new Error("Factory recipe \"" + recipeId + "\" must produce exactly one matching resource.");
    }
    if (!Number.isInteger(recipe.cleanCashCostPerUnit) || recipe.cleanCashCostPerUnit <= 0) {
      throw new Error("Factory recipe \"" + recipeId + "\" requires a positive clean cash price.");
    }
    const inputs = Object.entries(recipe.inputCosts);
    if (inputs.length > 2 || inputs.some(([key, amount]) => !KNOWN_RESOURCES.has(key) || !Number.isInteger(amount) || amount <= 0 || key === recipeId)) {
      throw new Error("Factory recipe \"" + recipeId + "\" has invalid material inputs.");
    }
    for (const value of [recipe.durationTicksPerUnit, recipe.localOutputCap, recipe.queueCap]) {
      if (!Number.isInteger(value) || value <= 0) throw new Error("Factory recipe \"" + recipeId + "\" requires positive integer timing and capacities.");
    }
  }
  const metal = config.recipes["metal-parts"];
  const tech = config.recipes["tech-core"];
  const combat = config.recipes["combat-module"];
  if (Object.keys(metal.inputCosts).length || tech.inputCosts["metal-parts"] !== 4 || Object.keys(tech.inputCosts).length !== 1) {
    throw new Error("Factory Tech Core requires exactly four Metal Parts and Metal Parts require no materials.");
  }
  if (combat.inputCosts["metal-parts"] !== 4 || combat.inputCosts["tech-core"] !== 2 || Object.keys(combat.inputCosts).length !== 2) {
    throw new Error("Factory Combat Module requires exactly four Metal Parts and two Tech Cores.");
  }
  for (const count of [1, 2, 3, 4] as const) {
    const value = config.network.speedMultipliers[count];
    if (!Number.isFinite(value) || value <= 0 || value > config.network.maxSpeedMultiplier) {
      throw new Error("Factory network multiplier is invalid.");
    }
  }
  if (config.network.maxSpeedMultiplier !== 1.3 || config.network.speedMultipliers[1] !== 1 || config.network.speedMultipliers[2] !== 1.1 || config.network.speedMultipliers[3] !== 1.2 || config.network.speedMultipliers[4] !== 1.3) {
    throw new Error("Factory network speed multipliers must resolve to 1.00, 1.10, 1.20 and 1.30.");
  }
};
