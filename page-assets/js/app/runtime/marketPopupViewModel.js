import {
  createMarketItemViewModels,
  createPlayerMarketViewModel
} from "./marketViewModel.js";
import { getMarketListingTotal } from "./marketActionOrchestrator.js";

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeFunction(fn, fallback) {
  return typeof fn === "function" ? fn : fallback;
}

export function createSellablePlayerMarketItems(catalog = [], options = {}) {
  const getInventoryAmount = safeFunction(options.getInventoryAmount, () => 0);
  return safeArray(catalog)
    .map((item = {}) => ({
      ...item,
      amount: getInventoryAmount(item.inventory, item.itemId)
    }))
    .filter((item) => item.amount > 0);
}

export function createPlayerMarketPanelPayload({
  priceState = {},
  serverScope = {},
  catalog = [],
  economy = {},
  sellerId = "player:self",
  tabState = {},
  ownListingLimit = 0,
  normalizeMarketTradeState = (state) => state || {},
  normalizePlayerMarketListings = (listings) => safeArray(listings),
  getInventoryAmount = () => 0,
  getListingTotal = getMarketListingTotal,
  formatPrice = (value) => String(value)
} = {}) {
  const marketState = normalizeMarketTradeState(priceState);
  const sellableItems = createSellablePlayerMarketItems(catalog, { getInventoryAmount });
  const viewModel = createPlayerMarketViewModel({
    listings: normalizePlayerMarketListings(marketState.playerListings, serverScope.serverId),
    sellableItems,
    economy,
    emptyMessage: tabState.emptyMessage,
    isAuthoritative: tabState.isAuthoritative,
    isFallback: tabState.isFallback,
    isPreview: tabState.isPreview,
    sellerId,
    ownListingLimit,
    getListingTotal,
    formatPrice
  });

  return { marketState, sellableItems, viewModel };
}

export function createMarketCatalogPanelPayload({
  tabConfig = {},
  activeTab = "market",
  paymentKey = "cleanMoney",
  payoutKey = paymentKey,
  priceState = {},
  marketDiscount = {},
  getInventoryAmount = () => 0,
  getStockAmount = () => Number.POSITIVE_INFINITY,
  getMaxStock = () => Number.POSITIVE_INFINITY,
  getStockLabel = () => "Stock bez limitu",
  getStockPercent = () => 100,
  applyDiscountToPrice = (value) => value,
  formatPrice = (value) => String(value),
  getMoneyLabel = () => "clean cash",
  tabState = {}
} = {}) {
  const safeTabConfig = tabConfig && typeof tabConfig === "object" ? tabConfig : {};
  return {
    emptyMessage: tabState.emptyMessage,
    isAuthoritative: tabState.isAuthoritative,
    isFallback: tabState.isFallback,
    isPreview: tabState.isPreview,
    source: tabState.source,
    status: tabState.status,
    items: createMarketItemViewModels({
      items: safeArray(safeTabConfig.items),
      activeTab,
      paymentKey,
      payoutKey,
      buyMultiplier: safeTabConfig.buyMultiplier || 1.15,
      sellMultiplier: safeTabConfig.sellMultiplier || 1,
      priceState,
      marketDiscount,
      getInventoryAmount,
      getStockAmount,
      getMaxStock,
      getStockLabel,
      getStockPercent,
      applyDiscountToPrice,
      formatPrice,
      getMoneyLabel
    })
  };
}
