import type { ConvenienceStoreBalanceConfig } from "../contracts";

const assertFiniteNonNegative = (value: number, field: string): void => {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Convenience Store config requires a non-negative ${field}.`);
  }
};

const assertPct = (value: number, field: string): void => {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`Convenience Store config requires ${field} between 0 and 100.`);
  }
};

export const validateConvenienceStoreConfig = (config: ConvenienceStoreBalanceConfig): void => {
  if (config.id !== "convenience_store" || config.buildingTypeId !== "convenience_store") {
    throw new Error("Convenience Store config requires canonical identifiers.");
  }
  if (!Number.isInteger(config.countOnMap) || config.countOnMap <= 0) {
    throw new Error("Convenience Store config requires a positive integer countOnMap.");
  }
  if (!Number.isInteger(config.passiveRumorIntervalMinutes) || config.passiveRumorIntervalMinutes <= 0) {
    throw new Error("Convenience Store config requires a positive integer rumor interval.");
  }
  if (!Number.isInteger(config.maxRumorChecksPerPlayerPerInterval) || config.maxRumorChecksPerPlayerPerInterval <= 0) {
    throw new Error("Convenience Store config requires a positive rumor check limit.");
  }
  assertPct(config.baseRumorChancePct, "baseRumorChancePct");
  assertPct(config.districtHintChancePct, "districtHintChancePct");
  assertPct(config.areaHintChancePct, "areaHintChancePct");
  assertPct(config.buildingHintChancePct, "buildingHintChancePct");

  if (config.rumorTypes.length === 0 || new Set(config.rumorTypes).size !== config.rumorTypes.length) {
    throw new Error("Convenience Store config requires unique rumor types.");
  }

  const tiers = [...config.truthChanceByOwnedCount].sort((left, right) => left.minOwned - right.minOwned);
  let expectedMin = 1;
  for (const tier of tiers) {
    if (!Number.isInteger(tier.minOwned) || tier.minOwned !== expectedMin) {
      throw new Error("Convenience Store truth tiers must be contiguous from one owned store.");
    }
    assertPct(tier.truthChancePct, "truthChancePct");
    if (tier.maxOwned === null) {
      expectedMin = Number.POSITIVE_INFINITY;
      continue;
    }
    if (!Number.isInteger(tier.maxOwned) || tier.maxOwned < tier.minOwned) {
      throw new Error("Convenience Store truth tiers require valid ownership ranges.");
    }
    expectedMin = tier.maxOwned + 1;
  }
  if (tiers.length === 0 || tiers.at(-1)?.maxOwned !== null) {
    throw new Error("Convenience Store truth tiers require an open-ended final tier.");
  }

  for (const [field, value] of Object.entries(config.network)) {
    assertFiniteNonNegative(value, `network.${field}`);
    if (field.startsWith("max") && value < 1) {
      throw new Error(`Convenience Store config requires ${field} to be at least one.`);
    }
  }
  for (const [field, value] of Object.entries(config.restaurantSynergy)) {
    assertFiniteNonNegative(value, `restaurantSynergy.${field}`);
  }
};
