import type { BalanceConfig } from "../../contracts/balance-config";
import { baseCooldownTicksForFinalMinutes } from "./free-mode-timing";

export const freeModeCraftBuildings: NonNullable<BalanceConfig["craftBuildings"]> = {
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
        durationTicks: baseCooldownTicksForFinalMinutes(4),
        inputCosts: {
          chemicals: 6
        },
        outputResourceKey: "stim-pack",
        outputResourceLabel: "Stim Pack",
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
      "neon-dust": {
        label: "Neon Dust",
        durationTicks: baseCooldownTicksForFinalMinutes(4),
        inputCosts: {
          chemicals: 1
        },
        outputResourceKey: "neon-dust",
        outputResourceLabel: "Neon Dust",
        outputAmount: 2
      },
      "pulse-shot": {
        label: "Pulse Shot",
        durationTicks: baseCooldownTicksForFinalMinutes(5),
        inputCosts: {
          chemicals: 2,
          biomass: 1
        },
        outputResourceKey: "pulse-shot",
        outputResourceLabel: "Pulse Shot",
        outputAmount: 1
      },
      "velvet-smoke": {
        label: "Velvet Smoke",
        durationTicks: baseCooldownTicksForFinalMinutes(6),
        inputCosts: {
          biomass: 2,
          chemicals: 1
        },
        outputResourceKey: "velvet-smoke",
        outputResourceLabel: "Velvet Smoke",
        outputAmount: 2
      },
      "ghost-serum": {
        label: "Ghost Serum",
        durationTicks: baseCooldownTicksForFinalMinutes(8),
        inputCosts: {
          chemicals: 2,
          biomass: 1,
          "stim-pack": 1
        },
        outputResourceKey: "ghost-serum",
        outputResourceLabel: "Ghost Serum",
        outputAmount: 1
      },
      "overdrive-x": {
        label: "Overdrive X",
        durationTicks: baseCooldownTicksForFinalMinutes(10),
        inputCosts: {
          chemicals: 3,
          biomass: 2,
          "stim-pack": 2
        },
        outputResourceKey: "overdrive-x",
        outputResourceLabel: "Overdrive X",
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
        durationTicks: baseCooldownTicksForFinalMinutes(6),
        inputCosts: {
          "metal-parts": 4
        },
        outputResourceKey: "tech-core",
        outputResourceLabel: "Tech Core",
        outputAmount: 1
      },
      "combat-module": {
        label: "Combat Module",
        durationTicks: baseCooldownTicksForFinalMinutes(12),
        inputCosts: {
          "metal-parts": 4,
          "tech-core": 2
        },
        outputResourceKey: "combat-module",
        outputResourceLabel: "Combat Module",
        outputAmount: 1
      }
    }
  },
  armory: {
    upgrade: {
      maxLevel: 14,
      upgradeBaseCost: 5200,
      costGrowth: 1.42,
      productionMultiplierPerLevel: 10
    },
    recipes: {
      "baseball-bat": {
        label: "Baseball Bat",
        durationTicks: baseCooldownTicksForFinalMinutes(3),
        inputCosts: {
          "metal-parts": 2
        },
        outputResourceKey: "baseball-bat",
        outputResourceLabel: "Baseball Bat",
        outputAmount: 3
      },
      pistol: {
        label: "Pistol",
        durationTicks: baseCooldownTicksForFinalMinutes(5),
        inputCosts: {
          "metal-parts": 3,
          "tech-core": 1
        },
        outputResourceKey: "pistol",
        outputResourceLabel: "Pistol",
        outputAmount: 2
      },
      grenade: {
        label: "Grenade",
        durationTicks: baseCooldownTicksForFinalMinutes(6),
        inputCosts: {
          "metal-parts": 2,
          "tech-core": 1
        },
        outputResourceKey: "grenade",
        outputResourceLabel: "Grenade",
        outputAmount: 2
      },
      smg: {
        label: "SMG",
        durationTicks: baseCooldownTicksForFinalMinutes(8),
        inputCosts: {
          "metal-parts": 5,
          "tech-core": 2
        },
        outputResourceKey: "smg",
        outputResourceLabel: "SMG",
        outputAmount: 1
      },
      bazooka: {
        label: "Bazooka",
        durationTicks: baseCooldownTicksForFinalMinutes(14),
        inputCosts: {
          "metal-parts": 7,
          "tech-core": 3
        },
        outputResourceKey: "bazooka",
        outputResourceLabel: "Bazooka",
        outputAmount: 1
      },
      vest: {
        label: "Vest",
        durationTicks: baseCooldownTicksForFinalMinutes(5),
        inputCosts: {
          "metal-parts": 3,
          "tech-core": 1
        },
        outputResourceKey: "vest",
        outputResourceLabel: "Vest",
        outputAmount: 2
      },
      barricades: {
        label: "Barricades",
        durationTicks: baseCooldownTicksForFinalMinutes(5),
        inputCosts: {
          "metal-parts": 4
        },
        outputResourceKey: "barricades",
        outputResourceLabel: "Barricades",
        outputAmount: 2
      },
      cameras: {
        label: "Cameras",
        durationTicks: baseCooldownTicksForFinalMinutes(7),
        inputCosts: {
          "metal-parts": 2,
          "tech-core": 2
        },
        outputResourceKey: "cameras",
        outputResourceLabel: "Cameras",
        outputAmount: 2
      },
      "defense-tower": {
        label: "Defense Tower",
        durationTicks: baseCooldownTicksForFinalMinutes(16),
        inputCosts: {
          "metal-parts": 8,
          "tech-core": 3
        },
        outputResourceKey: "defense-tower",
        outputResourceLabel: "Defense Tower",
        outputAmount: 1
      },
      alarm: {
        label: "Alarm",
        durationTicks: baseCooldownTicksForFinalMinutes(5),
        inputCosts: {
          "metal-parts": 2,
          "tech-core": 1
        },
        outputResourceKey: "alarm",
        outputResourceLabel: "Alarm",
        outputAmount: 1
      }
    }
  }
};
