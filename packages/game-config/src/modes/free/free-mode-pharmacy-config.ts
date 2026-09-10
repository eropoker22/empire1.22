import type { PharmacyBalanceConfig } from "../../contracts/game-mode-config";
import { baseCooldownTicksForFinalMinutes } from "./free-mode-timing";

export const freeModePharmacyConfig: PharmacyBalanceConfig = {
  independentProductionLines: true,
  upgrade: {
    maxLevel: 14,
    upgradeBaseCost: 3200,
    costGrowth: 1.42,
    productionMultiplierPerLevel: 10
  },
  recipes: {
    chemicals: {
      label: "Chemicals",
      outputResourceKey: "chemicals",
      outputAmount: 1,
      cleanCashCostPerUnit: 360,
      inputCosts: {},
      durationTicksPerUnit: baseCooldownTicksForFinalMinutes(2),
      localOutputCap: 60,
      queueCap: 63
    },
    biomass: {
      label: "Biomass",
      outputResourceKey: "biomass",
      outputAmount: 1,
      cleanCashCostPerUnit: 420,
      inputCosts: {},
      durationTicksPerUnit: baseCooldownTicksForFinalMinutes(4),
      localOutputCap: 60,
      queueCap: 63
    },
    "stim-pack": {
      label: "Stim Pack",
      outputResourceKey: "stim-pack",
      outputAmount: 1,
      cleanCashCostPerUnit: 800,
      inputCosts: {},
      durationTicksPerUnit: baseCooldownTicksForFinalMinutes(10),
      localOutputCap: 24,
      queueCap: 27
    }
  }
};
