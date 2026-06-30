import type { BalanceConfig } from "../contracts/balance-config";

export const baseProductionBuildingsConfig: NonNullable<BalanceConfig["productionBuildings"]> = {
  pharmacy: {
    resourceKey: "chemicals",
    resourceLabel: "Chemicals",
    amountPerTick: 5,
    storageCap: 25,
    upgrade: {
      maxLevel: 14,
      upgradeBaseCost: 3200,
      costGrowth: 1.42,
      productionMultiplierPerLevel: 10
    }
  },
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
  },
  drug_lab: {
    resourceKey: "neon-dust",
    resourceLabel: "Neon Dust",
    amountPerTick: 2,
    storageCap: 18,
    upgrade: {
      maxLevel: 14,
      upgradeBaseCost: 4200,
      costGrowth: 1.42,
      productionMultiplierPerLevel: 10
    }
  }
};

export const baseCraftBuildingsConfig: NonNullable<BalanceConfig["craftBuildings"]> = {
  pharmacy: {
    upgrade: {
      maxLevel: 14,
      upgradeBaseCost: 3200,
      costGrowth: 1.42,
      productionMultiplierPerLevel: 10
    },
    recipes: {
      "stim-pack": {
        label: "Stim Pack",
        durationTicks: 2,
        inputCosts: { chemicals: 6 },
        outputResourceKey: "stim-pack",
        outputResourceLabel: "Stim Pack",
        outputAmount: 1
      }
    }
  },
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
        label: "Combat Module",
        durationTicks: 3,
        inputCosts: { "metal-parts": 4, "tech-core": 2 },
        outputResourceKey: "combat-module",
        outputResourceLabel: "Combat Module",
        outputAmount: 1
      }
    }
  },
  drug_lab: {
    upgrade: {
      maxLevel: 14,
      upgradeBaseCost: 4200,
      costGrowth: 1.42,
      productionMultiplierPerLevel: 10
    },
    recipes: {
      "pulse-shot": {
        label: "Pulse Shot",
        durationTicks: 2,
        inputCosts: { chemicals: 2, biomass: 1 },
        outputResourceKey: "pulse-shot",
        outputResourceLabel: "Pulse Shot",
        outputAmount: 1
      },
      "velvet-smoke": {
        label: "Velvet Smoke",
        durationTicks: 2,
        inputCosts: { biomass: 2, chemicals: 1 },
        outputResourceKey: "velvet-smoke",
        outputResourceLabel: "Velvet Smoke",
        outputAmount: 2
      },
      "ghost-serum": {
        label: "Ghost Serum",
        durationTicks: 3,
        inputCosts: { chemicals: 2, biomass: 1, "stim-pack": 1 },
        outputResourceKey: "ghost-serum",
        outputResourceLabel: "Ghost Serum",
        outputAmount: 1
      },
      "overdrive-x": {
        label: "Overdrive X",
        durationTicks: 4,
        inputCosts: { chemicals: 3, biomass: 2, "stim-pack": 2 },
        outputResourceKey: "overdrive-x",
        outputResourceLabel: "Overdrive X",
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
