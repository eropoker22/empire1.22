import type { FactoryBalanceConfig } from "@empire/game-core";
import { baseCooldownTicksForFinalMinutes } from "./free-mode-timing";

export const freeModeFactoryConfig: FactoryBalanceConfig = {
  independentProductionLines: true,
  network: {
    speedMultipliers: {
      1: 1,
      2: 1.1,
      3: 1.2,
      4: 1.3
    },
    maxSpeedMultiplier: 1.3
  },
  upgrade: {
    maxLevel: 14,
    upgradeBaseCost: 5000,
    costGrowth: 1.47,
    productionMultiplierPerLevel: 10,
    roundCostTo: 100
  },
  recipes: {
    "metal-parts": {
      label: "Metal Parts",
      outputResourceKey: "metal-parts",
      outputAmount: 1,
      cleanCashCostPerUnit: 300,
      inputCosts: {},
      durationTicksPerUnit: baseCooldownTicksForFinalMinutes(4),
      localOutputCap: 10,
      queueCap: 8
    },
    "tech-core": {
      label: "Tech Core",
      outputResourceKey: "tech-core",
      outputAmount: 1,
      cleanCashCostPerUnit: 900,
      inputCosts: { "metal-parts": 4 },
      durationTicksPerUnit: baseCooldownTicksForFinalMinutes(8),
      localOutputCap: 5,
      queueCap: 4
    },
    "combat-module": {
      label: "Bojový modul",
      outputResourceKey: "combat-module",
      outputAmount: 1,
      cleanCashCostPerUnit: 2500,
      inputCosts: { "metal-parts": 4, "tech-core": 2 },
      durationTicksPerUnit: baseCooldownTicksForFinalMinutes(15),
      localOutputCap: 2,
      queueCap: 2
    }
  }
};
