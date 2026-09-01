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

export interface NeutralRobberyTimingConfig {
  dayLengthTicks?: number;
  nightLengthTicks?: number;
}

const DEFAULT_ZONE = "residential";
export const NEUTRAL_ROBBERY_MIN_CASH_LOOT = 1_000;
export const NEUTRAL_ROBBERY_MATERIAL_KEYS = [
  "chemicals",
  "biomass",
  "metal-parts",
  "stim-pack",
  "tech-core",
  "combat-module"
] as const;
export const NEUTRAL_ROBBERY_LOOT_KEYS = [
  "cash",
  "dirty-cash",
  ...NEUTRAL_ROBBERY_MATERIAL_KEYS
] as const;

const MATERIAL_RARITY_MAX: Record<typeof NEUTRAL_ROBBERY_MATERIAL_KEYS[number], number> = {
  chemicals: 5,
  biomass: 5,
  "metal-parts": 5,
  "stim-pack": 4,
  "tech-core": 3,
  "combat-module": 2
};

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
    "metal-parts": rollRange(initialSeed, "metal-parts", ranges.metalParts),
    "stim-pack": rollRange(initialSeed, "stim-pack", ranges.stimPack),
    "tech-core": rollRange(initialSeed, "tech-core", ranges.techCore),
    "combat-module": rollRange(initialSeed, "combat-module", ranges.combatModule)
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

export const resolveCurrentNeutralDistrictLootPool = (
  worldSeed: string,
  district: District,
  currentTick: number,
  config: NonNullable<ConflictBalanceConfig["robbery"]>,
  timing: NeutralRobberyTimingConfig = {}
): NeutralDistrictLootPool => {
  const cityDayLength = Math.max(
    0,
    Number(timing.dayLengthTicks ?? 0) + Number(timing.nightLengthTicks ?? 0)
  );
  const cityDay = cityDayLength > 0
    ? Math.floor(Math.max(0, currentTick) / cityDayLength)
    : 0;
  const seededPool = district.neutralLootPool
    ?? seedNeutralDistrictLootPool(worldSeed, district, cityDay, config);
  return regenerateNeutralDistrictLootPool(
    seededPool,
    cityDay,
    config.cityDayRegenerationFraction
  );
};

export const resolveNeutralRobbery = (
  worldSeed: string,
  commandId: string,
  districtId: string,
  pool: NeutralDistrictLootPool
): NeutralRobberyResolution => {
  if (!hasNeutralDistrictRobberyLoot(pool)) {
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
  const loot = createNeutralRobberyLoot(seed, pool, outcome);
  const nextPool = {
    ...pool,
    cash: pool.cash - loot.cash,
    dirtyCash: pool.dirtyCash - loot["dirty-cash"],
    resources: Object.fromEntries(Object.entries(pool.resources).map(([key, amount]) => [
      key,
      Math.max(0, Number(amount ?? 0) - Number(loot[key] ?? 0))
    ])),
    version: pool.version + 1
  };
  const heat = outcome === "success"
    ? { playerHeat: 3, districtHeat: 4 }
    : outcome === "partial"
      ? { playerHeat: 4, districtHeat: 4 }
      : { playerHeat: 6, districtHeat: 3 };

  return { outcome, loot, nextPool, ...heat };
};

export const hasNeutralDistrictRobberyLoot = (pool: NeutralDistrictLootPool): boolean => (
  Math.max(pool.cash, pool.dirtyCash) >= NEUTRAL_ROBBERY_MIN_CASH_LOOT
  && NEUTRAL_ROBBERY_MATERIAL_KEYS.filter((key) => Number(pool.resources[key] ?? 0) > 0).length >= 2
);

const createNeutralRobberyLoot = (
  seed: string,
  pool: NeutralDistrictLootPool,
  outcome: NeutralRobberyOutcome
): Record<string, number> => {
  const loot = Object.fromEntries(NEUTRAL_ROBBERY_LOOT_KEYS.map((key) => [key, 0]));
  if (outcome === "failed" || outcome === "exhausted") return loot;

  const cashCandidates = ([
    ["cash", pool.cash],
    ["dirty-cash", pool.dirtyCash]
  ] as const).filter(([, amount]) => amount >= NEUTRAL_ROBBERY_MIN_CASH_LOOT);
  const selectedCash = cashCandidates[
    Math.floor(deterministicUnitInterval(`${seed}:cash-channel`) * cashCandidates.length)
  ] ?? cashCandidates[0];
  if (selectedCash) {
    const maximumBonus = outcome === "success" ? 1_500 : 500;
    loot[selectedCash[0]] = Math.min(
      selectedCash[1],
      NEUTRAL_ROBBERY_MIN_CASH_LOOT
        + Math.floor(deterministicUnitInterval(`${seed}:cash-amount`) * (maximumBonus + 1))
    );
  }

  const candidates = NEUTRAL_ROBBERY_MATERIAL_KEYS
    .filter((key) => Number(pool.resources[key] ?? 0) > 0)
    .sort((left, right) => (
      deterministicUnitInterval(`${seed}:material-order:${left}`)
      - deterministicUnitInterval(`${seed}:material-order:${right}`)
      || left.localeCompare(right)
    ));
  const itemCount = Math.min(
    candidates.length,
    2 + Number(outcome === "success" && deterministicUnitInterval(`${seed}:material-count`) >= 0.55)
  );
  for (const key of candidates.slice(0, itemCount)) {
    const rarityMaximum = MATERIAL_RARITY_MAX[key];
    loot[key] = Math.min(
      Number(pool.resources[key] ?? 0),
      1 + Math.floor(deterministicUnitInterval(`${seed}:material-amount:${key}`) * rarityMaximum)
    );
  }
  return loot;
};

export const getNeutralLootPoolLevel = (pool: NeutralDistrictLootPool): "rich" | "partial" | "low" | "exhausted" => {
  const initial = pool.initialCash + pool.initialDirtyCash
    + Object.values(pool.initialResources).reduce((sum, amount) => sum + amount, 0);
  const current = pool.cash + pool.dirtyCash
    + Object.values(pool.resources).reduce((sum, amount) => sum + amount, 0);
  const ratio = initial > 0 ? current / initial : 0;
  return ratio <= 0 ? "exhausted" : ratio < 0.25 ? "low" : ratio < 0.65 ? "partial" : "rich";
};

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
