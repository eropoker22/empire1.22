const MARKET_TAB_PRESENTATION = Object.freeze({
  market: Object.freeze({
    title: "Městský market",
    mobileTitle: "Market",
    copy: "Bezpečný městský kanál pro základní výrobní vstupy bez Heat risku. Nákup snižuje zásobu trhu, prodej ji vrací a ceny se průběžně obnovují."
  }),
  "black-market": Object.freeze({
    title: "Černý trh",
    mobileTitle: "Černý trh",
    copy: "Rotující síť překupníků pro vzácné komponenty, látky a výzbroj. Nabídka je omezená a nákup zvyšuje Heat; zaplatit lze dirty nebo dražší clean cash."
  }),
  "player-market": Object.freeze({
    title: "Hráčský bazar",
    mobileTitle: "Hráčský bazar",
    copy: "Nabídky hráčů používají escrow; položka zůstává blokovaná do prodeje, stažení nebo expirace. Nabídku můžeš bezpečně stáhnout; dirty platby zvyšují Heat."
  })
});

const MATERIAL_IDS = new Set(["chemicals", "biomass", "metal-parts", "stim-pack", "tech-core", "combat-module"]);
const DRUG_IDS = new Set(["neon-dust", "pulse-shot", "velvet-smoke", "ghost-serum", "overdrive-x"]);

export function createServerMarketFingerprint(readModel) {
  const market = readModel?.market || null;
  const player = readModel?.player || {};
  const resources = Array.isArray(market?.resources) ? market.resources : [];
  const resourceIds = resources.map((resource) => String(resource?.id || ""));
  return JSON.stringify({
    mode: market?.mode || null,
    resources: resources.map((resource) => ({
      id: resource?.id,
      name: resource?.name,
      category: resource?.category,
      trend: resource?.trend,
      warnings: resource?.warnings,
      normalMarket: resource?.normalMarket,
      blackMarket: resource?.blackMarket
    })),
    blackMarket: market?.blackMarket || null,
    playerMarket: market?.playerMarket || null,
    recentTransactions: market?.recentTransactions || [],
    balances: resourceIds.map((resourceId) => [resourceId, getPlayerBalance(player, resourceId)]),
    cleanCash: player?.economy?.cleanCash ?? null,
    dirtyCash: player?.economy?.dirtyCash ?? null
  });
}

export function createServerMarketTabView(readModel, activeTab = "market", formatPrice = String) {
  const market = readModel?.market || {};
  const player = readModel?.player || {};
  const presentation = MARKET_TAB_PRESENTATION[activeTab] || MARKET_TAB_PRESENTATION.market;
  return {
    activeTab,
    title: presentation.title,
    mobileTitle: presentation.mobileTitle,
    copy: presentation.copy,
    dashboard: createDashboardView(market, player, activeTab, formatPrice),
    catalog: activeTab === "player-market"
      ? null
      : createCatalogView(market, player, activeTab, formatPrice)
  };
}

export function createServerMarketCommand(action = {}) {
  const resourceId = String(action.resourceId || "");
  const listingId = String(action.listingId || "");
  const amount = Math.max(1, Math.floor(Number(action.amount || 1)));
  switch (action.action) {
    case "buy":
      return {
        type: "buy-market-resource",
        payload: {
          resourceId,
          amount,
          marketType: action.marketType === "black" ? "black" : "normal",
          paymentType: action.paymentType === "dirtyCash" ? "dirtyCash" : "cleanCash"
        }
      };
    case "sell":
      return { type: "sell-market-resource", payload: { resourceId, amount } };
    case "create-listing":
      return {
        type: "create-player-market-listing",
        payload: {
          resourceId,
          amount,
          unitPrice: Math.max(1, Math.floor(Number(action.unitPrice || 1))),
          paymentType: action.paymentType === "dirtyCash" ? "dirtyCash" : "cleanCash"
        }
      };
    case "buy-listing":
      return { type: "buy-player-market-listing", payload: { listingId } };
    case "cancel-listing":
      return { type: "cancel-player-market-listing", payload: { listingId } };
    default:
      return null;
  }
}

function createCatalogView(market, player, activeTab, formatPrice) {
  const isBlackMarket = activeTab === "black-market";
  const resources = (Array.isArray(market?.resources) ? market.resources : [])
    .filter((resource) => (isBlackMarket ? resource?.blackMarket : resource?.normalMarket)?.available === true);
  return {
    isAuthoritative: true,
    source: "server",
    status: "ready",
    emptyMessage: isBlackMarket ? "Černý trh dnes drží nízký profil." : "Městský market teď nemá dostupnou nabídku.",
    items: resources.map((resource) => createCatalogItem(resource, market, player, isBlackMarket, formatPrice))
  };
}

