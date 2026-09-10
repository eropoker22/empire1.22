import type { DrugLabBalanceConfig } from "@empire/game-core";
import { baseCooldownTicksForFinalMinutes } from "./free-mode-timing";

export const freeModeDrugLabConfig: DrugLabBalanceConfig = {
  independentProductionLines: true,
  upgrade: {
    maxLevel: 14,
    upgradeBaseCost: 4200,
    costGrowth: 1.42,
    productionMultiplierPerLevel: 10
  },
  recipes: {
    "neon-dust": {
      label: "Neon Dust",
      description: "Pouliční stimulant a laboratorní vstup používaný také pro Ghost Network.",
      outputResourceKey: "neon-dust",
      outputAmount: 1,
      itemRole: "trade-material",
      directlyUsable: false,
      cleanCashCostPerUnit: 500,
      inputCosts: { chemicals: 2 },
      durationTicksPerUnit: baseCooldownTicksForFinalMinutes(5),
      localOutputCap: 60,
      queueCap: 63
    },
    "pulse-shot": {
      label: "Pulse Shot",
      description: "Prodejná laboratorní látka a výrobní materiál.",
      outputResourceKey: "pulse-shot",
      outputAmount: 1,
      itemRole: "trade-material",
      directlyUsable: false,
      cleanCashCostPerUnit: 800,
      inputCosts: { chemicals: 2, biomass: 1 },
      durationTicksPerUnit: baseCooldownTicksForFinalMinutes(8),
      localOutputCap: 24,
      queueCap: 27
    },
    "velvet-smoke": {
      label: "Velvet Smoke",
      description: "Prodejná laboratorní látka a výrobní materiál.",
      outputResourceKey: "velvet-smoke",
      outputAmount: 1,
      itemRole: "trade-material",
      directlyUsable: false,
      cleanCashCostPerUnit: 900,
      inputCosts: { chemicals: 1, biomass: 2 },
      durationTicksPerUnit: baseCooldownTicksForFinalMinutes(15),
      localOutputCap: 24,
      queueCap: 27
    },
    "ghost-serum": {
      label: "Ghost Serum",
      description: "Vzácná laboratorní komponenta používaná pro Ghost Network a Tactical Grid.",
      outputResourceKey: "ghost-serum",
      outputAmount: 1,
      itemRole: "boost-component",
      directlyUsable: false,
      cleanCashCostPerUnit: 2500,
      inputCosts: { "neon-dust": 2, "pulse-shot": 1 },
      durationTicksPerUnit: baseCooldownTicksForFinalMinutes(20),
      localOutputCap: 8,
      queueCap: 11
    },
    "overdrive-x": {
      label: "Overdrive X",
      description: "Nestabilní strategická komponenta používaná pro Industrial Overdrive a Tactical Grid.",
      outputResourceKey: "overdrive-x",
      outputAmount: 1,
      itemRole: "boost-component",
      directlyUsable: false,
      cleanCashCostPerUnit: 4500,
      inputCosts: { "pulse-shot": 1, "velvet-smoke": 2 },
      durationTicksPerUnit: baseCooldownTicksForFinalMinutes(30),
      localOutputCap: 8,
      queueCap: 11
    }
  }
};
