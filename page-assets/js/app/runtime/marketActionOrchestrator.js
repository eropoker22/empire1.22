const noop = () => {};

function safeFunction(fn, fallback = noop) {
  return typeof fn === "function" ? fn : fallback;
}

function safeObject(value) {
  return value && typeof value === "object" ? value : {};
}

function safeQuantity(value, fallback = 1) {
  return Math.max(1, Math.floor(Number(value || fallback) || fallback));
}

function createId(prefix, now, random) {
  return `${prefix}-${now()}-${random().toString(36).slice(2, 8)}`;
}

export function createMarketTransaction({
  type = "buy",
  tabId = "market",
  item = {},
  amount = 1,
  total = 0,
  moneyKey = "cleanMoney"
} = {}, options = {}) {
  const now = safeFunction(options.now, Date.now);
  const random = safeFunction(options.random, Math.random);
  const createdAt = now();
  return {
    id: createId("market-tx", () => createdAt, random),
    type,
    tabId,
    itemId: item.itemId,
    itemName: item.name,
    amount,
    total,
    moneyKey,
    createdAt
  };
}

export function getMarketListingTotal(listing = {}) {
  return safeQuantity(listing.amount) * safeQuantity(listing.unitPrice);
}

export function createPlayerMarketCallbacks(deps = {}) {
  const getSuggestedPlayerMarketUnitPrice = safeFunction(deps.getSuggestedPlayerMarketUnitPrice, () => 1);
  const setMarketFeedback = safeFunction(deps.setMarketFeedback);
  const setInventoryAmount = safeFunction(deps.setInventoryAmount);
  const getInventoryAmount = safeFunction(deps.getInventoryAmount, () => 0);
  const getCurrentPlayerIdentityLabel = safeFunction(deps.getCurrentPlayerIdentityLabel, () => "Hráč");
  const commitMarketState = safeFunction(deps.commitMarketState);
  const normalizePlayerMarketListings = safeFunction(deps.normalizePlayerMarketListings, (listings) => Array.isArray(listings) ? listings : []);
  const normalizeMarketTransactions = safeFunction(deps.normalizeMarketTransactions, (transactions) => Array.isArray(transactions) ? transactions : []);
  const createTransaction = safeFunction(deps.createTransaction, createMarketTransaction);
  const formatMarketPrice = safeFunction(deps.formatMarketPrice, (value) => `${Math.max(0, Math.floor(Number(value) || 0))}$`);
  const applyTopbarEconomy = safeFunction(deps.applyTopbarEconomy);
  const refreshMarketTab = safeFunction(deps.refreshMarketTab);
  const getResolvedEconomyState = safeFunction(deps.getResolvedEconomyState, () => ({}));
  const setStoredEconomyState = safeFunction(deps.setStoredEconomyState);
  const resolveBlackMarketHeatRisk = safeFunction(deps.resolveBlackMarketHeatRisk, () => null);
  const addGangHeat = safeFunction(deps.addGangHeat);
  const getListingTotal = safeFunction(deps.getListingTotal, getMarketListingTotal);
  const playerMarketViewModel = safeObject(deps.playerMarketViewModel);
  const serverScope = safeObject(deps.serverScope);
  const now = safeFunction(deps.now, Date.now);
  const random = safeFunction(deps.random, Math.random);
  const sellerId = deps.sellerId || "player:self";
  const playerTabId = deps.playerTabId || "player-market";
  const ownListingLimit = Math.max(0, Math.floor(Number(deps.ownListingLimit || 0) || 0));
  const listingLimit = Math.max(1, Math.floor(Number(deps.listingLimit || 1) || 1));
  const listingTtlMs = Math.max(1000, Math.floor(Number(deps.listingTtlMs || 1000) || 1000));

  return {
    getSuggestedUnitPrice: (item) => getSuggestedPlayerMarketUnitPrice(item, deps.priceState),
    onCreateListing: ({ item, requestedAmount, unitPrice, currency } = {}) => {
      if (!item) {
        setMarketFeedback("warning", "Nemáš žádnou položku, kterou můžeš vystavit.");
        return;
      }
      if (Number(playerMarketViewModel.ownListingCount || 0) >= ownListingLimit) {
        setMarketFeedback("warning", "Nejdřív stáhni některou vlastní nabídku.");
        return;
      }

      setInventoryAmount(item.inventory, item.itemId, item.amount - requestedAmount);

      const createdAt = now();
      const listing = {
        id: `player-market:${serverScope.serverId}:${createdAt}:${random().toString(36).slice(2, 8)}`,
        sellerId,
        sellerName: getCurrentPlayerIdentityLabel(),
        inventory: item.inventory,
        itemId: item.itemId,
        itemName: item.name,
        category: item.category,
        amount: requestedAmount,
        unitPrice,
        currency,
        createdAt,
        expiresAt: createdAt + listingTtlMs,
        isDemo: false
      };

      commitMarketState((state) => ({
        ...state,
        playerListings: [
          listing,
          ...normalizePlayerMarketListings(state.playerListings, serverScope.serverId)
        ].slice(0, listingLimit),
        transactions: [
          createTransaction({
            type: "sell",
            tabId: playerTabId,
            item,
            amount: requestedAmount,
            total: requestedAmount * unitPrice,
            moneyKey: currency
          }),
          ...normalizeMarketTransactions(state.transactions)
        ]
      }));

      setMarketFeedback("success", `Vystaveno ${requestedAmount}x ${item.name} za ${formatMarketPrice(unitPrice)} / kus.`);
      applyTopbarEconomy(deps.root);
      refreshMarketTab();
    },
    onCancelListing: (listing = {}) => {
      setInventoryAmount(listing.inventory, listing.itemId, getInventoryAmount(listing.inventory, listing.itemId) + listing.amount);
      commitMarketState((state) => ({
        ...state,
        playerListings: normalizePlayerMarketListings(state.playerListings, serverScope.serverId)
          .filter((entry) => entry.id !== listing.id)
      }));
      setMarketFeedback("success", `Nabídka ${listing.itemName} stažena zpět do skladu.`);
      refreshMarketTab();
    },
    onBuyListing: (listing = {}) => {
      const total = getListingTotal(listing);
      const currentEconomy = getResolvedEconomyState();
      if ((currentEconomy[listing.currency] || 0) < total) {
        setMarketFeedback("warning", `Na nákup chybí ${formatMarketPrice(total - (currentEconomy[listing.currency] || 0))}.`);
        refreshMarketTab();
        return;
      }

      setStoredEconomyState({
        ...currentEconomy,
        [listing.currency]: Math.max(0, (currentEconomy[listing.currency] || 0) - total)
      });
      setInventoryAmount(listing.inventory, listing.itemId, getInventoryAmount(listing.inventory, listing.itemId) + listing.amount);

      const heatRisk = listing.currency === "dirtyMoney" ? resolveBlackMarketHeatRisk(total) : null;
      if (heatRisk) {
        addGangHeat(deps.root, Math.max(1, Math.ceil(heatRisk.heat * 0.35)), `Hráčský bazar: ${listing.itemName}`);
      }

      commitMarketState((state) => ({
        ...state,
        playerListings: normalizePlayerMarketListings(state.playerListings, serverScope.serverId)
          .filter((entry) => entry.id !== listing.id),
        transactions: [
          createTransaction({
            type: "buy",
            tabId: playerTabId,
            item: { itemId: listing.itemId, name: listing.itemName },
            amount: listing.amount,
            total,
            moneyKey: listing.currency
          }),
          ...normalizeMarketTransactions(state.transactions)
        ]
      }));

      setMarketFeedback(
        listing.currency === "dirtyMoney" ? "danger" : "success",
        listing.currency === "dirtyMoney"
          ? `Koupeno ${listing.amount}x ${listing.itemName}. Dirty trade přidal heat.`
          : `Koupeno ${listing.amount}x ${listing.itemName} z hráčského bazaru.`
      );
      applyTopbarEconomy(deps.root);
      refreshMarketTab();
    }
  };
}

