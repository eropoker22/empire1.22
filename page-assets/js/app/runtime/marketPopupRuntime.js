import { createMarketDataSourceSnapshot } from "./marketDataSource.js";
import {
  GAMEPLAY_EXECUTION_MODES,
  getGameplayExecutionMode
} from "./gameplayExecutionMode.js";
import {
  createMarketItemAtmosphere,
  createMarketTabStateViewModel
} from "./marketViewModel.js";
import {
  createServerPlayerMarketCallbacks,
  createServerPlayerMarketPanelPayload
} from "./marketServerPlayerViewModel.js";

function queryAll(root, selector) {
  return selector ? Array.from(root?.querySelectorAll?.(selector) || []) : [];
}

const MARKET_RESOURCE_ALIASES = Object.freeze({
  metalParts: "metal-parts",
  techCore: "tech-core",
  chemicals: "chemicals",
  biomass: "biomass"
});

function normalizeServerResources(serverMarket) {
  return Array.isArray(serverMarket?.resources) ? serverMarket.resources : [];
}

function resolvePlayerStorageAvailableAmount(playerView = {}, ...resourceKeys) {
  const accepted = new Set(resourceKeys.map((key) => String(key || "")).filter(Boolean));
  const items = (playerView?.storage?.groups || []).flatMap((group) => group?.items || []);
  const item = items.find((entry) => accepted.has(String(entry?.resourceKey || "")));
  if (!item) return Number.POSITIVE_INFINITY;
  return Math.max(0, Number(item.maxAmount || 0) - Number(item.currentAmount || 0));
}

