import type { StreetDealersBalanceConfig } from "../contracts/balance-config";
import { freeModeDrugLabConfig } from "../modes/free/free-mode-drug-lab-config";
import { freeModePharmacyConfig } from "../modes/free/free-mode-pharmacy-config";

export const STREET_SALE_PRICE_MULTIPLIER = 1.8;

const getStreetSalePrice = (recipeId: "neon-dust" | "pulse-shot" | "velvet-smoke"): number => {
  const recipe = freeModeDrugLabConfig.recipes[recipeId];
  const inputsCost = Object.entries(recipe.inputCosts).reduce((total, [itemId, amount]) => {
    const input = Object.values(freeModePharmacyConfig.recipes).find((candidate) => candidate.outputResourceKey === itemId);
    if (!input || Object.keys(input.inputCosts).length > 0) {
      throw new Error(`Street sale input '${itemId}' requires a complete replacement value.`);
    }
    return total + amount * input.cleanCashCostPerUnit;
  }, 0);
  return Math.round((recipe.cleanCashCostPerUnit + inputsCost) * STREET_SALE_PRICE_MULTIPLIER);
};

export const freeModeStreetDealersConfig: StreetDealersBalanceConfig = {
  id: "street_dealers",
  buildingTypeId: "street_dealers",
  name: "Pouliční dealeři",
  countOnMap: 19,
  category: ["dirty_cash", "drug_distribution", "street_economy"],
  cleanCashPerMinute: 0,
  dirtyCashPerMinute: 36,
  influencePerMinute: 0,
  populationPerMinute: 0,
  heatPerMinute: 0.06,
  noCleanCash: true,
  noInfluence: true,
  noPopulationProduction: true,
  noIntelPower: true,
  noLaundering: true,
  noAuditRisk: true,
  startDrugSale: {
    actionId: "start_drug_sale"
  },
  dealerSlots: [
    { slotId: "slot-1", itemId: "neon-dust" },
    { slotId: "slot-2", itemId: "pulse-shot" },
    { slotId: "slot-3", itemId: "velvet-smoke" }
  ],
  sellableDrugs: [
    {
      itemId: "neon-dust",
      label: "Neon Dust",
      aliases: ["neonDust"],
      unitSalePriceDirtyCash: getStreetSalePrice("neon-dust"),
      cooldownMinutes: 4,
      baseHeatPerUnit: 2,
      minimumAmountPerSale: 10,
      baseStreetRiskPct: 4
    },
    {
      itemId: "pulse-shot",
      label: "Pulse Shot",
      aliases: ["pulseShot"],
      unitSalePriceDirtyCash: getStreetSalePrice("pulse-shot"),
      cooldownMinutes: 5,
      baseHeatPerUnit: 3,
      minimumAmountPerSale: 10,
      baseStreetRiskPct: 6
    },
    {
      itemId: "velvet-smoke",
      label: "Velvet Smoke",
      aliases: ["velvetSmoke"],
      unitSalePriceDirtyCash: getStreetSalePrice("velvet-smoke"),
      cooldownMinutes: 6,
      baseHeatPerUnit: 4,
      minimumAmountPerSale: 10,
      baseStreetRiskPct: 8
    }
  ],
  streetIncidents: {
    extraCooldownMinutes: 3,
    fakeCustomerRewardPenaltyPct: 25,
    streetConflictHeatGain: 8,
    lostPackageAmountPct: 15,
    maxStreetRiskPct: 35
  },
  network: {
    passiveDirtyIncomeBonusPctPerExtraDealer: 4,
    saleSpeedBonusPctPerExtraDealer: 3,
    heatBonusPctPerExtraDealer: 3,
    maxPassiveDirtyIncomeMultiplier: 1.28,
    maxSaleSpeedMultiplier: 1.22,
    maxHeatMultiplier: 1.22
  }
};
