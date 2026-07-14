import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { freeModeArmoryConfig } from "../packages/game-config/src/modes/free/free-mode-armory-config";
import { freeModeDrugLabConfig } from "../packages/game-config/src/modes/free/free-mode-drug-lab-config";
import { freeModeFactoryConfig } from "../packages/game-config/src/modes/free/free-mode-factory-config";
import { freeModePharmacyConfig } from "../packages/game-config/src/modes/free/free-mode-pharmacy-config";
import { freeModePlayerBoostConfig } from "../packages/game-config/src/modes/free/free-mode-player-boost-config";
import {
  FREE_MODE_COOLDOWN_MULTIPLIER,
  FREE_MODE_TICK_RATE_MS
} from "../packages/game-config/src/modes/free/free-mode-timing";
import { freeModeAttackWeaponsConfig } from "../packages/game-config/src/public/free-mode-attack-weapons-config";
import { freeModeWarehouseConfig } from "../packages/game-config/src/public/free-mode-warehouse-config";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = resolve(
  rootDir,
  "packages/game-config/src/legacy-page/gameplay-config.generated.js"
);

const durationMs = (durationTicksPerUnit: number): number =>
  Math.ceil(durationTicksPerUnit * FREE_MODE_COOLDOWN_MULTIPLIER) * FREE_MODE_TICK_RATE_MS;

const toLegacyRecipes = (
  recipes: Record<string, {
    label: string;
    outputResourceKey: string;
    outputAmount: number;
const boostTicksToMs = (ticks: number): number =>
  Math.max(0, Math.ceil(ticks) * FREE_MODE_TICK_RATE_MS);

    cleanCashCostPerUnit: number;
    inputCosts: Record<string, number>;
    durationTicksPerUnit: number;
    localOutputCap: number;
    queueCap: number;
  }>,
  inventory: "materials" | "drugs" | "weapons"
) => Object.fromEntries(Object.entries(recipes).map(([recipeId, recipe]) => [recipeId, {
  name: recipe.label,
  inputs: recipe.inputCosts,
  cleanMoneyCost: recipe.cleanCashCostPerUnit,
  output: {
    inventory,
    itemId: recipe.outputResourceKey,
    amount: recipe.outputAmount
  },
  durationMs: durationMs(recipe.durationTicksPerUnit),
  localOutputCap: recipe.localOutputCap,
  queueCap: recipe.queueCap
}]));

const factoryLegacyKeyByCanonical: Record<string, string> = {
  "metal-parts": "metalParts",
  "tech-core": "techCore",
  "combat-module": "combatModule"
};

const factoryRecipes = toLegacyRecipes(freeModeFactoryConfig.recipes, "materials");
const factorySlotDurationMs = Object.fromEntries(
  Object.entries(freeModeFactoryConfig.recipes).map(([recipeId, recipe]) => [
    factoryLegacyKeyByCanonical[recipeId],
    durationMs(recipe.durationTicksPerUnit)
  ])
);
const factorySlotStorageCaps = Object.fromEntries(
  Object.entries(freeModeFactoryConfig.recipes).map(([recipeId, recipe]) => [
    factoryLegacyKeyByCanonical[recipeId],
    recipe.localOutputCap
  ])
);