function createServerMarketCatalogPanelPayload({
  activeTab = "market",
  serverMarket = {},
  playerView = {},
  cityMarketOfferIds = [],
  formatPrice = (value) => String(value)
} = {}) {
  const isBlackMarket = activeTab === "black-market";
  const allowedCityMarketOffers = new Set(Array.isArray(cityMarketOfferIds) ? cityMarketOfferIds : []);
  const balances = playerView?.resourceBalances || playerView?.economy?.resources || {};
  const resources = normalizeServerResources(serverMarket).filter((resource = {}) => {
    const marketView = isBlackMarket ? resource.blackMarket : resource.normalMarket;
    return marketView?.available === true
      && (isBlackMarket || allowedCityMarketOffers.size === 0 || allowedCityMarketOffers.has(String(resource.id || "")));
  }).sort((left, right) => {
    const leftMarket = isBlackMarket ? left?.blackMarket : left?.normalMarket;
    const rightMarket = isBlackMarket ? right?.blackMarket : right?.normalMarket;
    const leftIndex = Number(leftMarket?.offerIndex);
    const rightIndex = Number(rightMarket?.offerIndex);
    return (Number.isFinite(leftIndex) && leftIndex >= 0 ? leftIndex : Number.MAX_SAFE_INTEGER)
      - (Number.isFinite(rightIndex) && rightIndex >= 0 ? rightIndex : Number.MAX_SAFE_INTEGER);
  });
  return {
    items: resources.map((resource = {}) => {
      const resourceId = String(resource.id || "");
      const legacyItemId = MARKET_RESOURCE_ALIASES[resourceId] || resourceId;
      const normalMarket = resource.normalMarket || {};
      const blackMarket = resource.blackMarket || {};
      const marketView = isBlackMarket ? blackMarket : normalMarket;
      const cleanBuyPrice = Math.max(1, Math.floor(Number(marketView.price || 1)));
      const dirtyBuyPrice = isBlackMarket
        ? Math.max(cleanBuyPrice, Math.floor(Number(marketView.dirtyCashPrice || cleanBuyPrice)))
        : cleanBuyPrice;
      const buyPrice = isBlackMarket ? dirtyBuyPrice : cleanBuyPrice;
      const sellPrice = Math.max(1, Math.floor(Number(normalMarket.sellPrice || 1)));
      const stock = Number(normalMarket.stock);
      const maxStock = Number(normalMarket.maxStock);
      const safeStock = Number.isFinite(stock) ? Math.max(0, Math.floor(stock)) : 0;
      const safeMaxStock = Number.isFinite(maxStock)
        ? Math.max(0, Math.floor(maxStock))
        : Number.POSITIVE_INFINITY;
      const stockPercent = Number(normalMarket.stockPercent);
      const amount = Math.max(0, Math.floor(Number(
        balances[resourceId] ?? balances[legacyItemId] ?? 0
      ) || 0));
      const blackMarketHeatRisk = Math.max(0, Math.floor(Number(blackMarket.heatRisk || 0) || 0));
      const visibleHeatRisk = isBlackMarket ? blackMarketHeatRisk : 0;
      const cleanCash = Math.max(0, Number(playerView?.economy?.cleanCash || balances.cash || 0) || 0);
      const dirtyCash = Math.max(0, Number(playerView?.economy?.dirtyCash || balances["dirty-cash"] || 0) || 0);
      const storageAvailableAmount = resolvePlayerStorageAvailableAmount(playerView, resourceId, legacyItemId);
      const canBuyBlackClean = Boolean(blackMarket.canBuyWithCleanCash ?? cleanCash >= cleanBuyPrice);
      const trendDirection = resource.trend === "up" || resource.trend === "spike"
        ? "up"
        : resource.trend === "down"
          ? "down"
          : "flat";
      const rowAtmosphere = createMarketItemAtmosphere({
        item: {
          inventory: "materials",
          canSell: !isBlackMarket && Boolean(normalMarket.canSell),
          itemId: legacyItemId,
          resourceId
        },
        activeTab,
        trendDirection,
        stockPercent: Number.isFinite(stockPercent) ? stockPercent : 100,
        heatRisk: visibleHeatRisk
      });

      return {
        ...rowAtmosphere,
        inventory: "materials",
        itemId: legacyItemId,
        resourceId,
        name: resource.name || resourceId,
        amount,
        activeTab,
        paymentKey: isBlackMarket ? "dirtyMoney" : "cleanMoney",
        payoutKey: "cleanMoney",
        buyPrice,
        cleanBuyPrice,
        dirtyBuyPrice,
        sellPrice,
        stock: safeStock,
        maxStock: safeMaxStock,
        hasLimitedStock: !isBlackMarket,
        rowMode: isBlackMarket ? "black" : "normal",
        resourceColor: legacyItemId,
        serverAuthoritative: true,
        canBuy: isBlackMarket ? Boolean(blackMarket.canBuyWithDirtyCash) : Boolean(normalMarket.canBuy),
        canBuyClean: isBlackMarket ? canBuyBlackClean : Boolean(normalMarket.canBuy),
        playerCleanCash: cleanCash,
        playerDirtyCash: dirtyCash,
        storageAvailableAmount,
        canBuyDirty: Boolean(blackMarket.canBuyWithDirtyCash),
        showCleanBuyAction: isBlackMarket,
        canSell: !isBlackMarket && Boolean(normalMarket.canSell),
        heatRisk: visibleHeatRisk,
        heatByValue: isBlackMarket && Array.isArray(serverMarket?.blackMarket?.heatByValue)
          ? serverMarket.blackMarket.heatByValue
          : [],
        metaLabel: `Máš ${amount} ks · ${isBlackMarket ? "kontakt dostupný" : `sklad ${safeStock}/${Number.isFinite(safeMaxStock) ? safeMaxStock : 0}`} · živá cena`,
        priceLabel: isBlackMarket
          ? `Dirty ${formatPrice(dirtyBuyPrice)} · clean ${formatPrice(cleanBuyPrice)}${visibleHeatRisk ? ` · heat +${visibleHeatRisk}` : ""}`
          : `Nákup ${formatPrice(buyPrice)} · výkup ${formatPrice(sellPrice)}`,
        trendDirection,
        trendLabel: resource.trend === "spike"
          ? "▲ spike"
          : resource.trend === "up"
            ? "▲ růst"
            : resource.trend === "down"
              ? "▼ pokles"
              : "• stabilní",
        stockPercent: Number.isFinite(stockPercent) ? stockPercent : 100,
        stockLabel: isBlackMarket
          ? "Černý trh nemá veřejný sklad."
          : `Stock ${safeStock}/${Number.isFinite(safeMaxStock) ? safeMaxStock : 0}`
      };
    })
  };
}

