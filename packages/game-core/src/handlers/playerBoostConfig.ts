import {
  PLAYER_BOOST_IDS,
  type PlayerBoostId
} from "@empire/shared-types";
import type { PlayerBoostBalanceConfig } from "../contracts";

const KNOWN_INPUT_RESOURCES = new Set([
  "ghost-serum",
  "pulse-shot",
  "overdrive-x",
  "combat-module"
]);

export const validatePlayerBoostConfig = (
  config: PlayerBoostBalanceConfig
): PlayerBoostBalanceConfig => {
  const ids = Object.keys(config).sort();
  const expectedIds = [...PLAYER_BOOST_IDS].sort();
  if (ids.length !== expectedIds.length || ids.some((id, index) => id !== expectedIds[index])) {
    throw new Error("Player boost config requires exactly Ghost Network, Industrial Overdrive and Tactical Grid.");
  }

  for (const boostId of PLAYER_BOOST_IDS) {
    const boost = config[boostId as PlayerBoostId];
    if (!boost || boost.boostId !== boostId) {
      throw new Error(`Player boost '${boostId}' must use its canonical boostId.`);
    }
    if (!Number.isInteger(boost.cleanCashCost) || boost.cleanCashCost <= 0) {
      throw new Error(`Player boost '${boostId}' requires a positive integer clean cash cost.`);
    }
    if (!Number.isInteger(boost.activeDurationTicks) || boost.activeDurationTicks <= 0) {
      throw new Error(`Player boost '${boostId}' requires a positive duration.`);
    }
    if (!Number.isInteger(boost.cooldownTicks) || boost.cooldownTicks <= boost.activeDurationTicks) {
      throw new Error(`Player boost '${boostId}' cooldown must exceed its active duration.`);
    }
    for (const [resourceKey, amount] of Object.entries(boost.inputCosts)) {
      if (!KNOWN_INPUT_RESOURCES.has(resourceKey) || !Number.isInteger(amount) || amount <= 0) {
        throw new Error(`Player boost '${boostId}' has an invalid material input.`);
      }
    }
  }

  return config;
};
