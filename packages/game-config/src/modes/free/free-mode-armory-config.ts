import type { ArmoryBalanceConfig } from "@empire/game-core";
import { baseCooldownTicksForFinalMinutes } from "./free-mode-timing";

export const freeModeArmoryConfig: ArmoryBalanceConfig = {
  independentProductionLines: true,
  network: {
    speedMultipliers: { 1: 1, 2: 1.1, 3: 1.2, 4: 1.3 },
    maxSpeedMultiplier: 1.3
  },
  upgrade: {
    maxLevel: 14,
    upgradeBaseCost: 5200,
    costGrowth: 1.42,
    productionMultiplierPerLevel: 10
  },
  recipes: {
    "baseball-bat": {
      category: "attack", label: "Baseballová pálka", outputResourceKey: "baseball-bat", outputAmount: 1,
      cleanCashCostPerUnit: 0, inputCosts: { "metal-parts": 2 }, durationTicksPerUnit: baseCooldownTicksForFinalMinutes(3),
      localOutputCap: 8, queueCap: 6
    },
    pistol: {
      category: "attack", label: "Pistole", outputResourceKey: "pistol", outputAmount: 1,
      cleanCashCostPerUnit: 0, inputCosts: { "metal-parts": 3, "tech-core": 1 }, durationTicksPerUnit: baseCooldownTicksForFinalMinutes(5),
      localOutputCap: 5, queueCap: 4
    },
    grenade: {
      category: "attack", label: "Granát", outputResourceKey: "grenade", outputAmount: 1,
      cleanCashCostPerUnit: 0, inputCosts: { "metal-parts": 2, "tech-core": 1 }, durationTicksPerUnit: baseCooldownTicksForFinalMinutes(6),
      localOutputCap: 4, queueCap: 4
    },
    smg: {
      category: "attack", label: "SMG", outputResourceKey: "smg", outputAmount: 1,
      cleanCashCostPerUnit: 0, inputCosts: { "metal-parts": 2, "combat-module": 1 }, durationTicksPerUnit: baseCooldownTicksForFinalMinutes(8),
      localOutputCap: 3, queueCap: 3
    },
    bazooka: {
      category: "attack", label: "Bazuka", outputResourceKey: "bazooka", outputAmount: 1,
      cleanCashCostPerUnit: 0, inputCosts: { "metal-parts": 3, "combat-module": 2 }, durationTicksPerUnit: baseCooldownTicksForFinalMinutes(14),
      localOutputCap: 2, queueCap: 2
    },
    vest: {
      category: "defense", label: "Vesta", outputResourceKey: "vest", outputAmount: 1,
      cleanCashCostPerUnit: 0, inputCosts: { "metal-parts": 3, "tech-core": 1 }, durationTicksPerUnit: baseCooldownTicksForFinalMinutes(5),
      localOutputCap: 5, queueCap: 4
    },
    barricades: {
      category: "defense", label: "Barikády", outputResourceKey: "barricades", outputAmount: 1,
      cleanCashCostPerUnit: 0, inputCosts: { "metal-parts": 4 }, durationTicksPerUnit: baseCooldownTicksForFinalMinutes(5),
      localOutputCap: 6, queueCap: 5
    },
    cameras: {
      category: "defense", label: "Kamery", outputResourceKey: "cameras", outputAmount: 1,
      cleanCashCostPerUnit: 0, inputCosts: { "metal-parts": 2, "tech-core": 2 }, durationTicksPerUnit: baseCooldownTicksForFinalMinutes(6),
      localOutputCap: 4, queueCap: 4
    },
    "defense-tower": {
      category: "defense", label: "Obranná věž", outputResourceKey: "defense-tower", outputAmount: 1,
      cleanCashCostPerUnit: 0, inputCosts: { "tech-core": 3, "combat-module": 2 }, durationTicksPerUnit: baseCooldownTicksForFinalMinutes(15),
      localOutputCap: 2, queueCap: 2
    },
    alarm: {
      category: "defense", label: "Alarm", outputResourceKey: "alarm", outputAmount: 1,
      cleanCashCostPerUnit: 0, inputCosts: { "metal-parts": 2, "tech-core": 1 }, durationTicksPerUnit: baseCooldownTicksForFinalMinutes(5),
      localOutputCap: 4, queueCap: 4
    }
  }
};