export function createMarketPopupRuntime(deps = {}) {
  const selectors = deps.selectors || {};
  const windowRef = deps.windowRef || (typeof window !== "undefined" ? window : null);
  const documentRef = deps.documentRef || (typeof document !== "undefined" ? document : null);
  const resolveGameplayExecutionMode = deps.getGameplayExecutionMode || getGameplayExecutionMode;
  let marketPriceTimerId = null;

  const bindMarketPopup = (root) => {
    const executionMode = resolveGameplayExecutionMode({ windowRef });
    if (executionMode === GAMEPLAY_EXECUTION_MODES.unavailable) {
      return false;
    }
    const openButton = root?.querySelector?.(selectors.open);
    const popup = root?.querySelector?.(selectors.popup);
    const closeElements = queryAll(root, selectors.close);
    const tabs = queryAll(root, selectors.tab);
    const copyElement = root?.querySelector?.(selectors.copy);
    const listElement = root?.querySelector?.(selectors.list);
    const serverBadgeElement = root?.querySelector?.(selectors.serverBadge);
    const titleElement = root?.querySelector?.(selectors.title || "[data-market-title]");
    const dashboardElement = root?.querySelector?.(selectors.dashboard);
    const feedbackElement = root?.querySelector?.(selectors.feedback);

    if (!openButton || !popup || closeElements.length === 0 || !copyElement || !listElement || tabs.length === 0) {
      return false;
    }

    let activeTab = "market";
    let hideServerRecentTransactions = false;
    let playerMarketFormState = null;

    const stockAdapterOptions = {
      clamp: deps.clamp,
      getMarketStockConfig: deps.getMarketStockConfig,
      getMarketStockKey: deps.getMarketStockKey,
      normalizeMarketStockState: deps.normalizeMarketStockState
    };
    const getStockAmount = (marketState, tabId, itemId) => deps.getMarketStockAmount?.(marketState, tabId, itemId, stockAdapterOptions);
    const getMaxStock = (tabId, itemId) => deps.getMarketMaxStock?.(tabId, itemId, stockAdapterOptions);
    const getStockLabel = (marketState, tabId, itemId) => deps.getMarketStockLabel?.(marketState, tabId, itemId, stockAdapterOptions);
    const getStockPercent = (marketState, tabId, itemId) => deps.getMarketStockPercent?.(marketState, tabId, itemId, stockAdapterOptions);
    const resolveBlackMarketHeatRisk = (totalValue) => deps.resolveMarketHeatRiskByValue?.(totalValue, deps.MARKET_BLACK_HEAT_BY_VALUE);
    const setMarketFeedback = (tone, message) => {
      deps.renderMarketFeedback?.(feedbackElement, tone, message);
    };
    const getMarketTitle = () => {
      if (activeTab === deps.MARKET_PLAYER_TAB_ID) {
        return "Hráčský bazar";
      }

      if (activeTab === "black-market") {
        return "Černý trh";
      }

      return "Městský market";
    };
    const commitMarketState = (updater) => {
      const currentState = deps.refreshMarketPricesIfNeeded?.(false);
      const nextState = deps.normalizeMarketTradeState?.(updater(currentState));
      deps.setStoredMarketPriceState?.(nextState);
      return nextState;
    };
    const clearRecentTransactions = () => {
      if (executionMode !== GAMEPLAY_EXECUTION_MODES.localDemo) {
        hideServerRecentTransactions = true;
        renderDashboard(deps.getServerMarketReadModel?.(), deps.getServerPlayerView?.());
        return;
      }
      const nextState = commitMarketState((currentState = {}) => ({
        ...currentState,
        transactions: []
      }));
      renderDashboard(nextState);
    };
    const renderDashboard = (marketState, serverPlayerView = null) => {
      if (!dashboardElement) {
        return;
      }

      const isLocalDemo = executionMode === GAMEPLAY_EXECUTION_MODES.localDemo;
      const visibleMarketState = !isLocalDemo && hideServerRecentTransactions
        ? { ...(marketState || {}), recentTransactions: [], transactions: [] }
        : marketState;
      const economy = isLocalDemo
        ? deps.getResolvedEconomyState?.()
        : {
            cleanMoney: Math.max(0, Number(serverPlayerView?.economy?.cleanCash || 0) || 0),
            dirtyMoney: Math.max(0, Number(serverPlayerView?.economy?.dirtyCash || 0) || 0)
          };

      deps.renderMarketDashboard?.(dashboardElement, deps.createMarketDashboardViewModel?.(deps.createMarketDashboardAdapter?.({
        activeTab,
        marketState: visibleMarketState,
        marketTabConfig: deps.MARKET_TAB_CONFIG,
        economy,
        gangState: isLocalDemo ? deps.getResolvedGangState?.() : {},
        serverScope: isLocalDemo ? deps.getMarketServerScope?.() : {},
        playerTabId: deps.MARKET_PLAYER_TAB_ID,
        refreshAtCityTime: isLocalDemo
          ? deps.getMarketRefreshCityTimeLabel?.()
          : String(marketState?.normalMarket?.nextRefreshCityTimeLabel || "--:--"),
        normalizePlayerMarketListings: deps.normalizePlayerMarketListings,
        normalizeMarketTransactions: deps.normalizeMarketTransactions,
        getStockAmount,
        formatPrice: deps.formatMarketPrice
      })), { onClearRecentTransactions: clearRecentTransactions });
    };
    const renderPlayerMarketTab = (priceState, serverScope, tabState = {}, serverMarket = null, serverPlayerView = null) => {
      if (tabState.isAuthoritative && serverMarket?.playerMarket) {
        const playerMarketViewModel = createServerPlayerMarketPanelPayload({
          serverMarket,
          playerView: serverPlayerView,
          formatPrice: deps.formatMarketPrice
        });
        deps.renderPlayerMarketPanel?.(listElement, {
          ...playerMarketViewModel,
          formState: playerMarketFormState
        }, {
          ...createServerPlayerMarketCallbacks({
            submitServerMarketCommand: deps.submitServerMarketCommand,
            setMarketFeedback,
            refreshMarketTab: renderMarketTab
          }),
          onFormStateChange: (nextFormState) => {
            playerMarketFormState = nextFormState && typeof nextFormState === "object"
              ? nextFormState
              : null;
          }
        });
        return;
      }
      const { viewModel: playerMarketViewModel } = deps.createPlayerMarketPanelPayload?.({
        priceState,
        serverScope,
        catalog: deps.getPlayerMarketCatalog?.(),
        economy: deps.getResolvedEconomyState?.(),
        sellerId: deps.MARKET_PLAYER_SELLER_ID,
        tabState,
        ownListingLimit: deps.MARKET_PLAYER_OWN_LISTING_LIMIT,
        normalizeMarketTradeState: deps.normalizeMarketTradeState,
        normalizePlayerMarketListings: deps.normalizePlayerMarketListings,
        getInventoryAmount: deps.getInventoryAmount,
        getListingTotal: deps.getMarketListingTotal,
        formatPrice: deps.formatMarketPrice
      }) || { viewModel: {} };

      deps.renderPlayerMarketPanel?.(listElement, {
        ...playerMarketViewModel,
        formState: playerMarketFormState
      }, {
        ...deps.createPlayerMarketCallbacks?.({
          root,
          priceState,
          playerMarketViewModel,
          serverScope,
          sellerId: deps.MARKET_PLAYER_SELLER_ID,
          playerTabId: deps.MARKET_PLAYER_TAB_ID,
          ownListingLimit: deps.MARKET_PLAYER_OWN_LISTING_LIMIT,
          listingLimit: deps.MARKET_PLAYER_LISTING_LIMIT,
          listingTtlMs: deps.MARKET_PLAYER_LISTING_TTL_MS,
          getSuggestedPlayerMarketUnitPrice: deps.getSuggestedPlayerMarketUnitPrice,
          setMarketFeedback,
          setInventoryAmount: deps.setInventoryAmount,
          getInventoryAmount: deps.getInventoryAmount,
          getCurrentPlayerIdentityLabel: deps.getCurrentPlayerIdentityLabel,
          commitMarketState,
          normalizePlayerMarketListings: deps.normalizePlayerMarketListings,
          normalizeMarketTransactions: deps.normalizeMarketTransactions,
          createTransaction: deps.createMarketTransaction,
          formatMarketPrice: deps.formatMarketPrice,
          applyTopbarEconomy: deps.applyTopbarEconomy,
          refreshMarketTab: renderMarketTab,
          getResolvedEconomyState: deps.getResolvedEconomyState,
          setStoredEconomyState: deps.setStoredEconomyState,
          resolveBlackMarketHeatRisk,
          addGangHeat: deps.addGangHeat,
          getListingTotal: deps.getMarketListingTotal
        }),
        onFormStateChange: (nextFormState) => {
          playerMarketFormState = nextFormState && typeof nextFormState === "object"
            ? nextFormState
            : null;
        }
      });
    };

    const renderMarketTab = () => {
      const priceState = executionMode === GAMEPLAY_EXECUTION_MODES.localDemo
        ? deps.refreshMarketPricesIfNeeded?.(false)
        : null;
      const tabConfig = activeTab === "market"
        ? executionMode === GAMEPLAY_EXECUTION_MODES.localDemo
          ? deps.getCityMarketTabConfig?.() || deps.MARKET_TAB_CONFIG?.market || {}
          : deps.MARKET_TAB_CONFIG?.market || {}
        : deps.MARKET_TAB_CONFIG?.[activeTab] || deps.MARKET_TAB_CONFIG?.market || {};
      const serverScope = executionMode === GAMEPLAY_EXECUTION_MODES.localDemo
        ? deps.getMarketServerScope?.()
        : null;
      const serverMarket = deps.getServerMarketReadModel?.();
      const serverPlayerView = deps.getServerPlayerView?.();
      const dataSource = createMarketDataSourceSnapshot({
        activeTab,
        playerTabId: deps.MARKET_PLAYER_TAB_ID,
        serverMarket,
        localMarketState: priceState,
        allowLocalFallback: executionMode === GAMEPLAY_EXECUTION_MODES.localDemo
      });
      const tabState = createMarketTabStateViewModel(dataSource);
      const paymentKey = tabConfig.payment || "cleanMoney";
      const payoutKey = tabConfig.payout || paymentKey;

      popup.dataset.marketMode = activeTab;
      popup.dataset.marketSource = tabState.source;
      popup.dataset.marketStatus = tabState.status;
      popup.dataset.marketPreview = String(tabState.isPreview);
      popup.dataset.marketAuthoritative = String(tabState.isAuthoritative);

      if (titleElement) {
        const marketTitle = getMarketTitle();
        titleElement.textContent = marketTitle;
        titleElement.dataset.mobileTitle = activeTab === "market" ? "Market" : marketTitle;
      }

      if (serverBadgeElement) {
        serverBadgeElement.textContent = "";
        serverBadgeElement.hidden = true;
      }

      renderDashboard(dataSource.marketState, serverPlayerView);

      copyElement.textContent = deps.createMarketCopy?.(activeTab, tabConfig);
      listElement.replaceChildren();

      if (activeTab === deps.MARKET_PLAYER_TAB_ID) {
        renderPlayerMarketTab(
          dataSource.localMarketState || dataSource.marketState,
          serverScope,
          tabState,
          dataSource.serverMarket,
          serverPlayerView
        );
        deps.syncMarketTabs?.(tabs, activeTab);
        return;
      }

      const catalogViewModel = dataSource.status === "unavailable"
        ? {
            emptyMessage: tabState.unavailableMessage,
            items: [],
            source: tabState.source,
            status: tabState.status
          }
        : dataSource.useServerMarket
          ? createServerMarketCatalogPanelPayload({
              activeTab,
              serverMarket: dataSource.serverMarket,
              playerView: serverPlayerView,
              cityMarketOfferIds: executionMode === GAMEPLAY_EXECUTION_MODES.localDemo
                ? tabConfig.items?.map((item) => item.itemId)
                : [],
              formatPrice: deps.formatMarketPrice
            })
          : deps.createMarketCatalogPanelPayload?.({
              tabConfig,
              activeTab,
              paymentKey,
              payoutKey,
              priceState,
              marketDiscount: deps.getShoppingMallMarketDiscountForTab?.(activeTab),
              getInventoryAmount: deps.getInventoryAmount,
              getStockAmount,
              getMaxStock,
              getStockLabel,
              getStockPercent,
              applyDiscountToPrice: deps.applyShoppingMallMarketDiscountToPrice,
              formatPrice: deps.formatMarketPrice,
              getMoneyLabel: deps.getMarketMoneyLabel,
              tabState
            });
      if (catalogViewModel && !catalogViewModel.emptyMessage) {
        catalogViewModel.emptyMessage = tabState.emptyMessage;
      }
      if (catalogViewModel) {
        catalogViewModel.source = tabState.source;
        catalogViewModel.status = tabState.status;
        catalogViewModel.isAuthoritative = tabState.isAuthoritative;
        catalogViewModel.isFallback = tabState.isFallback;
        catalogViewModel.isPreview = tabState.isPreview;
      }

      const marketCallbacks = dataSource.useServerMarket
        ? createServerMarketCallbacks({
            activeTab,
            submitServerMarketCommand: deps.submitServerMarketCommand,
            setMarketFeedback,
            formatMarketPrice: deps.formatMarketPrice,
            refreshMarketTab: renderMarketTab
          })
        : deps.createMarketCatalogCallbacks?.({
            root,
            activeTab,
            getResolvedEconomyState: deps.getResolvedEconomyState,
            getInventoryAmount: deps.getInventoryAmount,
            getStorageAvailableAmount: deps.getStorageAvailableAmount,
            getResolvedMarketPriceState: deps.getResolvedMarketPriceState,
            getStockAmount,
            getMaxStock,
            createMarketTradeStateViewModel: deps.createMarketTradeStateViewModel,
            resolveBlackMarketHeatRisk,
            formatMarketPrice: deps.formatMarketPrice,
            setMarketFeedback,
            setInventoryAmount: deps.setInventoryAmount,
            setStoredEconomyState: deps.setStoredEconomyState,
            addGangHeat: deps.addGangHeat,
            commitMarketState,
            normalizeMarketStockState: deps.normalizeMarketStockState,
            getMarketStockKey: deps.getMarketStockKey,
            clamp: deps.clamp,
            createTransaction: deps.createMarketTransaction,
            normalizeMarketTransactions: deps.normalizeMarketTransactions,
            applyTopbarEconomy: deps.applyTopbarEconomy,
            refreshMarketTab: renderMarketTab
          });

      const renderCatalog = activeTab === "black-market" ? deps.renderBlackMarketPanel : deps.renderMarketPanel;
      renderCatalog?.(listElement, catalogViewModel, marketCallbacks);

      deps.syncMarketTabs?.(tabs, activeTab);
    };

    const openPopup = () => {
      setMarketFeedback("", "");
      renderMarketTab();
      deps.openMarketPanel?.(popup);
    };

    const closePopup = () => {
      playerMarketFormState = null;
      deps.closeMarketPanel?.(popup);
    };

    openButton.addEventListener("click", openPopup);

    for (const tab of tabs) {
      tab.addEventListener("click", () => {
        if (!tab.dataset.marketTab) {
          return;
        }

        if (activeTab === deps.MARKET_PLAYER_TAB_ID && tab.dataset.marketTab !== activeTab) {
          playerMarketFormState = null;
        }
        activeTab = tab.dataset.marketTab;
        setMarketFeedback("", "");
        renderMarketTab();
      });
    }

    for (const closeElement of closeElements) {
      closeElement.addEventListener("click", closePopup);
    }

    documentRef?.addEventListener?.("keydown", (event) => {
      if (event.key === "Escape" && !popup.hidden) {
        closePopup();
      }
    });

    if (executionMode !== GAMEPLAY_EXECUTION_MODES.localDemo) {
      documentRef?.addEventListener?.("empire:gameplay-slice-rendered", () => {
        if (!popup.hidden) {
          renderMarketTab();
        }
      });
    }

    const scheduleMarketRefresh = () => {
      if (marketPriceTimerId !== null) {
        windowRef?.clearTimeout?.(marketPriceTimerId);
      }

      const state = deps.getResolvedMarketPriceState?.();
      const priceRefreshDelay = Math.max(250, new Date(state.nextRefreshAt).getTime() - Date.now());
      const cityOfferRefreshDelay = Math.max(250, Number(deps.getCityMarketOfferRefreshDelayMs?.() || Number.POSITIVE_INFINITY));
      const delay = Math.min(priceRefreshDelay, cityOfferRefreshDelay);

      marketPriceTimerId = windowRef?.setTimeout?.(() => {
        deps.refreshMarketPricesIfNeeded?.(false);
        if (!popup.hidden) {
          renderMarketTab();
        }
        scheduleMarketRefresh();
      }, delay) ?? null;
    };

    if (executionMode === GAMEPLAY_EXECUTION_MODES.localDemo) {
      scheduleMarketRefresh();
    }
    return true;
  };

  return {
    bindMarketPopup
  };
}

