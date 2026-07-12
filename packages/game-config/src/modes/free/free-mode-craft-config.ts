import type { BalanceConfig } from "../../contracts/balance-config";
import { baseCooldownTicksForFinalMinutes } from "./free-mode-timing";

export const freeModeCraftBuildings: NonNullable<BalanceConfig["craftBuildings"]> = {
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