export function createMarketCatalogCallbacks(deps = {}) {
  const activeTab = deps.activeTab || "market";
  const getResolvedEconomyState = safeFunction(deps.getResolvedEconomyState, () => ({}));
  const getInventoryAmount = safeFunction(deps.getInventoryAmount, () => 0);
  const getResolvedMarketPriceState = safeFunction(deps.getResolvedMarketPriceState, () => ({}));
  const getStockAmount = safeFunction(deps.getStockAmount, () => Number.POSITIVE_INFINITY);
  const getMaxStock = safeFunction(deps.getMaxStock, () => Number.POSITIVE_INFINITY);
  const resolveBlackMarketHeatRisk = safeFunction(deps.resolveBlackMarketHeatRisk, () => null);
  const createMarketTradeStateViewModel = safeFunction(deps.createMarketTradeStateViewModel, () => ({}));
  const formatMarketPrice = safeFunction(deps.formatMarketPrice, (value) => `${Math.max(0, Math.floor(Number(value) || 0))}$`);
  const setMarketFeedback = safeFunction(deps.setMarketFeedback);
  const setInventoryAmount = safeFunction(deps.setInventoryAmount);
  const setStoredEconomyState = safeFunction(deps.setStoredEconomyState);
  const addGangHeat = safeFunction(deps.addGangHeat);
  const commitMarketState = safeFunction(deps.commitMarketState);
  const normalizeMarketStockState = safeFunction(deps.normalizeMarketStockState, (stock) => ({ ...safeObject(stock) }));
  const getMarketStockKey = safeFunction(deps.getMarketStockKey, (tabId, itemId) => `${tabId}:${itemId}`);
  const clamp = safeFunction(deps.clamp, (value, min, max) => Math.min(Math.max(value, min), max));
  const createTransaction = safeFunction(deps.createTransaction, createMarketTransaction);
  const normalizeMarketTransactions = safeFunction(deps.normalizeMarketTransactions, (transactions) => Array.isArray(transactions) ? transactions : []);
  const applyTopbarEconomy = safeFunction(deps.applyTopbarEconomy);
  const refreshMarketTab = safeFunction(deps.refreshMarketTab);

  return {
    getTradeState: (item, requestedQuantity) => {
      const currentEconomy = getResolvedEconomyState();
      const currentAmount = getInventoryAmount(item.inventory, item.itemId);
      const latestMarketState = getResolvedMarketPriceState();
      const latestStock = getStockAmount(latestMarketState, activeTab, item.itemId);
      const latestMaxStock = getMaxStock(activeTab, item.itemId);
      const buyTotal = requestedQuantity * item.buyPrice;
      const blackHeatRisk = activeTab === "black-market" ? resolveBlackMarketHeatRisk(buyTotal) : null;
      return createMarketTradeStateViewModel({
        activeTab,
        item,
        requestedQuantity,
        currentEconomy,
        currentAmount,
        latestStock,
        latestMaxStock,
        blackHeatRisk,
        formatPrice: formatMarketPrice
      });
    },
    onBuyItem: (item = {}, requestedQuantity = 1, updateRowTradeState = noop) => {
      const currentEconomy = getResolvedEconomyState();
      const buyTotal = requestedQuantity * item.buyPrice;
      const latestMarketState = getResolvedMarketPriceState();
      const latestStock = getStockAmount(latestMarketState, activeTab, item.itemId);

      if ((currentEconomy[item.paymentKey] || 0) < buyTotal) {
        setMarketFeedback("warning", `Na nákup chybí ${formatMarketPrice(buyTotal - (currentEconomy[item.paymentKey] || 0))}.`);
        updateRowTradeState();
        return;
      }

      if (Number.isFinite(latestStock) && latestStock < requestedQuantity) {
        setMarketFeedback("warning", `Kontakt má jen ${latestStock} ks ${item.name}. Zkus menší množství nebo černý trh.`);
        updateRowTradeState();
        return;
      }

      setInventoryAmount(item.inventory, item.itemId, getInventoryAmount(item.inventory, item.itemId) + requestedQuantity);
      setStoredEconomyState({
        ...currentEconomy,
        [item.paymentKey]: Math.max(0, (currentEconomy[item.paymentKey] || 0) - buyTotal)
      });

      const heatRisk = activeTab === "black-market" ? resolveBlackMarketHeatRisk(buyTotal) : null;
      if (heatRisk?.heat > 0) {
        addGangHeat(deps.root, heatRisk.heat, `Černý trh nákup: ${item.name}`);
      }

      commitMarketState((marketState) => {
        const nextStock = normalizeMarketStockState(marketState.stock);
        const stockKey = getMarketStockKey(activeTab, item.itemId);
        if (item.hasLimitedStock) {
          nextStock[stockKey] = Math.max(0, (nextStock[stockKey] || 0) - requestedQuantity);
        }
        return {
          ...marketState,
          stock: nextStock,
          transactions: [
            createTransaction({
              type: "buy",
              tabId: activeTab,
              item,
              amount: requestedQuantity,
              total: buyTotal,
              moneyKey: item.paymentKey
            }),
            ...normalizeMarketTransactions(marketState.transactions)
          ]
        };
      });

      setMarketFeedback(
        activeTab === "black-market" ? "danger" : "success",
        activeTab === "black-market"
          ? `Kontakt předal ${requestedQuantity}x ${item.name} za ${formatMarketPrice(buyTotal)}. Heat +${heatRisk?.heat || 0}.`
          : `Koupeno ${requestedQuantity}x ${item.name} za ${formatMarketPrice(buyTotal)}.`
      );
      applyTopbarEconomy(deps.root);
      refreshMarketTab();
    },
    onSellItem: (item = {}, requestedQuantity = 1, updateRowTradeState = noop) => {
      const currentAmount = getInventoryAmount(item.inventory, item.itemId);
      const latestMarketState = getResolvedMarketPriceState();
      const latestStock = getStockAmount(latestMarketState, activeTab, item.itemId);
      const latestMaxStock = getMaxStock(activeTab, item.itemId);
      const sellCapacity = Number.isFinite(latestMaxStock) ? Math.max(0, latestMaxStock - latestStock) : Number.POSITIVE_INFINITY;

      if (currentAmount < requestedQuantity) {
        setMarketFeedback("warning", `Ve skladu máš jen ${currentAmount} ks ${item.name}.`);
        updateRowTradeState();
        return;
      }

      if (Number.isFinite(sellCapacity) && sellCapacity < requestedQuantity) {
        setMarketFeedback("warning", `Trh přijme už jen ${sellCapacity} ks ${item.name}.`);
        updateRowTradeState();
        return;
      }

      const sellTotal = requestedQuantity * item.sellPrice;
      setInventoryAmount(item.inventory, item.itemId, currentAmount - requestedQuantity);
      const economy = getResolvedEconomyState();
      const nextEconomy = {
        ...economy,
        [item.payoutKey]: (economy[item.payoutKey] || 0) + sellTotal
      };
      setStoredEconomyState(nextEconomy);

      commitMarketState((marketState) => {
        const nextStock = normalizeMarketStockState(marketState.stock);
        const stockKey = getMarketStockKey(activeTab, item.itemId);
        if (item.hasLimitedStock) {
          nextStock[stockKey] = clamp(
            (nextStock[stockKey] || 0) + requestedQuantity,
            0,
            item.maxStock
          );
        }
        return {
          ...marketState,
          stock: nextStock,
          transactions: [
            createTransaction({
              type: "sell",
              tabId: activeTab,
              item,
              amount: requestedQuantity,
              total: sellTotal,
              moneyKey: item.payoutKey
            }),
            ...normalizeMarketTransactions(marketState.transactions)
          ]
        };
      });

      setMarketFeedback(
        activeTab === "black-market" ? "danger" : "success",
        activeTab === "black-market"
          ? `Kontakt převzal ${requestedQuantity}x ${item.name} za ${formatMarketPrice(sellTotal)}. Podsvětí kupuje levně.`
          : `Prodáno ${requestedQuantity}x ${item.name} za ${formatMarketPrice(sellTotal)}.`
      );
      applyTopbarEconomy(deps.root);
      refreshMarketTab();
    }
  };
}