function createCatalogItem(resource, market, player, isBlackMarket, formatPrice) {
  const resourceId = String(resource?.id || "");
  const normal = resource?.normalMarket || {};
  const black = resource?.blackMarket || {};
  const marketView = isBlackMarket ? black : normal;
  const cleanBuyPrice = positivePrice(marketView.price);
  const dirtyBuyPrice = isBlackMarket ? positivePrice(marketView.dirtyCashPrice ?? cleanBuyPrice) : cleanBuyPrice;
  const buyPrice = isBlackMarket ? dirtyBuyPrice : cleanBuyPrice;
  const sellPrice = positivePrice(normal.sellPrice);
  const amount = getPlayerBalance(player, resourceId);
  const stock = finiteNumber(normal.stock, 0);
  const maxStock = finiteNumber(normal.maxStock, 0);
  const stockPercent = finiteNumber(normal.stockPercent, 100);
  const heatRisk = Math.max(0, Math.floor(Number(black.heatRisk || 0)));
  const trend = resource?.trend === "up" || resource?.trend === "spike"
    ? "up"
    : resource?.trend === "down" ? "down" : "flat";
  return {
    inventory: resolveInventory(resourceId),
    itemId: resourceId,
    resourceId,
    name: resource?.name || resourceId,
    amount,
    activeTab: isBlackMarket ? "black-market" : "market",
    buyPrice,
    cleanBuyPrice,
    dirtyBuyPrice,
    sellPrice,
    maxStock,
    hasLimitedStock: !isBlackMarket,
    rowMode: isBlackMarket ? "black" : "normal",
    resourceColor: resourceId,
    serverAuthoritative: true,
    canBuy: isBlackMarket ? black.canBuyWithDirtyCash === true : normal.canBuy === true,
    canBuyClean: isBlackMarket ? black.canBuyWithCleanCash === true : normal.canBuy === true,
    playerCleanCash: Math.max(0, Number(player?.economy?.cleanCash || 0)),
    showCleanBuyAction: isBlackMarket,
    canSell: !isBlackMarket && normal.canSell === true,
    heatRisk,
    badges: createBadges(resource, trend, stockPercent, heatRisk),
    marketMetadata: {
      marketCategory: String(resource?.category || ""),
      riskLevel: heatRisk > 0 ? "medium" : "low"
    },
    dealerLine: isBlackMarket ? "Špinavé peníze tady mluví hlasitěji." : "Město má hlad po zásobách.",
    metaLabel: `Máš ${amount} ks · ${isBlackMarket ? "kontakt dostupný" : `sklad ${stock}/${maxStock}`} · živá cena`,
    priceLabel: isBlackMarket
      ? `Dirty ${formatPrice(dirtyBuyPrice)} · clean ${formatPrice(cleanBuyPrice)}${heatRisk ? ` · heat +${heatRisk}` : ""}`
      : `Nákup ${formatPrice(buyPrice)} · výkup ${formatPrice(sellPrice)}`,
    trendDirection: trend,
    trendLabel: resource?.trend === "spike" ? "▲ spike" : trend === "up" ? "▲ růst" : trend === "down" ? "▼ pokles" : "• stabilní",
    stockPercent,
    stockLabel: isBlackMarket ? "Černý trh nemá veřejný sklad." : `Stock ${stock}/${maxStock}`
  };
}

function createDashboardView(market, player, activeTab, formatPrice) {
  const resources = Array.isArray(market?.resources) ? market.resources : [];
  const listings = Array.isArray(market?.playerMarket?.listings) ? market.playerMarket.listings : [];
  const stock = resources
    .filter((resource) => resource?.normalMarket?.available === true)
    .reduce((total, resource) => total + finiteNumber(resource.normalMarket.stock, 0), 0);
  const recentTransactions = (Array.isArray(market?.recentTransactions) ? market.recentTransactions : [])
    .map(normalizeTransaction)
    .filter(Boolean);
  return {
    chips: [
      { label: "Čisté", value: formatPrice(player?.economy?.cleanCash), tone: "clean" },
      { label: "Špinavé", value: formatPrice(player?.economy?.dirtyCash), tone: "dirty" },
      activeTab === "player-market"
        ? { label: "Provoz", value: "živě", tone: "bazaar" }
        : { label: "Obnova · čas města", value: formatRefreshTime(market?.blackMarket?.refreshesAt), tone: "timer" },
      {
        label: "Zásoba",
        value: activeTab === "player-market" ? `${listings.length} nabídek` : activeTab === "black-market" ? "neomezeně" : `${stock} ks`,
        tone: activeTab === "black-market" ? "danger" : "stock"
      }
    ],
    recentTransactions: recentTransactions.slice(0, 1),
    allRecentTransactions: recentTransactions
  };
}

function normalizeTransaction(transaction, index) {
  const resourceId = String(transaction?.resourceId || transaction?.itemId || "");
  if (!resourceId) return null;
  return {
    id: String(transaction?.id || transaction?.transactionId || `server-market-${index}`),
    type: transaction?.type === "sell" ? "sell" : "buy",
    itemId: resourceId,
    itemName: String(transaction?.itemName || resourceId),
    amount: Math.max(1, Math.floor(Number(transaction?.amount || 1))),
    total: Math.max(0, Math.floor(Number(transaction?.totalPrice ?? transaction?.total ?? 0)))
  };
}

function createBadges(resource, trend, stockPercent, heatRisk) {
  const badges = [];
  if (resource?.category) badges.push({ label: String(resource.category), tone: "tier" });
  if (stockPercent <= 28) badges.push({ label: "nedostatkové", tone: "shortage" });
  if (trend === "up") badges.push({ label: "cena roste", tone: "hot" });
  if (trend === "down") badges.push({ label: "výhodná nabídka", tone: "deal" });
  if (heatRisk > 0) badges.push({ label: "rizikové", tone: "risk" });
  return badges.slice(0, 4);
}

function getPlayerBalance(player, resourceId) {
  return Math.max(0, Math.floor(Number(
    player?.resourceBalances?.[resourceId]
    ?? player?.economy?.resources?.[resourceId]
    ?? 0
  )));
}

function resolveInventory(resourceId) {
  return MATERIAL_IDS.has(resourceId) ? "materials" : DRUG_IDS.has(resourceId) ? "drugs" : "weapons";
}

function positivePrice(value) {
  return Math.max(1, Math.floor(Number(value || 1)));
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function formatRefreshTime(value) {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return "server";
  return new Intl.DateTimeFormat("cs-CZ", { hour: "2-digit", minute: "2-digit" }).format(timestamp);
}
