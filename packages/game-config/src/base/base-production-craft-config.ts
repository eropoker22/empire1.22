import type { BalanceConfig } from "../contracts/balance-config";

export const baseProductionBuildingsConfig: NonNullable<BalanceConfig["productionBuildings"]> = {
  factory: {
    resourceKey: "metal-parts",
    resourceLabel: "Metal Parts",
    amountPerTick: 4,
    storageCap: 24,
    upgrade: {
      maxLevel: 14,
      upgradeBaseCost: 5000,
      costGrowth: 1.47,
      productionMultiplierPerLevel: 10,
      roundCostTo: 100
    }
  }
};

export const baseCraftBuildingsConfig: NonNullable<BalanceConfig["craftBuildings"]> = {
  factory: {
    upgrade: {
      maxLevel: 14,
      upgradeBaseCost: 5000,
      costGrowth: 1.47,
      productionMultiplierPerLevel: 10,
      roundCostTo: 100
    },
    recipes: {
      "tech-core": {
        label: "Tech Core",
        durationTicks: 2,
        inputCosts: { "metal-parts": 4 },
        outputResourceKey: "tech-core",
        outputResourceLabel: "Tech Core",
        outputAmount: 1
      },
      "combat-module": {
        label: "Bojový modul",
        durationTicks: 3,
        inputCosts: { "metal-parts": 4, "tech-core": 2 },
        outputResourceKey: "combat-module",
        outputResourceLabel: "Bojový modul",
        outputAmount: 1
      }
    }
  },
  armory: {
    recipes: {
      pistol: {
        label: "Pistol",
        durationTicks: 2,
        inputCosts: { "metal-parts": 3, "tech-core": 1 },
        outputResourceKey: "pistol",
        outputResourceLabel: "Pistol",
        outputAmount: 2
      },
      smg: {
        label: "SMG",
        durationTicks: 3,
        inputCosts: { "metal-parts": 5, "tech-core": 2 },
        outputResourceKey: "smg",
        outputResourceLabel: "SMG",
        outputAmount: 1
      },
      vest: {
        label: "Vest",
        durationTicks: 2,
        inputCosts: { "metal-parts": 3, "tech-core": 1 },
        outputResourceKey: "vest",
        outputResourceLabel: "Vest",
        outputAmount: 2
      },
      barricades: {
        label: "Barricades",
        durationTicks: 2,
        inputCosts: { "metal-parts": 4 },
        outputResourceKey: "barricades",
        outputResourceLabel: "Barricades",
        outputAmount: 2
      },
      alarm: {
        label: "Alarm",
        durationTicks: 2,
        inputCosts: { "metal-parts": 2, "tech-core": 1 },
        outputResourceKey: "alarm",
        outputResourceLabel: "Alarm",
        outputAmount: 1
      }
    }
  }
};
