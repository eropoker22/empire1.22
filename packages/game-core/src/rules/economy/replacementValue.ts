import type { ResolvedGameModeConfig } from "../../contracts";

interface ReplacementValueRecipe {
  outputResourceKey: string;
  cleanCashCostPerUnit: number;
  inputCosts: Readonly<Record<string, number>>;
}

const collectRecipes = (config: ResolvedGameModeConfig): Map<string, ReplacementValueRecipe> => {
  const recipes = new Map<string, ReplacementValueRecipe>();
  const sources = [
    config.balance.pharmacy,
    config.balance.drugLab,
    config.balance.factory,
    config.balance.armory
  ];
  for (const source of sources) {
    if (!source || !("recipes" in source)) continue;
    for (const value of Object.values(source.recipes)) {
      const recipe = value as ReplacementValueRecipe;
      recipes.set(recipe.outputResourceKey, recipe);
    }
  }
  return recipes;
};
export interface ReplacementValueResolver {
  resolve(resourceKey: string): number | null;
}

/**
 * Resolves the clean-cash replacement cost of a stockable item from canonical
 * production recipes. The recursion is cycle-checked so config errors fail
 * closed instead of silently producing an exploitable market price.
 */
export const createReplacementValueResolver = (
  config: ResolvedGameModeConfig
): ReplacementValueResolver => {
  const recipes = collectRecipes(config);
  const cache = new Map<string, number>();

  const resolve = (resourceKey: string, stack: ReadonlySet<string>): number | null => {
    if (cache.has(resourceKey)) return cache.get(resourceKey)!;
    const recipe = recipes.get(resourceKey);
    if (!recipe) return null;
    if (stack.has(resourceKey)) {
      throw new Error(`Production replacement value contains a cycle at '${resourceKey}'.`);
    }
    const nextStack = new Set(stack);
    nextStack.add(resourceKey);
    let total = Math.max(0, Math.floor(Number(recipe.cleanCashCostPerUnit || 0)));
    for (const [inputKey, rawAmount] of Object.entries(recipe.inputCosts)) {
      const amount = Math.max(0, Math.floor(Number(rawAmount || 0)));
      const inputValue = resolve(inputKey, nextStack);
      if (inputValue === null) {
        throw new Error(`No canonical replacement value exists for production input '${inputKey}'.`);
      }
      total += amount * inputValue;
    }
    cache.set(resourceKey, total);
    return total;
  };

  return { resolve: (resourceKey) => resolve(resourceKey, new Set()) };
};
