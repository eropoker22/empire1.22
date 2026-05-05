import {
  MARKET_PRICE_REFRESH_MS,
  MARKET_TAB_CONFIG,
  getMarketPriceKey
} from "../../../../packages/game-config/src/legacy-page/economy-config.js";
import { MARKET_PLAYER_DEMO_SELLERS } from "../dev/demoScenarios.js";
import {
  DEFAULT_MARKET_SERVER_ID,
  MARKET_PLAYER_LISTING_LIMIT,
  MARKET_PLAYER_LISTING_TTL_MS,
  MARKET_PLAYER_SELLER_ID,
  MARKET_PLAYER_TRADE_ITEMS,
  MARKET_STOCK_DEFAULTS,
  MARKET_TRANSACTION_LIMIT
} from "./marketData.js";
import { clamp, createSeededRandom } from "./utils.js";

export function normalizeMarketServerId(serverId) {
  const normalizedServerId = String(serverId || "").trim();
  return normalizedServerId || DEFAULT_MARKET_SERVER_ID;
}

export function getMarketServerScope(session = {}) {
  const registration = session?.registration || {};
  const serverId = normalizeMarketServerId(registration.serverId);
  const serverLabel = String(registration.serverLabel || registration.serverId || "Preview server").trim() || "Preview server";
  return { serverId, serverLabel };
}

export function isMarketPriceStatePayload(payload) {
  return Boolean(payload?.items && payload?.nextRefreshAt);
}

export function withMarketServerId(payload, serverId) {
  return {
    ...payload,
    serverId: normalizeMarketServerId(payload?.serverId || serverId)
  };
}

export function getMarketStockConfig(tabId, itemId) {
  return MARKET_STOCK_DEFAULTS[tabId]?.[itemId] || null;
}

export function getMarketStockKey(tabId, itemId) {
  return getMarketPriceKey(tabId, itemId);
}

export function getMarketCatalogItem(inventoryName, itemId) {
  for (const tabConfig of Object.values(MARKET_TAB_CONFIG)) {
    const item = tabConfig.items.find((candidate) => candidate.inventory === inventoryName && candidate.itemId === itemId);
    if (item) {
      return item;
    }
  }
  return null;
}

export function getPlayerMarketCatalog() {
  return MARKET_PLAYER_TRADE_ITEMS.map((item) => {
    const catalogItem = getMarketCatalogItem(item.inventory, item.itemId);
    return {
      ...item,
      name: catalogItem?.name || item.itemId,
      price: Math.max(1, Math.floor(Number(catalogItem?.price || 100)))
    };
  });
}

export function getPlayerMarketCatalogItem(inventoryName, itemId) {
  return getPlayerMarketCatalog().find((item) => item.inventory === inventoryName && item.itemId === itemId) || null;
}

export function getRuntimePlayerMarketItemId(entry = {}) {
  const rawItemId = String(entry.itemId || "").trim();
  if (rawItemId) {
    return rawItemId;
  }

  const resourceId = String(entry.resourceId || "").trim();
  const resourceAlias = {
    metalParts: "metal-parts",
    techCore: "tech-core",
    chemicals: "chemicals",
    biomass: "biomass"
  };
  return resourceAlias[resourceId] || resourceId;
}

