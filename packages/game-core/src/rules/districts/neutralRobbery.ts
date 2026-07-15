import type { District, NeutralDistrictLootPool } from "@empire/shared-types";
import type { ConflictBalanceConfig } from "../../contracts";
import { deterministicUnitInterval } from "../../utils/math";

export type NeutralRobberyOutcome = "success" | "partial" | "failed" | "exhausted";

export interface NeutralRobberyResolution {
  outcome: NeutralRobberyOutcome;
  loot: Record<string, number>;
  nextPool: NeutralDistrictLootPool;
  playerHeat: number;
  districtHeat: number;
}

const DEFAULT_ZONE = "residential";

export const seedNeutralDistrictLootPool = (
  worldSeed: string,
  district: District,
  cityDay: number,
  config: NonNullable<ConflictBalanceConfig["robbery"]>
): NeutralDistrictLootPool => {
  const zone = normalizeZone(district.zone, config);
  const ranges = config.poolsByZone[zone] ?? config.poolsByZone[DEFAULT_ZONE]
    ?? Object.values(config.poolsByZone)[0];
  const initialSeed = `${worldSeed}:neutral-loot:${district.id}:${zone}`;
  const cash = rollRange(initialSeed, "cash", ranges.cash);
  const dirtyCash = rollRange(initialSeed, "dirty-cash", ranges.dirtyCash);
  const resources = {
    chemicals: rollRange(initialSeed, "chemicals", ranges.chemicals),
    biomass: rollRange(initialSeed, "biomass", ranges.biomass),
    "metal-parts": rollRange(initialSeed, "metal-parts", ranges.metalParts)
  };
  return {
    initialSeed,
    initialCash: cash,
    initialDirtyCash: dirtyCash,
    initialResources: { ...resources },
    cash,
    dirtyCash,
    resources,
    lastRegenerationCityDay: cityDay,
    version: 1
  };
};

export const regenerateNeutralDistrictLootPool = (
  pool: NeutralDistrictLootPool,
  cityDay: number,
  fraction: number
): NeutralDistrictLootPool => {
  const elapsedDays = Math.max(0, cityDay - pool.lastRegenerationCityDay);
  if (elapsedDays <= 0) return pool;
  const regenerationFraction = Math.min(1, Math.max(0, fraction)) * elapsedDays;
  const resources = Object.fromEntries(Object.entries(pool.initialResources).map(([key, initial]) => [
    key,
    Math.min(initial, Number(pool.resources[key] ?? 0) + Math.floor(initial * regenerationFraction))
  ]));
  return {
    ...pool,
    cash: Math.min(pool.initialCash, pool.cash + Math.floor(pool.initialCash * regenerationFraction)),
    dirtyCash: Math.min(
      pool.initialDirtyCash,
      pool.dirtyCash + Math.floor(pool.initialDirtyCash * regenerationFraction)
    ),
    resources,
    lastRegenerationCityDay: cityDay,
    version: pool.version + 1
  };
};

export const resolveNeutralRobbery = (
  worldSeed: string,
  commandId: string,
  districtId: string,
  pool: NeutralDistrictLootPool
): NeutralRobberyResolution => {
  const totalRemaining = pool.cash + pool.dirtyCash
    + Object.values(pool.resources).reduce((sum, amount) => sum + amount, 0);
  if (totalRemaining <= 0) {
    return {
      outcome: "exhausted",
      loot: {},
      nextPool: { ...pool, version: pool.version + 1 },
      playerHeat: 1,
      districtHeat: 1
    };
  }

  const seed = `${worldSeed}:${commandId}:${districtId}:${pool.version}`;
  const outcomeRoll = deterministicUnitInterval(`${seed}:outcome`);
  const outcome: NeutralRobberyOutcome = outcomeRoll < 0.62
    ? "success"
    : outcomeRoll < 0.87
      ? "partial"
      : "failed";
  const partialMultiplier = 0.35 + deterministicUnitInterval(`${seed}:partial`) * 0.25;
  const outcomeMultiplier = outcome === "success" ? 1 : outcome === "partial" ? partialMultiplier : 0;
  const loot = {
    cash: takePlanned(pool.cash, 0.18, deterministicUnitInterval(`${seed}:cash`), outcomeMultiplier),
    "dirty-cash": takePlanned(
      pool.dirtyCash,
      0.20,
      deterministicUnitInterval(`${seed}:dirty-cash`),
      outcomeMultiplier
    ),
    chemicals: takePlanned(
      Number(pool.resources.chemicals ?? 0),
      0.22,
      deterministicUnitInterval(`${seed}:chemicals`),
      outcomeMultiplier
    ),
    biomass: takePlanned(
      Number(pool.resources.biomass ?? 0),
      0.22,
      deterministicUnitInterval(`${seed}:biomass`),
      outcomeMultiplier
    ),
    "metal-parts": takePlanned(
      Number(pool.resources["metal-parts"] ?? 0),
      0.22,
      deterministicUnitInterval(`${seed}:metal-parts`),
      outcomeMultiplier
    )
  };
  const nextPool = {
    ...pool,
    cash: pool.cash - loot.cash,
    dirtyCash: pool.dirtyCash - loot["dirty-cash"],
    resources: {
      ...pool.resources,
      chemicals: Number(pool.resources.chemicals ?? 0) - loot.chemicals,
      biomass: Number(pool.resources.biomass ?? 0) - loot.biomass,
      "metal-parts": Number(pool.resources["metal-parts"] ?? 0) - loot["metal-parts"]
    },
    version: pool.version + 1
  };
  const heat = outcome === "success"
    ? { playerHeat: 3, districtHeat: 4 }
    : outcome === "partial"
      ? { playerHeat: 4, districtHeat: 4 }
      : { playerHeat: 6, districtHeat: 3 };

  return { outcome, loot, nextPool, ...heat };
};

export const getNeutralLootPoolLevel = (pool: NeutralDistrictLootPool): "rich" | "partial" | "low" | "exhausted" => {
  const initial = pool.initialCash + pool.initialDirtyCash
    + Object.values(pool.initialResources).reduce((sum, amount) => sum + amount, 0);
  const current = pool.cash + pool.dirtyCash
    + Object.values(pool.resources).reduce((sum, amount) => sum + amount, 0);
  const ratio = initial > 0 ? current / initial : 0;
  return ratio <= 0 ? "exhausted" : ratio < 0.25 ? "low" : ratio < 0.65 ? "partial" : "rich";
};

const takePlanned = (available: number, maxFraction: number, roll: number, multiplier: number): number =>
  Math.min(available, Math.floor(available * maxFraction * (0.6 + roll * 0.4) * multiplier));

const rollRange = (
  seed: string,
  channel: string,
  range: { min: number; max: number }
): number => {
  const min = Math.max(0, Math.floor(range.min));
  const max = Math.max(min, Math.floor(range.max));
  return min + Math.floor(deterministicUnitInterval(`${seed}:${channel}`) * (max - min + 1));
};

const normalizeZone = (
  value: string,
  config: NonNullable<ConflictBalanceConfig["robbery"]>
): string => {
  const zone = String(value || "").toLowerCase();
  if (config.poolsByZone[zone]) return zone;
  return Object.keys(config.poolsByZone).find((key) => zone.startsWith(key.slice(0, 3))) ?? DEFAULT_ZONE;
};
