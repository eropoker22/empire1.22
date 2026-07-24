import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { freeModeArmoryConfig } from "../packages/game-config/src/modes/free/free-mode-armory-config";
import { freeModeDrugLabConfig } from "../packages/game-config/src/modes/free/free-mode-drug-lab-config";
import { freeModeFactoryConfig } from "../packages/game-config/src/modes/free/free-mode-factory-config";
import { freeModePharmacyConfig } from "../packages/game-config/src/modes/free/free-mode-pharmacy-config";
import { freeModePlayerBoostConfig } from "../packages/game-config/src/modes/free/free-mode-player-boost-config";
import { freeModeCityEventConfig } from "../packages/game-config/src/modes/free/free-mode-city-event-config";
import {
  FREE_MODE_COOLDOWN_MULTIPLIER,
  FREE_MODE_TICK_RATE_MS
} from "../packages/game-config/src/modes/free/free-mode-timing";
import { freeModeAttackWeaponsConfig } from "../packages/game-config/src/public/free-mode-attack-weapons-config";
import { freeModeWarehouseConfig } from "../packages/game-config/src/public/free-mode-warehouse-config";
import { freeModeStreetDealersConfig } from "../packages/game-config/src/public/free-mode-street-dealers-config";
import { freeModeSmugglingTunnelConfig } from "../packages/game-config/src/public/free-mode-smuggling-tunnel-config";
import { freeModeConvenienceStoreConfig } from "../packages/game-config/src/public/free-mode-convenience-store-config";
import { freeModeStripClubConfig } from "../packages/game-config/src/public/free-mode-strip-club-config";
import { dayNightActionRules } from "../packages/game-config/src/public/day-night-action-rules";
import {
  blackMarketResourceIds,
  marketConfig,
  normalMarketResourceIds,
  playerMarketResourceIds
} from "../packages/game-core/src/rules/market/market-config";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = resolve(
  rootDir,
  "packages/game-config/src/legacy-page/gameplay-config.generated.js"
);

const durationMs = (durationTicksPerUnit: number): number =>
  Math.ceil(durationTicksPerUnit * FREE_MODE_COOLDOWN_MULTIPLIER) * FREE_MODE_TICK_RATE_MS;

const boostTicksToMs = (ticks: number): number =>
  Math.max(0, Math.ceil(ticks) * FREE_MODE_TICK_RATE_MS);

