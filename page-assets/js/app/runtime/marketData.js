export const MARKET_TRANSACTION_LIMIT = 12;
export const MARKET_STOCK_DEFAULTS = Object.freeze({
  market: Object.freeze({
    chemicals: Object.freeze({ start: 700, max: 1100, regen: 28 }),
    biomass: Object.freeze({ start: 1000, max: 1600, regen: 45 }),
    "stim-pack": Object.freeze({ start: 180, max: 320, regen: 8 }),
    "metal-parts": Object.freeze({ start: 900, max: 1400, regen: 35 }),
    "tech-core": Object.freeze({ start: 260, max: 420, regen: 8 })
  })
});
export const MARKET_BLACK_HEAT_BY_VALUE = Object.freeze([
  Object.freeze({ min: 3500, heat: 10, label: "extrémní" }),
  Object.freeze({ min: 1800, heat: 6, label: "vysoké" }),
  Object.freeze({ min: 750, heat: 3, label: "střední" }),
  Object.freeze({ min: 1, heat: 1, label: "nízké" })
]);
export const MARKET_PLAYER_TAB_ID = "player-market";
export const MARKET_PLAYER_SELLER_ID = "player:self";
export const MARKET_PLAYER_LISTING_LIMIT = 18;
export const MARKET_PLAYER_OWN_LISTING_LIMIT = 4;
export const MARKET_PLAYER_LISTING_TTL_MS = 45 * 60 * 1000;
export const MARKET_PLAYER_TRADE_ITEMS = Object.freeze([
  Object.freeze({ inventory: "materials", itemId: "chemicals", category: "Materiál" }),
  Object.freeze({ inventory: "materials", itemId: "biomass", category: "Materiál" }),
  Object.freeze({ inventory: "materials", itemId: "stim-pack", category: "Materiál" }),
  Object.freeze({ inventory: "materials", itemId: "metal-parts", category: "Materiál" }),
  Object.freeze({ inventory: "materials", itemId: "tech-core", category: "Materiál" }),
  Object.freeze({ inventory: "drugs", itemId: "neon-dust", category: "Drogy" }),
  Object.freeze({ inventory: "drugs", itemId: "pulse-shot", category: "Drogy" }),
  Object.freeze({ inventory: "drugs", itemId: "velvet-smoke", category: "Drogy" }),
  Object.freeze({ inventory: "drugs", itemId: "ghost-serum", category: "Drogy" }),
  Object.freeze({ inventory: "drugs", itemId: "overdrive-x", category: "Drogy" }),
  Object.freeze({ inventory: "weapons", itemId: "pistol", category: "Výzbroj" }),
  Object.freeze({ inventory: "weapons", itemId: "smg", category: "Výzbroj" }),
  Object.freeze({ inventory: "weapons", itemId: "bazooka", category: "Výzbroj" })
]);
export const DEFAULT_MARKET_SERVER_ID = "preview-server";
