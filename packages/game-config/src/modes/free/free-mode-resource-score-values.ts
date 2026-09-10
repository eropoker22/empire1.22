import { freeModePharmacyConfig } from "./free-mode-pharmacy-config";
import { freeModeDrugLabConfig } from "./free-mode-drug-lab-config";
import { freeModeFactoryConfig } from "./free-mode-factory-config";
import { freeModeArmoryConfig } from "./free-mode-armory-config";

// Value stock at the full clean-cash cost of its production chain, independent
// of player asking prices. Derive it from recipes so balance changes cannot drift.
const recipes = {
  ...freeModePharmacyConfig.recipes,
  ...freeModeDrugLabConfig.recipes,
  ...freeModeFactoryConfig.recipes,
  ...freeModeArmoryConfig.recipes
};
const values: Record<string, number> = {};
const visiting = new Set<string>();
const valueOf = (id: string): number => {
  if (values[id] !== undefined) return values[id];
  if (visiting.has(id)) throw new Error(`Circular production recipe: ${id}`);
  const recipe = recipes[id as keyof typeof recipes];
  if (!recipe) throw new Error(`Missing production recipe: ${id}`);
  visiting.add(id);
  const value = (recipe.cleanCashCostPerUnit + Object.entries(recipe.inputCosts ?? {})
    .reduce((sum, [input, amount]) => sum + Number(amount) * valueOf(input), 0)) / recipe.outputAmount;
  visiting.delete(id);
  values[id] = value;
  return value;
};
Object.keys(recipes).forEach(valueOf);
export const freeModeResourceScoreValues: Record<string, number> = Object.freeze(values);
