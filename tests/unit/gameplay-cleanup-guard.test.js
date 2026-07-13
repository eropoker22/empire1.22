import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolveModeConfig } from "@empire/game-config";
import { getAllPublicBuildingDefinitions } from "../../packages/game-config/src/public/building-definitions";
import { BROWSER_GAMEPLAY_CONFIG } from "../../packages/game-config/src/legacy-page/gameplay-config.generated.js";

const read = (path) => readFileSync(path, "utf8");
const productionTypes = ["pharmacy", "drug_lab", "factory", "armory"];

describe("current gameplay cleanup guard", () => {
  it("keeps production buildings on their canonical line configs without legacy actions", () => {
    const config = resolveModeConfig("free");
    const definitions = new Map(getAllPublicBuildingDefinitions().map((definition) => [definition.buildingTypeId, definition]));

    for (const buildingTypeId of productionTypes) {
      expect(definitions.get(buildingTypeId)?.specialActions, buildingTypeId).toEqual([]);
    }
    expect(config.balance.productionBuildings).toEqual({});
    expect(config.balance.craftBuildings).toEqual({});
    expect(config.balance.buildingActions?.produce_tech_core).toBeUndefined();
    expect(config.balance.buildingActions?.armory_fortify).toBeUndefined();
    expect(existsSync("packages/game-config/src/modes/free/free-mode-production-building-actions.ts")).toBe(false);
  });

  it("derives every browser production recipe from the typed one-piece configs", () => {
    const config = resolveModeConfig("free");
    const pairs = [
      [config.balance.pharmacy?.recipes, BROWSER_GAMEPLAY_CONFIG.pharmacyRecipes],
      [config.balance.drugLab?.recipes, BROWSER_GAMEPLAY_CONFIG.drugLabRecipes],
      [config.balance.factory?.recipes, BROWSER_GAMEPLAY_CONFIG.factoryRecipes],
      [config.balance.armory?.recipes, BROWSER_GAMEPLAY_CONFIG.armoryRecipes]
    ];

    for (const [typedRecipes, browserRecipes] of pairs) {
      expect(typedRecipes).toBeDefined();
      expect(Object.keys(browserRecipes)).toEqual(Object.keys(typedRecipes));
      for (const [recipeId, recipe] of Object.entries(typedRecipes)) {
        expect(recipe.outputAmount, recipeId).toBe(1);
        expect(browserRecipes[recipeId], recipeId).toMatchObject({
          inputs: recipe.inputCosts,
          cleanMoneyCost: recipe.cleanCashCostPerUnit,
          output: { itemId: recipe.outputResourceKey, amount: 1 },
          localOutputCap: recipe.localOutputCap,
          queueCap: recipe.queueCap
        });
      }
    }

    expect(Object.fromEntries(Object.entries(config.balance.armory.recipes).map(([id, recipe]) => [id, recipe.queueCap]))).toEqual({
      "baseball-bat": 6,
      pistol: 4,
      grenade: 4,
      smg: 3,
      bazooka: 2,
      vest: 4,
      barricades: 5,
      cameras: 4,
      "defense-tower": 2,
      alarm: 4
    });
  });

  it("keeps strategic Lab items as components and removes their dead direct-use adapter", () => {
    const recipes = resolveModeConfig("free").balance.drugLab?.recipes;
    expect(recipes?.["ghost-serum"]).toMatchObject({ itemRole: "boost-component", directlyUsable: false });
    expect(recipes?.["overdrive-x"]).toMatchObject({ itemRole: "boost-component", directlyUsable: false });

    const runtime = read("page-assets/js/app/runtime.js");
    expect(runtime).not.toContain("function usePharmacyBoost");
    expect(runtime).not.toContain("usePharmacyBoost,");
  });

  it("keeps demo-only surfaces labeled and separated from server authority", () => {
    const page = read("pages/game.html");
    const chatRuntime = read("page-assets/js/app/alliance-runtime.js");
    const browserAdapter = read("packages/game-config/src/legacy-page/economy-config.js");

    expect(page).toContain('name="empire-gameplay-execution-mode" content="local-demo"');
    expect(page).toContain("Demo chat je lokální kanál tohoto prohlížeče.");
    expect(page).toContain("Lokální demo efekt bojových modulů z Továrny.");
    expect(chatRuntime).toContain('empire:demo:global-chat:v1');
    expect(browserAdapter).toContain('from "./gameplay-config.generated.js"');
    expect(browserAdapter).not.toContain('"baseball-bat": {');
  });
});
