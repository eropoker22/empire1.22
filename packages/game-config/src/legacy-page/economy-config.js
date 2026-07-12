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

export const PHARMACY_RECIPES = {
  chemicals: { name: "Chemicals", cleanMoneyCost: 360, output: { inventory: "materials", itemId: "chemicals", amount: 1 }, durationMs: 2 * 60 * 1000, localOutputCap: 12, queueCap: 8 },
  biomass: { name: "Biomass", cleanMoneyCost: 420, output: { inventory: "materials", itemId: "biomass", amount: 1 }, durationMs: 4 * 60 * 1000, localOutputCap: 8, queueCap: 6 },
  "stim-pack": { name: "Stim Pack", cleanMoneyCost: 800, output: { inventory: "materials", itemId: "stim-pack", amount: 1 }, durationMs: 10 * 60 * 1000, localOutputCap: 4, queueCap: 3 }
};

export const FACTORY_CONFIG = Object.freeze({
  maxLevel: 14,
  baseProductionPerHour: Object.freeze({
    metalParts: 15,
    techCore: 7.5
  }),
  slotDurationMs: Object.freeze({
    metalParts: 4 * 60 * 1000,
    techCore: 8 * 60 * 1000,
    combatModule: 15 * 60 * 1000
  }),
  upgradePctPerLevel: 0.1,
  combatModule: Object.freeze({
    metalPartsCost: 4,
    techCoreCost: 3,
    durationMs: 15 * 60 * 1000,
    heatPerUnit: 1
  })
});

export const FACTORY_SLOT_STORAGE_CAP = 20;
export const FACTORY_SLOT_STORAGE_CAPS = Object.freeze({
  metalParts: 20,
  techCore: 10,
  combatModule: 5
});

export const FACTORY_RESOURCE_KEYS = Object.freeze(["metalParts", "techCore", "combatModule"]);

export const FACTORY_COMBAT_BOOSTS = Object.freeze({
  assault: Object.freeze({
    id: "assault",
    label: "Assault",
    combatModuleCost: 2,
    durationMs: 2 * 60 * 60 * 1000,
    attackPowerPct: 30,
    heatAdded: 3
  }),
  rapid: Object.freeze({
    id: "rapid",
    label: "Rapid",
    combatModuleCost: 3,
    durationMs: 90 * 60 * 1000,
    attackSpeedPct: 40,
    raidSpeedPct: 25,
    defensePenaltyPct: 10,
    heatAdded: 4
  }),
  breach: Object.freeze({
    id: "breach",
    label: "Breach",
    combatModuleCost: 4,
    durationMs: 2 * 60 * 60 * 1000,
    destroyBuildingChancePct: 20,
    defenseIgnorePct: 15,
    policeInterventionRiskPct: 35,
    heatAdded: 5
  })
});

export const FACTORY_SLOT_CONFIG = Object.freeze([
  Object.freeze({ id: 1, resourceKey: "metalParts", label: "Metal Parts", mode: "produce" }),
  Object.freeze({ id: 2, resourceKey: "techCore", label: "Tech Core", mode: "produce" }),
  Object.freeze({ id: 3, resourceKey: "combatModule", label: "Bojový modul", mode: "craft" })
]);

export const DRUGLAB_RECIPES = {
  "neon-dust": { name: "Neon Dust", inputs: { chemicals: 2 }, cleanMoneyCost: 500, output: { inventory: "drugs", itemId: "neon-dust", amount: 1 }, durationMs: 5 * 60 * 1000, localOutputCap: 10, queueCap: 8 },
  "pulse-shot": { name: "Pulse Shot", inputs: { chemicals: 2, biomass: 1 }, cleanMoneyCost: 800, output: { inventory: "drugs", itemId: "pulse-shot", amount: 1 }, durationMs: 8 * 60 * 1000, localOutputCap: 6, queueCap: 5 },
  "velvet-smoke": { name: "Velvet Smoke", inputs: { chemicals: 1, biomass: 2 }, cleanMoneyCost: 900, output: { inventory: "drugs", itemId: "velvet-smoke", amount: 1 }, durationMs: 15 * 60 * 1000, localOutputCap: 5, queueCap: 4 },
  "ghost-serum": { name: "Ghost Serum", inputs: { "neon-dust": 2, "pulse-shot": 1 }, cleanMoneyCost: 2500, output: { inventory: "drugs", itemId: "ghost-serum", amount: 1 }, durationMs: 20 * 60 * 1000, localOutputCap: 2, queueCap: 2 },
  "overdrive-x": { name: "Overdrive X", inputs: { "pulse-shot": 1, "velvet-smoke": 2 }, cleanMoneyCost: 4500, output: { inventory: "drugs", itemId: "overdrive-x", amount: 1 }, durationMs: 30 * 60 * 1000, localOutputCap: 1, queueCap: 1 }
};

export const ARMORY_RECIPES = {
  "baseball-bat": { name: "Baseballová pálka", inputs: { "metal-parts": 2 }, output: { inventory: "weapons", itemId: "baseball-bat", amount: 1 }, durationMs: 3 * 60 * 1000 },
  pistol: { name: "Pistole", inputs: { "metal-parts": 3, "tech-core": 1 }, output: { inventory: "weapons", itemId: "pistol", amount: 1 }, durationMs: 5 * 60 * 1000 },
  grenade: { name: "Granát", inputs: { "metal-parts": 2, "tech-core": 1 }, output: { inventory: "weapons", itemId: "grenade", amount: 1 }, durationMs: 6 * 60 * 1000 },
  smg: { name: "SMG", inputs: { "metal-parts": 2, "combat-module": 1 }, output: { inventory: "weapons", itemId: "smg", amount: 1 }, durationMs: 8 * 60 * 1000 },
  bazooka: { name: "Bazuka", inputs: { "metal-parts": 3, "combat-module": 2 }, output: { inventory: "weapons", itemId: "bazooka", amount: 1 }, durationMs: 14 * 60 * 1000 },
  vest: { name: "Vesta", inputs: { "metal-parts": 3, "tech-core": 1 }, output: { inventory: "weapons", itemId: "vest", amount: 1 }, durationMs: 5 * 60 * 1000 },
  barricades: { name: "Barikády", inputs: { "metal-parts": 4 }, output: { inventory: "weapons", itemId: "barricades", amount: 1 }, durationMs: 5 * 60 * 1000 },
  cameras: { name: "Kamery", inputs: { "metal-parts": 2, "tech-core": 2 }, output: { inventory: "weapons", itemId: "cameras", amount: 1 }, durationMs: 6 * 60 * 1000 },
  "defense-tower": { name: "Obranná věž", inputs: { "tech-core": 3, "combat-module": 2 }, output: { inventory: "weapons", itemId: "defense-tower", amount: 1 }, durationMs: 15 * 60 * 1000 },
  alarm: { name: "Alarm", inputs: { "metal-parts": 2, "tech-core": 1 }, output: { inventory: "weapons", itemId: "alarm", amount: 1 }, durationMs: 5 * 60 * 1000 }
};

export const MARKET_TAB_CONFIG = {
  market: {
    label: "Normal Market",
    copy: "Legální bazar serveru pro rychlý nákup a výkup materiálu bez heat risku.",
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
    copy: "P2P bazar aktuálního serveru. Vystav vlastní stock, kupuj nabídky ostatních hráčů a sleduj obchodní tlak serveru.",
    payment: "cleanMoney",
    payout: "cleanMoney",
    buyMultiplier: 1,
    sellMultiplier: 1,
    variance: 0,
    items: []
  }
};

export const getMarketPriceKey = (tabId, itemId) => `${tabId}:${itemId}`;