const toLegacyRecipes = (
  recipes: Record<string, {
    label: string;
    outputResourceKey: string;
    outputAmount: number;
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

const smugglingTunnelBrowserConfig = {
  countOnMap: freeModeSmugglingTunnelConfig.countOnMap,
  cleanCashPerMinute: freeModeSmugglingTunnelConfig.cleanCashPerMinute,
  dirtyCashPerMinute: freeModeSmugglingTunnelConfig.dirtyCashPerMinute,
  heatPerMinute: freeModeSmugglingTunnelConfig.heatPerMinute,
  dirtyProductionBonusPctPerExtraTunnel: freeModeSmugglingTunnelConfig.network.dirtyProductionBonusPctPerExtraTunnel,
  heatBonusPctPerExtraTunnel: freeModeSmugglingTunnelConfig.network.heatBonusPctPerExtraTunnel,
  maxDirtyProductionMultiplier: freeModeSmugglingTunnelConfig.network.maxDirtyProductionMultiplier,
  maxHeatMultiplier: freeModeSmugglingTunnelConfig.network.maxHeatMultiplier,
  dealerSupplyBonusPctPerTunnel: freeModeSmugglingTunnelConfig.dealerSupply.bonusPctPerTunnel,
  dealerSupplyMaxBonusPct: freeModeSmugglingTunnelConfig.dealerSupply.maxBonusPct,
  dealerSupplySalePriceSharePct: freeModeSmugglingTunnelConfig.dealerSupply.salePriceSharePct,
  dealerSupplySaleSpeedSharePct: freeModeSmugglingTunnelConfig.dealerSupply.saleSpeedSharePct,
  dealerSupplyStreetRiskReductionSharePct: freeModeSmugglingTunnelConfig.dealerSupply.streetRiskReductionSharePct,
  dealerSupplyPassiveDirtyIncomeSharePct: freeModeSmugglingTunnelConfig.dealerSupply.passiveDirtyIncomeSharePct,
  dealerSupplySaleHeatRiskSharePct: freeModeSmugglingTunnelConfig.dealerSupply.saleHeatRiskSharePct,
  openChannelCleanCost: freeModeSmugglingTunnelConfig.openChannel.costCleanCash,
  openChannelHeatGain: freeModeSmugglingTunnelConfig.openChannel.heatGain,
  openChannelDurationMs: freeModeSmugglingTunnelConfig.openChannel.durationMinutes * 60_000,
  openChannelCooldownMs: freeModeSmugglingTunnelConfig.openChannel.cooldownMinutes * 60_000,
  openChannelTunnelDirtyProductionBonusPct: freeModeSmugglingTunnelConfig.openChannel.tunnelDirtyProductionBonusPct,
  openChannelDealerSalePriceBonusPct: freeModeSmugglingTunnelConfig.openChannel.dealerSalePriceBonusPct,
  openChannelDealerSaleSpeedBonusPct: freeModeSmugglingTunnelConfig.openChannel.dealerSaleSpeedBonusPct,
  openChannelDealerCompletionRewardBonusPct: freeModeSmugglingTunnelConfig.openChannel.dealerCompletionRewardBonusPct,
  openChannelDealerSaleHeatBonusPct: freeModeSmugglingTunnelConfig.openChannel.dealerSaleHeatBonusPct,
  openChannelStreetIncidentFlatRiskPct: freeModeSmugglingTunnelConfig.openChannel.streetIncidentFlatRiskPct
};

const generated = {
  generatedFrom: [
    "free-mode-pharmacy-config.ts",
    "free-mode-drug-lab-config.ts",
    "free-mode-factory-config.ts",
    "free-mode-armory-config.ts",
    "free-mode-player-boost-config.ts",
    "free-mode-city-event-config.ts",
    "free-mode-warehouse-config.ts",
    "free-mode-attack-weapons-config.ts",
    "free-mode-street-dealers-config.ts",
    "free-mode-smuggling-tunnel-config.ts",
    "free-mode-convenience-store-config.ts",
    "free-mode-strip-club-config.ts",
    "day-night-action-rules.ts",
    "market-config.ts"
  ],
  pharmacyRecipes: toLegacyRecipes(freeModePharmacyConfig.recipes, "materials"),
  drugLabRecipes: toLegacyRecipes(freeModeDrugLabConfig.recipes, "drugs"),
  armoryRecipes: toLegacyRecipes(freeModeArmoryConfig.recipes, "weapons"),
  playerBoosts: Object.fromEntries(Object.entries(freeModePlayerBoostConfig).map(([boostId, boost]) => [boostId, {
    ...boost,
    durationMs: boostTicksToMs(boost.activeDurationTicks),
    cooldownMs: boostTicksToMs(boost.cooldownTicks)
  }])),
  cityEvents: {
    agents: freeModeCityEventConfig.agents,
    difficultyBudgets: freeModeCityEventConfig.difficultyBudgets,
    maxActiveRunsPerPlayer: freeModeCityEventConfig.maxActiveRunsPerPlayer,
    maxStrategicOffersPerCityDay: freeModeCityEventConfig.maxStrategicOffersPerCityDay,
    tickRateMs: FREE_MODE_TICK_RATE_MS,
    definitions: freeModeCityEventConfig.definitions.map((definition) => ({
      ...definition,
      durationMs: definition.durationMinutes * 60_000,
      durationTicks: Math.ceil(definition.durationMinutes * 60_000 / FREE_MODE_TICK_RATE_MS)
    }))
  },
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
  market: {
    resources: marketConfig.resources,
    normalMarketResourceIds,
    blackMarketResourceIds,
    playerMarketResourceIds,
    blackMarket: marketConfig.blackMarket,
    playerMarket: marketConfig.playerMarket,
    stockRegenPerMinute: marketConfig.stockRegenPerMinute,
    largeTransactionValueFree: marketConfig.largeTransactionValueFree
  },
  park: {
    streetDealers: freeModeStreetDealersConfig,
    smugglingTunnel: smugglingTunnelBrowserConfig,
    convenienceStore: freeModeConvenienceStoreConfig,
    stripClub: freeModeStripClubConfig,
    dayNightActionRules: {
      startDrugSale: dayNightActionRules.start_drug_sale,
      openChannel: dayNightActionRules.open_channel
    }
  },
  attackWeapons: Object.fromEntries(
    Object.entries(freeModeAttackWeaponsConfig).map(([resourceKey, weapon]) => [resourceKey, {
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
  `export const BROWSER_GAMEPLAY_CONFIG = Object.freeze(${JSON.stringify(generated, null, 2)});`,
  "",
  "export const PHARMACY_RECIPES = BROWSER_GAMEPLAY_CONFIG.pharmacyRecipes;",
  "export const DRUGLAB_RECIPES = BROWSER_GAMEPLAY_CONFIG.drugLabRecipes;",
  "export const ARMORY_RECIPES = BROWSER_GAMEPLAY_CONFIG.armoryRecipes;",
  "export const PLAYER_BOOST_CONFIG = BROWSER_GAMEPLAY_CONFIG.playerBoosts;",
  "export const CITY_EVENT_CONFIG = BROWSER_GAMEPLAY_CONFIG.cityEvents;",
  "export const FACTORY_RECIPES = BROWSER_GAMEPLAY_CONFIG.factoryRecipes;",
  "export const FACTORY_CONFIG = BROWSER_GAMEPLAY_CONFIG.factory;",
  "export const FACTORY_SLOT_STORAGE_CAPS = BROWSER_GAMEPLAY_CONFIG.factorySlotStorageCaps;",
  "export const FACTORY_SLOT_CONFIG = BROWSER_GAMEPLAY_CONFIG.factorySlots;",
  "export const WAREHOUSE_STORAGE_CONFIG = BROWSER_GAMEPLAY_CONFIG.storage;",
  "export const MARKET_CONFIG = BROWSER_GAMEPLAY_CONFIG.market;",
  "export const ATTACK_SETUP_WEAPONS = BROWSER_GAMEPLAY_CONFIG.attackWeapons;",
  "export const STREET_DEALERS_CONFIG = BROWSER_GAMEPLAY_CONFIG.park.streetDealers;",
  "export const SMUGGLING_TUNNEL_CONFIG = BROWSER_GAMEPLAY_CONFIG.park.smugglingTunnel;",
  "export const CONVENIENCE_STORE_CONFIG = BROWSER_GAMEPLAY_CONFIG.park.convenienceStore;",
  "export const STRIP_CLUB_CONFIG = BROWSER_GAMEPLAY_CONFIG.park.stripClub;",
  "export const PARK_DAY_NIGHT_ACTION_RULES = BROWSER_GAMEPLAY_CONFIG.park.dayNightActionRules;",
  ""
].join("\n");

if (process.argv.includes("--check")) {
  const current = await readFile(outputPath, "utf8").catch(() => "");
  if (current.replace(/\r\n?/g, "\n") !== serialized) {
    console.error("Browser gameplay config is stale. Run `npm run generate:browser-config`.");
    process.exitCode = 1;
  }
} else {
  await writeFile(outputPath, serialized, "utf8");
  console.log(`Generated ${outputPath.slice(rootDir.length + 1)}`);
}
