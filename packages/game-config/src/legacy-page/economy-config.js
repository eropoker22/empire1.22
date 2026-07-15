export const DEFAULT_WEAPON_INVENTORY = {
  "baseball-bat": 0,
  pistol: 0,
  grenade: 0,
  smg: 0,
  bazooka: 0,
  vest: 0,
  barricades: 0,
  cameras: 0,
  "defense-tower": 0,
  alarm: 0
};

export const DEFAULT_MATERIAL_INVENTORY = {
  chemicals: 0,
  biomass: 0,
  "stim-pack": 0
};

export const DEFAULT_DRUG_INVENTORY = {
  "neon-dust": 0,
  "pulse-shot": 0,
  "velvet-smoke": 0,
  "ghost-serum": 0,
  "overdrive-x": 0
};

export const MARKET_PRICE_REFRESH_MS = 45_000;

export const FACTORY_SLOT_STORAGE_CAP = Math.max(...Object.values(FACTORY_SLOT_STORAGE_CAPS));

export const FACTORY_RESOURCE_KEYS = Object.freeze(["metalParts", "techCore", "combatModule"]);

const MARKET_MATERIAL_IDS = new Set(["chemicals", "biomass", "metal-parts", "stim-pack", "tech-core", "combat-module"]);
const MARKET_DRUG_IDS = new Set(["neon-dust", "pulse-shot", "velvet-smoke", "ghost-serum", "overdrive-x"]);
const createBrowserMarketItems = (resourceIds) => resourceIds.map((itemId) => {
  const resource = MARKET_CONFIG.resources[itemId];
  return {
    inventory: MARKET_MATERIAL_IDS.has(itemId) ? "materials" : MARKET_DRUG_IDS.has(itemId) ? "drugs" : "weapons",
    itemId,
    name: resource.name,
    price: resource.basePrice
  };
});

export const MARKET_TAB_CONFIG = {
  market: {
    label: "Normal Market",
    copy: "Bezpečný městský kanál pro základní výrobní vstupy bez Heat risku.",
    payment: "cleanMoney",
    payout: "cleanMoney",
    buyMultiplier: 1.12,
    sellMultiplier: 0.92,
    variance: 0.08,
    items: createBrowserMarketItems(MARKET_CONFIG.normalMarketResourceIds)
  },
  "black-market": {
    label: "Black Market",
    copy: "Rotující síť překupníků pro vzácné komponenty, látky a výzbroj.",
    payment: "dirtyMoney",
    payout: "dirtyMoney",
    buyMultiplier: 1.32,
    sellMultiplier: 0.01,
    variance: 0.22,
    items: createBrowserMarketItems(MARKET_CONFIG.blackMarketResourceIds)
  },
  "player-market": {
    label: "Hráčský bazar",
    copy: "Nabídky hráčů používají escrow; položka zůstává blokovaná do prodeje, stažení nebo expirace.",
    payment: "cleanMoney",
    payout: "cleanMoney",
    buyMultiplier: 1,
    sellMultiplier: 1,
    variance: 0,
    items: []
  }
};

export const getMarketPriceKey = (tabId, itemId) => `${tabId}:${itemId}`;
import {
  ARMORY_RECIPES,
  DRUGLAB_RECIPES,
  FACTORY_CONFIG,
  FACTORY_RECIPES,
  FACTORY_SLOT_CONFIG,
  FACTORY_SLOT_STORAGE_CAPS,
  PHARMACY_RECIPES,
  PLAYER_BOOST_CONFIG,
  MARKET_CONFIG,
  STREET_DEALERS_CONFIG,
  SMUGGLING_TUNNEL_CONFIG,
  CONVENIENCE_STORE_CONFIG,
  STRIP_CLUB_CONFIG,
  PARK_DAY_NIGHT_ACTION_RULES,
  WAREHOUSE_STORAGE_CONFIG
} from "./gameplay-config.generated.js";

export {
  ARMORY_RECIPES,
  DRUGLAB_RECIPES,
  FACTORY_CONFIG,
  FACTORY_RECIPES,
  FACTORY_SLOT_CONFIG,
  FACTORY_SLOT_STORAGE_CAPS,
  PHARMACY_RECIPES,
  PLAYER_BOOST_CONFIG,
  MARKET_CONFIG,
  STREET_DEALERS_CONFIG,
  SMUGGLING_TUNNEL_CONFIG,
  CONVENIENCE_STORE_CONFIG,
  STRIP_CLUB_CONFIG,
  PARK_DAY_NIGHT_ACTION_RULES,
  WAREHOUSE_STORAGE_CONFIG
};
