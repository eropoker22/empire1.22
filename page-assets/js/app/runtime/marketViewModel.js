import { getMarketPriceKey } from "../../../../packages/game-config/src/legacy-page/economy-config.js";

export function createMarketDashboardViewModel({
  activeTab = "market",
  tabLabel = "Market",
  stockSummary = "0 ks",
  economy = {},
  gangState = {},
  refreshCountdownSeconds = 0,
  recentTransactions = [],
  formatPrice = (value) => String(value)
} = {}) {
  const isDangerMode = activeTab === "black-market" || activeTab === "player-market";
  const safeRecentTransactions = Array.isArray(recentTransactions) ? recentTransactions : [];
  return {
    chips: [
      { label: "Režim", value: tabLabel, tone: activeTab === "black-market" ? "danger" : "stock" },
      { label: "Clean", value: formatPrice(economy.cleanMoney), tone: "clean" },
      { label: "Dirty", value: formatPrice(economy.dirtyMoney), tone: "dirty" },
      { label: "Heat", value: String(gangState.heat || 0), tone: isDangerMode ? "danger" : "neutral" },
      { label: "Refresh", value: `${Math.max(0, Math.floor(Number(refreshCountdownSeconds) || 0))} s`, tone: "timer" },
      { label: "Stock", value: stockSummary, tone: isDangerMode ? "danger" : "stock" }
    ],
    recentTransactions: safeRecentTransactions.slice(0, 1),
    allRecentTransactions: safeRecentTransactions
  };
}

export function createMarketCopy(activeTab = "market", tabConfig = {}) {
  const copy = String(tabConfig.copy || "");
  if (activeTab === "player-market") {
    return `${copy} Nabídky jsou uložené jen pro tento server, vlastní nabídku můžeš stáhnout a dirty platby zvyšují heat.`;
  }

  if (activeTab === "black-market") {
    return `${copy} Dirty cash platí přes dražší kanál, stock je dostupný, ale každý nákup zvedá heat. Ceny platí jen pro tento server.`;
  }

  return `${copy} Stock je omezený, nákup ho snižuje a prodej ho vrací do trhu. Ceny platí jen pro tento server.`;
}

export function createMarketItemViewModels({
  items = [],
  activeTab = "market",
  paymentKey = "cleanMoney",
  payoutKey = paymentKey,
  buyMultiplier = 1.15,
  sellMultiplier = 1,
  priceState = {},
  marketDiscount = {},
  getInventoryAmount = () => 0,
  getStockAmount = () => Number.POSITIVE_INFINITY,
  getMaxStock = () => Number.POSITIVE_INFINITY,
  getStockLabel = () => "Stock bez limitu",
  getStockPercent = () => 100,
  applyDiscountToPrice = (value) => value,
  formatPrice = (value) => String(value),
  getMoneyLabel = () => "clean cash"
} = {}) {
  const catalogItems = Array.isArray(items) ? items : [];
  const safeDiscount = {
    discountPct: Math.max(0, Number(marketDiscount.discountPct || 0) || 0),
    feeReductionPct: Math.max(0, Number(marketDiscount.feeReductionPct || 0) || 0)
  };

  return catalogItems.map((item = {}) => {
    const amount = getInventoryAmount(item.inventory, item.itemId);
    const priceEntry = priceState.items?.[getMarketPriceKey(activeTab, item.itemId)] || {
      price: item.price,
      previousPrice: item.price
    };
    const baseBuyPrice = Math.max(1, Math.round(Number(priceEntry.price || 0) * (Number(buyMultiplier || 0) || 1)));
    const buyPrice = applyDiscountToPrice(baseBuyPrice, marketDiscount);
    const sellPrice = Math.max(1, Math.round(Number(priceEntry.price || 0) * (Number(sellMultiplier || 0) || 1)));
    const delta = Number(priceEntry.price || 0) - Number(priceEntry.previousPrice || 0);
    const stockAmount = getStockAmount(priceState, activeTab, item.itemId);
    const maxStock = getMaxStock(activeTab, item.itemId);
    const hasLimitedStock = Number.isFinite(stockAmount);

    return {
      ...item,
      amount,
      activeTab,
      paymentKey,
      payoutKey,
      buyPrice,
      sellPrice,
      maxStock,
      hasLimitedStock,
      rowMode: activeTab === "black-market" ? "black" : "normal",
      resourceColor: item.itemId,
      metaLabel: `Máš ${amount} ks · ${getStockLabel(priceState, activeTab, item.itemId)} · platba ${getMoneyLabel(paymentKey)}`,
      priceLabel: safeDiscount.discountPct > 0
        ? `Základ ${formatPrice(baseBuyPrice)} · sleva OC -${safeDiscount.discountPct.toFixed(1)} % · nákup ${formatPrice(buyPrice)} · fee -${safeDiscount.feeReductionPct.toFixed(0)} % · výkup ${formatPrice(sellPrice)}`
        : `Nákup ${formatPrice(buyPrice)} · výkup ${formatPrice(sellPrice)}`,
      trendDirection: delta > 0 ? "up" : delta < 0 ? "down" : "flat",
      trendLabel: delta > 0
        ? `▲ +${formatPrice(delta)}`
        : delta < 0
          ? `▼ -${formatPrice(Math.abs(delta))}`
          : "• beze změny",
      stockPercent: getStockPercent(priceState, activeTab, item.itemId),
      stockLabel: getStockLabel(priceState, activeTab, item.itemId)
    };
  });
}

