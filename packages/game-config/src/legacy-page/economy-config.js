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

export const MARKET_TAB_CONFIG = {
  market: {
    label: "Normal Market",
    copy: "Lokální demo bazar pro rychlý nákup a výkup materiálu bez heat risku.",
    payment: "cleanMoney",
    payout: "cleanMoney",
    buyMultiplier: 1.12,
    sellMultiplier: 0.92,
    variance: 0.08,
    items: [
      { inventory: "materials", itemId: "chemicals", name: "Chemicals", price: 500 },
      { inventory: "materials", itemId: "biomass", name: "Biomass", price: 560 },
      { inventory: "materials", itemId: "stim-pack", name: "Stim Pack", price: 1500 },
      { inventory: "materials", itemId: "metal-parts", name: "Metal Parts", price: 260 },
      { inventory: "materials", itemId: "tech-core", name: "Tech Core", price: 700 }
    ]
  },
  "black-market": {
    label: "Black Market",
    copy: "Neonová síť překupníků pro dirty trade, drogy a citlivou výzbroj.",
    payment: "dirtyMoney",
    payout: "dirtyMoney",
    buyMultiplier: 1.32,
    sellMultiplier: 0.01,
    variance: 0.22,
    items: [
      { inventory: "drugs", itemId: "neon-dust", name: "Neon Dust", price: 760 },
      { inventory: "drugs", itemId: "pulse-shot", name: "Pulse Shot", price: 980 },
      { inventory: "drugs", itemId: "velvet-smoke", name: "Velvet Smoke", price: 1100 },
      { inventory: "drugs", itemId: "ghost-serum", name: "Ghost Serum", price: 2200 },
      { inventory: "drugs", itemId: "overdrive-x", name: "Overdrive X", price: 4200 },
      { inventory: "weapons", itemId: "pistol", name: "Pistole", price: 1250 },
      { inventory: "weapons", itemId: "smg", name: "SMG", price: 3800 },
      { inventory: "weapons", itemId: "bazooka", name: "Bazuka", price: 11000 }
    ]
  },
  "player-market": {
    label: "Hráčský bazar",
    copy: "Demo nabídky tohoto prohlížeče. Skutečný serverový P2P market zatím není součástí veřejného buildu.",
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
  WAREHOUSE_STORAGE_CONFIG
};
