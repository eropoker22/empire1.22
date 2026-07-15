import type { ResolvedGameModeConfig } from "../contracts/game-mode-config";

const EXPECTED_SLOT_RESOURCES = ["neon-dust", "pulse-shot", "velvet-smoke"] as const;

/** Ensures the public dealer surface remains a fixed three-product sale flow. */
export const validateStreetDealersConfig = (config: ResolvedGameModeConfig): void => {
  const dealers = config.balance.streetDealers;
  if (!dealers) return;

  if (dealers.dealerSlots.length !== EXPECTED_SLOT_RESOURCES.length || dealers.sellableDrugs.length !== EXPECTED_SLOT_RESOURCES.length) {
    throw new Error("Street Dealers require exactly three configured sale slots.");
  }

  for (const [index, resourceKey] of EXPECTED_SLOT_RESOURCES.entries()) {
    const slot = dealers.dealerSlots[index];
    const drug = dealers.sellableDrugs.find((candidate) => candidate.itemId === resourceKey);
    const recipe = config.balance.drugLab?.recipes[resourceKey];
    if (!slot || slot.slotId !== `slot-${index + 1}` || slot.itemId !== resourceKey || !drug || !recipe) {
      throw new Error(`Street Dealers require ${resourceKey} in slot ${index + 1}.`);
    }
    if (drug.minimumAmountPerSale !== 10) {
      throw new Error(`Street Dealers require a minimum sale of 10 ${resourceKey}.`);
    }
    if (drug.unitSalePriceDirtyCash !== Math.round(recipe.cleanCashCostPerUnit * 1.25)) {
      throw new Error(`Street Dealers price for ${resourceKey} must be 125% of its Drug Lab clean-cash cost.`);
    }
  }
};
