import type { DrugLabBalanceConfig } from "../contracts";

const REQUIRED_RECIPES = ["neon-dust", "pulse-shot", "velvet-smoke", "ghost-serum", "overdrive-x"] as const;
const KNOWN_RESOURCES = new Set([
  "chemicals", "biomass", "stim-pack", "neon-dust", "pulse-shot", "velvet-smoke", "ghost-serum", "overdrive-x"
]);

export const validateDrugLabProductionConfig = (config: DrugLabBalanceConfig): void => {
  if (config.independentProductionLines !== true) {
    throw new Error("Drug Lab requires independent production lines.");
  }
  for (const recipeId of REQUIRED_RECIPES) {
    const recipe = config.recipes[recipeId];
    if (!recipe || recipe.outputResourceKey !== recipeId) {
      throw new Error("Drug Lab recipe \"" + recipeId + "\" must produce its matching resource.");
    }
    if (recipe.outputAmount !== 1 || recipe.directlyUsable !== false) {
      throw new Error("Drug Lab recipes produce exactly one non-directly-usable item.");
    }
    if (!Number.isInteger(recipe.cleanCashCostPerUnit) || recipe.cleanCashCostPerUnit <= 0) {
      throw new Error("Drug Lab recipe \"" + recipeId + "\" requires a positive clean cash price.");
    }
    const inputs = Object.entries(recipe.inputCosts);
    if (inputs.length > 2 || inputs.some(([key, amount]) => !KNOWN_RESOURCES.has(key) || !Number.isInteger(amount) || amount <= 0 || key === recipeId)) {
      throw new Error("Drug Lab recipe \"" + recipeId + "\" has invalid material inputs.");
    }
    for (const value of [recipe.durationTicksPerUnit, recipe.localOutputCap, recipe.queueCap]) {
      if (!Number.isInteger(value) || value <= 0) {
        throw new Error("Drug Lab recipe \"" + recipeId + "\" requires positive integer timing and capacities.");
      }
    }
  }
  const ghost = config.recipes["ghost-serum"];
  const overdrive = config.recipes["overdrive-x"];
  if (ghost.itemRole !== "boost-component" || ghost.inputCosts["stim-pack"] || ghost.inputCosts.chemicals || ghost.inputCosts.biomass) {
    throw new Error("Ghost Serum must remain a strategic component using Neon Dust and Pulse Shot.");
  }
  if (overdrive.itemRole !== "boost-component" || overdrive.inputCosts["stim-pack"] || overdrive.inputCosts["ghost-serum"] || overdrive.inputCosts.chemicals || overdrive.inputCosts.biomass) {
    throw new Error("Overdrive X must remain a strategic component using Pulse Shot and Velvet Smoke.");
  }
};