const generated = {
  generatedFrom: [
    "free-mode-pharmacy-config.ts",
    "free-mode-drug-lab-config.ts",
    "free-mode-factory-config.ts",
    "free-mode-armory-config.ts",
    "free-mode-warehouse-config.ts",
    "free-mode-attack-weapons-config.ts"
  ],
  pharmacyRecipes: toLegacyRecipes(freeModePharmacyConfig.recipes, "materials"),
  drugLabRecipes: toLegacyRecipes(freeModeDrugLabConfig.recipes, "drugs"),
  armoryRecipes: toLegacyRecipes(freeModeArmoryConfig.recipes, "weapons"),
  factoryRecipes,
  factory: {
    maxLevel: freeModeFactoryConfig.upgrade.maxLevel,
    upgradeBaseCost: freeModeFactoryConfig.upgrade.upgradeBaseCost,
    upgradeCostGrowth: freeModeFactoryConfig.upgrade.costGrowth,
    upgradeRoundCostTo: freeModeFactoryConfig.upgrade.roundCostTo,
    upgradePctPerLevel: freeModeFactoryConfig.upgrade.productionMultiplierPerLevel / 100,
    network: freeModeFactoryConfig.network,
    slotDurationMs: factorySlotDurationMs,
    recipes: factoryRecipes
  },
  factorySlotStorageCaps,
  factorySlots: Object.entries(freeModeFactoryConfig.recipes).map(([recipeId, recipe], index) => ({
    id: index + 1,
    recipeId,
    resourceKey: factoryLegacyKeyByCanonical[recipeId],
    canonicalResourceKey: recipe.outputResourceKey,
    label: recipe.label,
    mode: "produce"
  })),
  storage: {
    groups: freeModeWarehouseConfig.storageCapacityGroups,
    warehouseCountMultipliers: freeModeWarehouseConfig.warehouseCountMultipliers,
    warehouseLevelMultipliers: freeModeWarehouseConfig.warehouseLevelMultipliers
  },
  attackWeapons: Object.fromEntries(
    Object.entries(freeModeAttackWeaponsConfig).map(([resourceKey, weapon]) => [resourceKey, {
    "free-mode-player-boost-config.ts",
      label: weapon.label,
      description: weapon.description,
      power: weapon.baseAttackPower,
      residents: weapon.populationRequired
    }])
  )
};

const serialized = [
  "// GENERATED FILE. Run `npm run generate:browser-config`; do not edit balance values here.",
  `// Sources: ${generated.generatedFrom.join(", ")}.`,
  playerBoosts: Object.fromEntries(Object.entries(freeModePlayerBoostConfig).map(([boostId, boost]) => [boostId, {
    ...boost,
    durationMs: boostTicksToMs(boost.activeDurationTicks),
    cooldownMs: boostTicksToMs(boost.cooldownTicks)
  }])),
  `export const BROWSER_GAMEPLAY_CONFIG = Object.freeze(${JSON.stringify(generated, null, 2)});`,
  "",
  "export const PHARMACY_RECIPES = BROWSER_GAMEPLAY_CONFIG.pharmacyRecipes;",
  "export const DRUGLAB_RECIPES = BROWSER_GAMEPLAY_CONFIG.drugLabRecipes;",
  "export const ARMORY_RECIPES = BROWSER_GAMEPLAY_CONFIG.armoryRecipes;",
  "export const FACTORY_RECIPES = BROWSER_GAMEPLAY_CONFIG.factoryRecipes;",
  "export const FACTORY_CONFIG = BROWSER_GAMEPLAY_CONFIG.factory;",
  "export const FACTORY_SLOT_STORAGE_CAPS = BROWSER_GAMEPLAY_CONFIG.factorySlotStorageCaps;",
  "export const FACTORY_SLOT_CONFIG = BROWSER_GAMEPLAY_CONFIG.factorySlots;",
  "export const WAREHOUSE_STORAGE_CONFIG = BROWSER_GAMEPLAY_CONFIG.storage;",
  "export const ATTACK_SETUP_WEAPONS = BROWSER_GAMEPLAY_CONFIG.attackWeapons;",
  ""
].join("\n");

if (process.argv.includes("--check")) {
  const current = await readFile(outputPath, "utf8").catch(() => "");
  if (current !== serialized) {
    console.error("Browser gameplay config is stale. Run `npm run generate:browser-config`.");
    process.exitCode = 1;
  }
} else {
  await writeFile(outputPath, serialized, "utf8");
  console.log(`Generated ${outputPath.slice(rootDir.length + 1)}`);
}
  "export const PLAYER_BOOST_CONFIG = BROWSER_GAMEPLAY_CONFIG.playerBoosts;",
