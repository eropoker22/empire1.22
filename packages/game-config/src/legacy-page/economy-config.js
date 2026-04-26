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
  chemicals: { name: "Chemicals", output: { inventory: "materials", itemId: "chemicals", amount: 20 }, durationMs: 16_000 },
  biomass: { name: "Biomass", output: { inventory: "materials", itemId: "biomass", amount: 16 }, durationMs: 18_000 },
  "stim-pack": { name: "Stim Pack", output: { inventory: "materials", itemId: "stim-pack", amount: 8 }, durationMs: 24_000 }
};

export const FACTORY_CONFIG = Object.freeze({
  maxLevel: 14,
  baseProductionPerHour: Object.freeze({
    metalParts: 360,
    techCore: 200
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
  Object.freeze({ id: 3, resourceKey: "combatModule", label: "Combat Module", mode: "craft" })
]);

export const DRUGLAB_RECIPES = {
  "neon-dust": { name: "Neon Dust", inputs: { chemicals: 3, biomass: 2 }, output: { inventory: "drugs", itemId: "neon-dust", amount: 6 }, durationMs: 20_000 },
  "pulse-shot": { name: "Pulse Shot", inputs: { chemicals: 2, "stim-pack": 1 }, output: { inventory: "drugs", itemId: "pulse-shot", amount: 5 }, durationMs: 22_000 },
  "velvet-smoke": { name: "Velvet Smoke", inputs: { biomass: 3, chemicals: 1 }, output: { inventory: "drugs", itemId: "velvet-smoke", amount: 4 }, durationMs: 24_000 },
  "ghost-serum": { name: "Ghost Serum", inputs: { chemicals: 2, biomass: 1, "stim-pack": 2 }, output: { inventory: "drugs", itemId: "ghost-serum", amount: 3 }, durationMs: 28_000 },
  "overdrive-x": { name: "Overdrive X", inputs: { chemicals: 3, biomass: 2, "stim-pack": 3 }, output: { inventory: "drugs", itemId: "overdrive-x", amount: 2 }, durationMs: 34_000 }
};

export const ARMORY_RECIPES = {
  "baseball-bat": { name: "Baseballová pálka", inputs: { "metal-parts": 2 }, output: { inventory: "weapons", itemId: "baseball-bat", amount: 5 }, durationMs: 10_000 },
  pistol: { name: "Pistole", inputs: { "metal-parts": 3, "tech-core": 1 }, output: { inventory: "weapons", itemId: "pistol", amount: 4 }, durationMs: 18_000 },
  grenade: { name: "Granát", inputs: { "metal-parts": 2, "tech-core": 1 }, output: { inventory: "weapons", itemId: "grenade", amount: 3 }, durationMs: 20_000 },
  smg: { name: "SMG", inputs: { "metal-parts": 5, "tech-core": 2 }, output: { inventory: "weapons", itemId: "smg", amount: 2 }, durationMs: 26_000 },
  bazooka: { name: "Bazuka", inputs: { "metal-parts": 7, "tech-core": 3 }, output: { inventory: "weapons", itemId: "bazooka", amount: 1 }, durationMs: 34_000 },
  vest: { name: "Vesta", inputs: { "metal-parts": 3, "tech-core": 1 }, output: { inventory: "weapons", itemId: "vest", amount: 3 }, durationMs: 18_000 },
  barricades: { name: "Barikády", inputs: { "metal-parts": 4 }, output: { inventory: "weapons", itemId: "barricades", amount: 3 }, durationMs: 16_000 },
  cameras: { name: "Kamery", inputs: { "metal-parts": 2, "tech-core": 2 }, output: { inventory: "weapons", itemId: "cameras", amount: 2 }, durationMs: 22_000 },
  "defense-tower": { name: "Defense tower", inputs: { "metal-parts": 8, "tech-core": 3 }, output: { inventory: "weapons", itemId: "defense-tower", amount: 1 }, durationMs: 36_000 },
  alarm: { name: "Alarm", inputs: { "metal-parts": 2, "tech-core": 1 }, output: { inventory: "weapons", itemId: "alarm", amount: 3 }, durationMs: 18_000 }
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
      { inventory: "materials", itemId: "chemicals", name: "Chemicals", price: 360 },
      { inventory: "materials", itemId: "biomass", name: "Biomass", price: 320 },
      { inventory: "materials", itemId: "stim-pack", name: "Stim Pack", price: 780 },
      { inventory: "materials", itemId: "metal-parts", name: "Metal Parts", price: 540 },
      { inventory: "materials", itemId: "tech-core", name: "Tech Core", price: 980 }
    ]
  },
  "black-market": {
    label: "Black Market",
    copy: "Neonová síť překupníků pro dirty trade, drogy a citlivou výzbroj.",
    payment: "dirtyMoney",
    payout: "dirtyMoney",
    buyMultiplier: 1.32,
    sellMultiplier: 1.08,
    variance: 0.22,
    items: [
      { inventory: "drugs", itemId: "neon-dust", name: "Neon Dust", price: 2600 },
      { inventory: "drugs", itemId: "pulse-shot", name: "Pulse Shot", price: 3050 },
      { inventory: "drugs", itemId: "velvet-smoke", name: "Velvet Smoke", price: 3800 },
      { inventory: "drugs", itemId: "ghost-serum", name: "Ghost Serum", price: 5100 },
      { inventory: "drugs", itemId: "overdrive-x", name: "Overdrive X", price: 7200 },
      { inventory: "weapons", itemId: "pistol", name: "Pistole", price: 2500 },
      { inventory: "weapons", itemId: "smg", name: "SMG", price: 5600 },
      { inventory: "weapons", itemId: "bazooka", name: "Bazuka", price: 13200 }
    ]
  }
};

export const getMarketPriceKey = (tabId, itemId) => `${tabId}:${itemId}`;
