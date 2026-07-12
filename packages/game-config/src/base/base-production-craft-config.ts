import type { BalanceConfig } from "../contracts/balance-config";

export const baseProductionBuildingsConfig: NonNullable<BalanceConfig["productionBuildings"]> = {};

export const baseCraftBuildingsConfig: NonNullable<BalanceConfig["craftBuildings"]> = {
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
