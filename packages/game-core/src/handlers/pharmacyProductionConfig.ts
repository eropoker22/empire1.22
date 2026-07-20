import type { PharmacyBalanceConfig } from "../contracts";
import { MINIMUM_PRODUCTION_QUEUE_RESERVE } from "./productionLineShared";

const REQUIRED_RECIPES = ["chemicals", "biomass", "stim-pack"] as const;

export const validatePharmacyProductionConfig = (config: PharmacyBalanceConfig): void => {
  if (config.independentProductionLines !== true) {
    throw new Error("Pharmacy requires independent production lines.");
  }
  for (const recipeId of REQUIRED_RECIPES) {
    const recipe = config.recipes[recipeId];
    if (!recipe || recipe.outputResourceKey !== recipeId) {
      throw new Error("Pharmacy recipe \"" + recipeId + "\" must produce its matching resource.");
    }
    if (recipe.outputAmount !== 1) {
      throw new Error("Pharmacy recipe \"" + recipeId + "\" must produce exactly one item.");
    }
    if (!Number.isInteger(recipe.cleanCashCostPerUnit) || recipe.cleanCashCostPerUnit <= 0) {
      throw new Error("Pharmacy recipe \"" + recipeId + "\" requires a positive clean cash price.");
    }
    if (Object.keys(recipe.inputCosts).length > 0) {
      throw new Error("Pharmacy recipe \"" + recipeId + "\" must not consume material inputs.");
    }
    for (const value of [recipe.durationTicksPerUnit, recipe.localOutputCap, recipe.queueCap]) {
      if (!Number.isInteger(value) || value <= 0) {
        throw new Error("Pharmacy recipe \"" + recipeId + "\" requires positive integer timing and capacities.");
      }
    }
    if (recipe.queueCap < recipe.localOutputCap + MINIMUM_PRODUCTION_QUEUE_RESERVE) {
      throw new Error("Pharmacy recipe \"" + recipeId + "\" requires room for three queued items above local output capacity.");
    }
  }
};
