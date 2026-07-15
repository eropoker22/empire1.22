import { MARKET_CONFIG } from "../../../../packages/game-config/src/legacy-page/gameplay-config.generated.js";

export const MARKET_TRANSACTION_LIMIT = 12;
export const MARKET_STOCK_DEFAULTS = Object.freeze({
  market: Object.freeze(Object.fromEntries(MARKET_CONFIG.normalMarketResourceIds.map((resourceId) => {
    const resource = MARKET_CONFIG.resources[resourceId];
    return [resourceId, Object.freeze({
      start: resource.normalMarketStartStock,
      max: resource.normalMarketMaxStock,
      regen: MARKET_CONFIG.stockRegenPerMinute[resourceId]
    })];
  })))
});
export const MARKET_BLACK_HEAT_BY_VALUE = Object.freeze([
  Object.freeze({ min: MARKET_CONFIG.largeTransactionValueFree.extreme, heat: 10, label: "extrémní" }),
  Object.freeze({ min: MARKET_CONFIG.largeTransactionValueFree.high, heat: 6, label: "vysoké" }),
  Object.freeze({ min: MARKET_CONFIG.largeTransactionValueFree.medium, heat: 3, label: "střední" }),
  Object.freeze({ min: 1, heat: 1, label: "nízké" })
]);
export const MARKET_PLAYER_TAB_ID = "player-market";
export const MARKET_PLAYER_SELLER_ID = "player:self";
export const MARKET_PLAYER_LISTING_LIMIT = 18;
export const MARKET_PLAYER_OWN_LISTING_LIMIT = MARKET_CONFIG.playerMarket.listingLimitPerSeller;
export const MARKET_PLAYER_LISTING_TTL_MS = MARKET_CONFIG.playerMarket.listingTtlSecondsFree * 1000;

const MATERIAL_IDS = new Set(["chemicals", "biomass", "metal-parts", "stim-pack", "tech-core", "combat-module"]);
const DRUG_IDS = new Set(["neon-dust", "pulse-shot", "velvet-smoke", "ghost-serum", "overdrive-x"]);
const DEFENSE_IDS = new Set(["barricades", "vest", "cameras", "alarm", "defense-tower"]);
const COMPONENT_IDS = new Set(["combat-module", "ghost-serum", "overdrive-x"]);

export const MARKET_PLAYER_TRADE_ITEMS = Object.freeze(MARKET_CONFIG.playerMarketResourceIds.map((itemId) => Object.freeze({
  inventory: MATERIAL_IDS.has(itemId) ? "materials" : DRUG_IDS.has(itemId) ? "drugs" : "weapons",
  itemId,
  category: COMPONENT_IDS.has(itemId)
    ? "Komponenta"
    : DRUG_IDS.has(itemId)
      ? "Látka"
      : DEFENSE_IDS.has(itemId)
        ? "Obrana"
        : MATERIAL_IDS.has(itemId)
          ? "Materiál"
          : "Výzbroj"
})));
export const DEFAULT_MARKET_SERVER_ID = "preview-server";