export function createPlayerMarketViewModel({
  listings = [],
  sellableItems = [],
  economy = {},
  sellerId = "player:self",
  ownListingLimit = 0,
  getListingTotal = () => 0,
  formatPrice = (value) => String(value)
} = {}) {
  const sortedListings = (Array.isArray(listings) ? listings : [])
    .slice()
    .sort((a, b) => {
      const ownDelta = Number(b?.sellerId === sellerId) - Number(a?.sellerId === sellerId);
      return ownDelta || Number(b?.createdAt || 0) - Number(a?.createdAt || 0);
    });
  const ownListingCount = sortedListings.filter((listing) => listing.sellerId === sellerId).length;

  return {
    listings: sortedListings.map((listing = {}) => {
      const isOwn = listing.sellerId === sellerId;
      const total = getListingTotal(listing);
      const availableMoney = Number(economy[listing.currency] || 0);
      const canBuy = !isOwn && availableMoney >= total;
      return {
        ...listing,
        isOwn,
        total,
        disabled: !canBuy,
        title: isOwn
          ? "Stáhnout nabídku a vrátit položku do skladu."
          : canBuy
            ? "Koupit nabídku od hráče na tomto serveru."
            : `Chybí ${formatPrice(total - availableMoney)}.`
      };
    }),
    sellableItems: Array.isArray(sellableItems) ? sellableItems : [],
    ownListingCount,
    ownListingLimit
  };
}

export function createMarketTradeStateViewModel({
  activeTab = "market",
  item = {},
  requestedQuantity = 1,
  currentEconomy = {},
  currentAmount = 0,
  latestStock = Number.POSITIVE_INFINITY,
  latestMaxStock = Number.POSITIVE_INFINITY,
  blackHeatRisk = null,
  formatPrice = (value) => String(value)
} = {}) {
  const quantity = Math.max(1, Math.floor(Number(requestedQuantity || 1)));
  const buyTotal = quantity * Math.max(1, Math.floor(Number(item.buyPrice || 1)));
  const sellTotal = quantity * Math.max(1, Math.floor(Number(item.sellPrice || 1)));
  const sellCapacity = Number.isFinite(latestMaxStock) ? Math.max(0, latestMaxStock - latestStock) : Number.POSITIVE_INFINITY;
  const availableMoney = Number(currentEconomy[item.paymentKey] || 0);
  const buyDisabled = availableMoney < buyTotal
    || (Number.isFinite(latestStock) && latestStock < quantity);
  const sellDisabled = Number(currentAmount || 0) < quantity
    || (Number.isFinite(sellCapacity) && sellCapacity < quantity);

  return {
    buyDisabled,
    sellDisabled,
    buyTitle: buyDisabled
      ? (Number.isFinite(latestStock) && latestStock < quantity
          ? "Market nemá dost stocku."
          : `Chybí ${formatPrice(buyTotal - availableMoney)}.`)
      : activeTab === "black-market" && blackHeatRisk
        ? `Black market risk: +${blackHeatRisk.heat} heat (${blackHeatRisk.label}).`
        : "Koupit z marketu.",
    sellTitle: sellDisabled
      ? (Number(currentAmount || 0) < quantity
          ? "Nemáš dost kusů ve skladu."
          : "Normal market je přesycený.")
      : "Prodat do marketu.",
    totalLabel: activeTab === "black-market" && blackHeatRisk
      ? `Celkem ${formatPrice(buyTotal)} · prodej ${formatPrice(sellTotal)} · +${blackHeatRisk.heat} heat`
      : `Celkem ${formatPrice(buyTotal)} · prodej ${formatPrice(sellTotal)}`
  };
}

export function getSuggestedPlayerMarketUnitPrice(item = {}, priceState = {}) {
  const sourceTab = item.inventory === "materials" ? "market" : "black-market";
  const priceEntry = priceState.items?.[getMarketPriceKey(sourceTab, item.itemId)];
  const basePrice = Math.max(1, Number(priceEntry?.price || item.price || 1));
  const peerMultiplier = item.inventory === "materials" ? 1.02 : 0.92;
  return Math.max(1, Math.round(basePrice * peerMultiplier));
}