function createServerMarketCallbacks(deps = {}) {
  const activeTab = deps.activeTab || "market";
  const formatPrice = deps.formatMarketPrice || ((value) => String(value));
  const setMarketFeedback = deps.setMarketFeedback || (() => {});
  const refreshMarketTab = deps.refreshMarketTab || (() => {});
  const resolveHeatRisk = (totalValue, tiers = []) => {
    const value = Math.max(0, Number(totalValue || 0));
    const match = [...tiers]
      .sort((left, right) => Number(right?.min || 0) - Number(left?.min || 0))
      .find((tier) => value >= Number(tier?.min || 0));
    return Math.max(0, Number(match?.heat || 0));
  };

  const submit = async (payload, successLabel) => {
    if (typeof deps.submitServerMarketCommand !== "function") {
      setMarketFeedback("warning", "Kontakt mlčí. Zkus to později.");
      refreshMarketTab();
      return;
    }
    const confirmed = typeof window === "undefined" || window.confirm?.(successLabel.preview) !== false;
    if (!confirmed) {
      return;
    }
    setMarketFeedback("info", "Kontakt potvrzuje obchod...");
    const response = await deps.submitServerMarketCommand(payload);
    if (!response?.accepted) {
      const message = response?.errors?.[0]?.message || "Obchod neprošel. Zkus menší množství nebo později.";
      setMarketFeedback("warning", message);
      refreshMarketTab();
      return;
    }
    setMarketFeedback(successLabel.tone || "success", successLabel.done);
    refreshMarketTab();
  };

  return {
    getTradeState: (item = {}, requestedQuantity = 1) => {
      const quantity = Math.max(1, Math.floor(Number(requestedQuantity || 1)));
      const buyTotal = quantity * Math.max(1, Math.floor(Number(item.buyPrice || 1)));
      const sellTotal = quantity * Math.max(1, Math.floor(Number(item.sellPrice || 1)));
      const isBlackMarket = activeTab === "black-market";
      const heatRisk = isBlackMarket
        ? (resolveHeatRisk(buyTotal, item.heatByValue) || Math.max(0, Number(item.heatRisk || 0)))
        : 0;
      const stock = Number(item.stock);
      const exceedsBuyStock = !isBlackMarket && Number.isFinite(stock) && stock < quantity;
      const storageAvailableAmount = Number(item.storageAvailableAmount);
      const exceedsStorage = Number.isFinite(storageAvailableAmount) && storageAvailableAmount < quantity;
      const primaryCash = isBlackMarket ? Number(item.playerDirtyCash) : Number(item.playerCleanCash);
      const lacksPrimaryCash = Number.isFinite(primaryCash) && primaryCash < buyTotal;
      const buyDisabled = !item.canBuy || exceedsBuyStock || exceedsStorage || lacksPrimaryCash;
      const cleanTotal = quantity * Math.max(1, Math.floor(Number(item.cleanBuyPrice || item.buyPrice || 1)));
      const cleanCash = Number(item.playerCleanCash);
      const cleanBuyDisabled = item.canBuyClean === false
        || exceedsStorage
        || (Number.isFinite(cleanCash) && cleanCash < cleanTotal);
      const maxStock = Number(item.maxStock);
      const sellCapacity = Number.isFinite(stock) && Number.isFinite(maxStock)
        ? Math.max(0, maxStock - stock)
        : Number.POSITIVE_INFINITY;
      const lacksInventory = Number(item.amount || 0) < quantity;
      const exceedsCapacity = Number.isFinite(sellCapacity) && sellCapacity < quantity;
      const sellDisabled = isBlackMarket || !item.canSell || lacksInventory || exceedsCapacity;
      return {
        buyDisabled,
        sellDisabled,
        buyTitle: exceedsStorage
          ? "Do SKLADU se zvolené množství nevejde."
          : exceedsBuyStock
            ? `Trh má jen ${Math.max(0, Math.floor(stock))} ks.`
            : lacksPrimaryCash
              ? `Na ${quantity} ks nemáš dost ${isBlackMarket ? "dirty" : "clean"} cash.`
              : buyDisabled ? "Tenhle obchod teď nejde uzavřít." : "Koupit z trhu.",
        cleanBuyDisabled,
        cleanBuyTitle: exceedsStorage
          ? "Do SKLADU se zvolené množství nevejde."
          : Number.isFinite(cleanCash) && cleanCash < cleanTotal
            ? "Na zvolené množství nemáš dost clean cash."
            : cleanBuyDisabled ? "Tenhle clean obchod teď nejde uzavřít." : "Koupit přes černý trh za clean cash.",
        sellTitle: sellDisabled
          ? isBlackMarket
            ? "Černý trh dnes výkup nedělá."
            : exceedsCapacity
              ? "Trh je přesycený."
              : "Nemáš dost zboží na prodej."
          : "Prodat do trhu.",
        totalLabel: isBlackMarket && heatRisk
          ? `Celkem ${formatPrice(buyTotal)} · Heat +${heatRisk}`
          : `Celkem ${formatPrice(buyTotal)} · prodej ${formatPrice(sellTotal)}`
      };
    },
    onBuyItem: (item = {}, requestedQuantity = 1) => {
      const quantity = Math.max(1, Math.floor(Number(requestedQuantity || 1)));
      const isBlackMarket = activeTab === "black-market";
      const paymentType = item.paymentType === "cleanCash" ? "cleanCash" : isBlackMarket ? "dirtyCash" : "cleanCash";
      const total = quantity * Math.max(1, Math.floor(Number(item.buyPrice || 1)));
      return submit({
        action: "buy",
        resourceId: item.resourceId,
        amount: quantity,
        marketType: isBlackMarket ? "black" : "normal",
        paymentType
      }, {
        tone: isBlackMarket ? "danger" : "success",
        preview: `Potvrdit nákup ${quantity}x ${item.name} za ${formatPrice(total)}${isBlackMarket ? ` ${paymentType === "dirtyCash" ? "dirty" : "clean"} cash` : ""}?`,
        done: `${isBlackMarket ? "Kontakt předal" : "Trh vydal"} ${quantity}x ${item.name}.`
      });
    },
    onSellItem: (item = {}, requestedQuantity = 1) => {
      const quantity = Math.max(1, Math.floor(Number(requestedQuantity || 1)));
      const total = quantity * Math.max(1, Math.floor(Number(item.sellPrice || 1)));
      return submit({
        action: "sell",
        resourceId: item.resourceId,
        amount: quantity
      }, {
        preview: `Potvrdit prodej ${quantity}x ${item.name} za ${formatPrice(total)}?`,
        done: `Trh převzal ${quantity}x ${item.name}.`
      });
    }
  };
}
