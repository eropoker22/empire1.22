function safeObject(value) {
  return value && typeof value === "object" ? value : {};
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeFunction(fn, fallback) {
  return typeof fn === "function" ? fn : fallback;
}

function safeFloor(value, fallback = 0) {
  const numeric = Number(value);
  return Math.floor(Number.isFinite(numeric) ? numeric : fallback);
}

export function getMarketTabLabel(tabId, tabConfig = {}) {
  return String(tabConfig?.[tabId]?.label || "Market");
}

export function getMarketStockAmount(marketState = {}, tabId = "market", itemId = "", options = {}) {
  const getMarketStockConfig = safeFunction(options.getMarketStockConfig, () => null);
  const normalizeMarketStockState = safeFunction(options.normalizeMarketStockState, (stock) => safeObject(stock));
  const getMarketStockKey = safeFunction(options.getMarketStockKey, (currentTabId, currentItemId) => `${currentTabId}:${currentItemId}`);
  const stockConfig = getMarketStockConfig(tabId, itemId);

  if (!stockConfig) {
    return Number.POSITIVE_INFINITY;
  }

  const stock = normalizeMarketStockState(safeObject(marketState).stock);
  return stock[getMarketStockKey(tabId, itemId)] ?? Math.max(0, safeFloor(stockConfig.start));
}

export function getMarketMaxStock(tabId = "market", itemId = "", options = {}) {
  const getMarketStockConfig = safeFunction(options.getMarketStockConfig, () => null);
  const stockConfig = getMarketStockConfig(tabId, itemId);
  return stockConfig
    ? Math.max(0, safeFloor(stockConfig.max || stockConfig.start))
    : Number.POSITIVE_INFINITY;
}

export function getMarketStockLabel(marketState = {}, tabId = "market", itemId = "", options = {}) {
  const stockAmount = getMarketStockAmount(marketState, tabId, itemId, options);
  if (!Number.isFinite(stockAmount)) {
    return "Stock bez limitu";
  }

  return `Stock ${stockAmount}/${getMarketMaxStock(tabId, itemId, options)} ks`;
}

export function getMarketStockPercent(marketState = {}, tabId = "market", itemId = "", options = {}) {
  const clamp = safeFunction(options.clamp, (value, min, max) => Math.min(Math.max(value, min), max));
  const stockAmount = getMarketStockAmount(marketState, tabId, itemId, options);
  const maxStock = getMarketMaxStock(tabId, itemId, options);

  if (!Number.isFinite(stockAmount) || !Number.isFinite(maxStock) || maxStock <= 0) {
    return 100;
  }

  return clamp(Math.round((stockAmount / maxStock) * 100), 0, 100);
}

export function getMarketDashboardStockSummary({
  activeTab = "market",
  marketState = {},
  tabConfig = {},
  serverId = "",
  playerTabId = "player-market",
  normalizePlayerMarketListings = (listings) => safeArray(listings),
  getStockAmount = getMarketStockAmount
} = {}) {
  if (activeTab === playerTabId) {
    return `${normalizePlayerMarketListings(safeObject(marketState).playerListings, serverId).length} nabídek`;
  }

  if (activeTab === "black-market") {
    return "neomezeně";
  }

  const items = safeArray(tabConfig.items);
  return `${items.reduce((total, item = {}) => total + getStockAmount(marketState, activeTab, item.itemId), 0)} ks`;
}

function normalizeDashboardTransactions(marketState = {}, normalizeMarketTransactions = (transactions) => safeArray(transactions)) {
  const state = safeObject(marketState);
  const localTransactions = normalizeMarketTransactions(state.transactions);
  if (localTransactions.length > 0 || !Array.isArray(state.recentTransactions)) {
    return localTransactions;
  }

  return state.recentTransactions
    .filter((transaction) => transaction && typeof transaction === "object")
    .map((transaction, index) => ({
      id: String(transaction.id || transaction.transactionId || `server-market-tx-${index}`),
      type: transaction.type === "sell" || transaction.transactionType === "sell" ? "sell" : "buy",
      tabId: transaction.marketType === "black" ? "black-market" : transaction.marketType === "player" ? "player-market" : "market",
      itemId: String(transaction.itemId || transaction.resourceId || ""),
      itemName: String(transaction.itemName || transaction.resourceId || transaction.itemId || "Položka"),
      amount: Math.max(1, safeFloor(transaction.amount, 1)),
      total: Math.max(0, safeFloor(transaction.total ?? transaction.totalPrice, 0)),
      moneyKey: transaction.paymentType === "dirtyCash" ? "dirtyMoney" : "cleanMoney",
      createdAt: Math.max(0, safeFloor(transaction.createdAt ?? transaction.timestamp, Date.now()))
    }))
    .filter((transaction) => transaction.itemId);
}

export function createMarketDashboardAdapter({
  activeTab = "market",
  marketState = {},
  marketTabConfig = {},
  economy = {},
  gangState = {},
  serverScope = {},
  playerTabId = "player-market",
  refreshAtCityTime = "--:--",
  normalizePlayerMarketListings = (listings) => safeArray(listings),
  normalizeMarketTransactions = (transactions) => safeArray(transactions),
  getStockAmount = getMarketStockAmount,
  formatPrice = (value) => String(value)
} = {}) {
  const tabConfig = marketTabConfig[activeTab] || marketTabConfig.market || {};
  return {
    activeTab,
    tabLabel: getMarketTabLabel(activeTab, marketTabConfig),
    stockSummary: getMarketDashboardStockSummary({
      activeTab,
      marketState,
      tabConfig,
      serverId: serverScope.serverId,
      playerTabId,
      normalizePlayerMarketListings,
      getStockAmount
    }),
    economy,
    gangState,
    refreshAtCityTime,
    recentTransactions: normalizeDashboardTransactions(marketState, normalizeMarketTransactions),
    formatPrice
  };
}

export function resolveMarketHeatRiskByValue(totalValue = 0, heatTable = []) {
  const table = safeArray(heatTable);
  const safeValue = Math.max(0, safeFloor(totalValue));
  return table.find((entry) => safeValue >= Number(entry?.min || 0)) || table[table.length - 1] || null;
}
