import { describe, expect, it } from "vitest";
import {
  createFactoryBuildingInfoViewModel,
  createProductionBuildingInfoViewModel,
  formatProductionRecipeInfoLine,
  formatProductionRecipeInputList,
  getProductionBuildingEffectsLabel
} from "../../page-assets/js/app/runtime/productionInfoViewModel.js";

const formatCurrency = (value) => `${value}$`;
const formatDurationLabel = (value) => `${Math.ceil(value / 1000)}s`;
const getResourceLabel = (itemId) => ({
  chemicals: "Chemicals",
  biomass: "Biomass",
  "neon-dust": "Neon Dust"
})[itemId] || itemId;

describe("production info view models", () => {
  it("formats recipe input and info lines with safe fallbacks", () => {
    const recipe = {
      name: "Neon Dust",
      inputs: { chemicals: 2, biomass: 1 },
      cleanMoneyCost: 50,
      output: { itemId: "neon-dust", amount: 3 },
      durationMs: 5000
    };

    expect(formatProductionRecipeInputList(recipe, { formatCurrency, getResourceLabel })).toBe("50$ clean + Chemicals x2 + Biomass x1");
    expect(formatProductionRecipeInfoLine(recipe, { formatCurrency, formatDurationLabel, getResourceLabel })).toBe("Neon Dust: 50$ clean + Chemicals x2 + Biomass x1 -> Neon Dust x3 · 5s");
    expect(formatProductionRecipeInputList()).toBe("Bez vstupu");
  });

  it("builds production building info payload without mutating inputs", () => {
    const recipes = {
      dust: {
        name: "Neon Dust",
        inputs: { chemicals: 1 },
        output: { itemId: "neon-dust", amount: 2 },
        durationMs: 4000
      }
    };
    const viewModel = createProductionBuildingInfoViewModel({
      buildingName: "druglab",
      recipes,
      state: { level: 2 },
      readyCount: 1,
      upgradeCost: 250,
      maxLevel: 14,
      productionConfig: { druglab: { label: "Drug Lab", infoText: "Lab info." } },
      getMultiplier: (buildingName, level) => level === 3 ? 1.3 : 1.2,
      formatCurrency,
      formatDurationLabel,
      getResourceLabel
    });

    expect(viewModel.config.infoText).toBe("Lab info.");
    expect(viewModel.multiplier).toBe(1.2);
    expect(viewModel.nextMultiplier).toBe(1.3);
    expect(viewModel.effectsLabel).toBe("Drug Lab · produkce +20%");
    expect(viewModel.recipeLines[0]).toBe("Neon Dust: Chemicals x1 -> Neon Dust x2 · 4s");
    expect(recipes.dust.inputs.chemicals).toBe(1);
  });

  it("builds factory info rows with exact labels", () => {
    const viewModel = createFactoryBuildingInfoViewModel({
      factoryState: { level: 2 },
      syncResult: {
        productionMultiplier: 1.25,
        rates: { metalPartsPerHour: 1, techCorePerHour: 2, combatModulePerHour: 3 }
      },
      collectableAmount: 4,
      config: {
        maxLevel: 3,
        recipes: {
          "metal-parts": {
            name: "Metal Parts",
            inputs: {},
            cleanMoneyCost: 300,
            output: { itemId: "metal-parts", amount: 1 },
            durationMs: 240_000
          },
          "tech-core": {
            name: "Tech Core",
            inputs: { "metal-parts": 4 },
            cleanMoneyCost: 900,
            output: { itemId: "tech-core", amount: 1 },
            durationMs: 480_000
          },
          "combat-module": {
            name: "Bojový modul",
            inputs: { "metal-parts": 4, "tech-core": 2 },
            cleanMoneyCost: 2500,
            output: { itemId: "combat-module", amount: 1 },
            durationMs: 900_000
          }
        }
      },
      formatCurrency,
      formatDurationLabel,
      getFactoryUpgradeCost: () => 100,
      getFactoryLevelMultiplier: () => 1.5
    });

    expect(viewModel.rows[0]).toEqual({ label: "Level", value: "L2" });
    expect(viewModel.rows[1]).toEqual({ label: "Upgrade", value: "100$ -> L3" });
    expect(viewModel.rows[2].value).toBe("Produkce a craft rychlost +50%.");
    expect(viewModel.rows[4].value).toBe("4 ks hotovo do skladu");
    expect(viewModel.actions[1].description).toBe("Stojí 100$ clean cash a zvedne produkci na +50%.");
    expect(viewModel.description).toContain("Metal Parts, Tech Core a Combat Module");
    expect(viewModel.description).toContain("pokročilé boost protokoly");
    expect(viewModel.effectsLabel).toBe("Další level +25% rychlost");
    expect(viewModel.effectsLabel).not.toContain("Výroba běží přes sloty");
    expect(viewModel.effectsLabel).not.toContain("fronta po kusech");
    expect(viewModel.upgrade).toEqual({ costLabel: "100$", benefitLabel: "L3 · produkce +50%" });
    expect(viewModel.products).toHaveLength(3);
    expect(viewModel.products[0]).toMatchObject({
      id: "metal-parts",
      title: "Metal Parts",
      durationLabel: "240s",
      costLabel: "300$ clean"
    });
    expect(viewModel.products[2]).toMatchObject({
      id: "combat-module",
      title: "Bojový modul",
      durationLabel: "900s",
      costLabel: "2500$ clean + Metal Parts x4 + Tech Core x2"
    });
    expect(viewModel.rows[5].value).toBe("2500$ clean + Metal Parts x4 + Tech Core x2 · 900s");
  });

  it("handles missing config without crashing", () => {
    expect(getProductionBuildingEffectsLabel("unknown", 1)).toBe("Budova · základní produkční rychlost");
    expect(createProductionBuildingInfoViewModel().recipeLines).toEqual([]);
    expect(createFactoryBuildingInfoViewModel().rows).toHaveLength(6);
    expect(createFactoryBuildingInfoViewModel().products).toHaveLength(3);
  });
});