export function hashMarketString(value) {
  let hash = 2166136261;
  for (const character of String(value || "")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createDefaultPlayerMarketListings(serverId = DEFAULT_MARKET_SERVER_ID, now = Date.now()) {
  const normalizedServerId = normalizeMarketServerId(serverId);
  const random = createSeededRandom(hashMarketString(`player-market:${normalizedServerId}`));
  const catalog = getPlayerMarketCatalog();
  const listings = [];
  const listingCount = Math.min(MARKET_PLAYER_LISTING_LIMIT - 4, 10);

  for (let index = 0; index < listingCount; index += 1) {
    const item = catalog[Math.floor(random() * catalog.length)] || catalog[0];
    const seller = MARKET_PLAYER_DEMO_SELLERS[index % MARKET_PLAYER_DEMO_SELLERS.length];
    const amountBase = item.inventory === "materials" ? 8 : item.inventory === "drugs" ? 3 : 1;
    const amountSpread = item.inventory === "materials" ? 30 : item.inventory === "drugs" ? 9 : 3;
    const amount = Math.max(1, Math.floor(amountBase + random() * amountSpread));
    const priceVariance = 0.82 + random() * 0.58;
    const unitPrice = Math.max(1, Math.round(item.price * priceVariance));
    const currency = item.inventory === "drugs" || (item.inventory === "weapons" && random() > 0.5)
      ? "dirtyMoney"
      : "cleanMoney";

    listings.push({
      id: `demo-player-market:${normalizedServerId}:${index}:${item.itemId}`,
      sellerId: seller.id,
      sellerName: seller.name,
      inventory: item.inventory,
      itemId: item.itemId,
      itemName: item.name,
      category: item.category,
      amount,
      unitPrice,
      currency,
      createdAt: now - Math.floor(random() * 12 * 60 * 1000),
      expiresAt: now + MARKET_PLAYER_LISTING_TTL_MS + Math.floor(random() * 18 * 60 * 1000),
      isDemo: true
    });
  }

  return listings;
}

export function normalizePlayerMarketListings(listings = [], serverId = DEFAULT_MARKET_SERVER_ID, now = Date.now()) {
  const source = Array.isArray(listings) ? listings : createDefaultPlayerMarketListings(serverId, now);

  return source
    .filter((entry) => entry && typeof entry === "object")
    .map((entry, index) => {
      const itemId = getRuntimePlayerMarketItemId(entry);
      const inventory = String(entry.inventory || "materials");
      const catalogItem = getPlayerMarketCatalogItem(inventory, itemId) || getPlayerMarketCatalog().find((item) => item.itemId === itemId);
      const createdAt = Math.max(0, Number(entry.createdAt || now) || now);
      const expiresAt = Math.max(createdAt + 1000, Number(entry.expiresAt || createdAt + MARKET_PLAYER_LISTING_TTL_MS) || createdAt + MARKET_PLAYER_LISTING_TTL_MS);
      return {
        id: String(entry.id || `player-market-${normalizeMarketServerId(serverId)}-${createdAt}-${index}`),
        sellerId: String(entry.sellerId || entry.sellerPlayerId || "").trim() || `seller:${index}`,
        sellerName: String(entry.sellerName || entry.seller || "Hráč").trim() || "Hráč",
        inventory: catalogItem?.inventory || inventory,
        itemId: catalogItem?.itemId || itemId,
        itemName: String(entry.itemName || catalogItem?.name || entry.itemId || "Položka"),
        category: String(entry.category || catalogItem?.category || "Trade"),
        amount: Math.max(1, Math.floor(Number(entry.amount || 1))),
        unitPrice: Math.max(1, Math.floor(Number(entry.unitPrice || entry.price || catalogItem?.price || 1))),
        currency: entry.currency === "dirtyMoney" || entry.paymentType === "dirtyCash" ? "dirtyMoney" : "cleanMoney",
        createdAt,
        expiresAt,
        isDemo: Boolean(entry.isDemo),
        isOwn: String(entry.sellerId || entry.sellerPlayerId || "") === MARKET_PLAYER_SELLER_ID
      };
    })
    .filter((entry) => entry.itemId && entry.expiresAt > now)
    .slice(0, MARKET_PLAYER_LISTING_LIMIT);
}

export function createDefaultMarketStockState() {
  const stock = {};

  for (const [tabId, tabConfig] of Object.entries(MARKET_TAB_CONFIG)) {
    for (const item of tabConfig.items) {
      const stockConfig = getMarketStockConfig(tabId, item.itemId);
      if (stockConfig) {
        stock[getMarketStockKey(tabId, item.itemId)] = Math.max(0, Math.floor(Number(stockConfig.start || 0)));
      }
    }
  }

  return stock;
}

export function normalizeMarketStockState(stockPayload = {}) {
  const defaults = createDefaultMarketStockState();
  const nextStock = { ...defaults };

  for (const [tabId, tabConfig] of Object.entries(MARKET_TAB_CONFIG)) {
    for (const item of tabConfig.items) {
      const stockConfig = getMarketStockConfig(tabId, item.itemId);
      if (!stockConfig) {
        continue;
      }

      const stockKey = getMarketStockKey(tabId, item.itemId);
      const maxStock = Math.max(0, Math.floor(Number(stockConfig.max || stockConfig.start || 0)));
      const rawStock = Number(stockPayload?.[stockKey] ?? defaults[stockKey] ?? 0);
      nextStock[stockKey] = clamp(Math.floor(Number.isFinite(rawStock) ? rawStock : 0), 0, maxStock);
    }
  }

  return nextStock;
}

export function normalizeMarketTransactions(transactions = [], now = Date.now()) {
  return (Array.isArray(transactions) ? transactions : [])
    .filter((entry) => entry && typeof entry === "object")
    .map((entry, index) => ({
      id: String(entry.id || `market-tx-${now}-${index}`),
      type: entry.type === "sell" ? "sell" : "buy",
      tabId: MARKET_TAB_CONFIG[entry.tabId] ? entry.tabId : "market",
      itemId: String(entry.itemId || ""),
      itemName: String(entry.itemName || entry.itemId || "Položka"),
      amount: Math.max(1, Math.floor(Number(entry.amount || 1))),
      total: Math.max(0, Math.floor(Number(entry.total || 0))),
      moneyKey: entry.moneyKey === "dirtyMoney" ? "dirtyMoney" : "cleanMoney",
      createdAt: Math.max(0, Number(entry.createdAt || now) || now)
    }))
    .filter((entry) => entry.itemId)
    .slice(0, MARKET_TRANSACTION_LIMIT);
}

export function createDefaultMarketPriceState(serverId = DEFAULT_MARKET_SERVER_ID, now = Date.now()) {
  const items = {};
  const normalizedServerId = normalizeMarketServerId(serverId);

  for (const [tabId, tabConfig] of Object.entries(MARKET_TAB_CONFIG)) {
    for (const item of tabConfig.items) {
      items[getMarketPriceKey(tabId, item.itemId)] = {
        price: item.price,
        previousPrice: item.price
      };
    }
  }

  return {
    serverId: normalizedServerId,
    nextRefreshAt: new Date(now + MARKET_PRICE_REFRESH_MS).toISOString(),
    items,
    stock: createDefaultMarketStockState(),
    transactions: [],
    playerListings: createDefaultPlayerMarketListings(normalizedServerId, now)
  };
}

export function normalizeMarketTradeState(state, options = {}) {
  const defaultServerId = normalizeMarketServerId(options.defaultServerId || state?.serverId);
  const fallback = createDefaultMarketPriceState(state?.serverId || defaultServerId);
  const serverId = normalizeMarketServerId(state?.serverId || fallback.serverId);
  return {
    ...fallback,
    ...(state || {}),
    serverId,
    items: state?.items && typeof state.items === "object" ? state.items : fallback.items,
    stock: normalizeMarketStockState(state?.stock || fallback.stock),
    transactions: normalizeMarketTransactions(state?.transactions),
    playerListings: normalizePlayerMarketListings(
      Array.isArray(state?.playerListings)
        ? state.playerListings
        : fallback.playerListings || createDefaultPlayerMarketListings(serverId),
      serverId
    )
  };
}

if (typeof window !== "undefined") {
  window.EmpireMarketState = {
    createDefaultMarketPriceState,
    createDefaultMarketStockState,
    createDefaultPlayerMarketListings,
    getMarketCatalogItem,
    getMarketServerScope,
    getMarketStockConfig,
    getMarketStockKey,
    getPlayerMarketCatalog,
    hashMarketString,
    isMarketPriceStatePayload,
    normalizeMarketServerId,
    normalizeMarketStockState,
    normalizeMarketTradeState,
    normalizeMarketTransactions,
    normalizePlayerMarketListings,
    withMarketServerId
  };
}
