import { getMarketPriceKey } from "../../../../packages/game-config/src/legacy-page/economy-config.js";

const MARKET_ITEM_METADATA = Object.freeze({
  chemicals: Object.freeze({
    tier: 1,
    rarity: "common",
    marketCategory: "drug_material",
    riskLevel: "low",
    supplyLevel: "stable",
    demandLevel: "high",
    priceBand: "street",
    recommendedMinPrice: 430,
    recommendedMaxPrice: 850,
    serverReadyNotes: "Core drug-chain input; official market should stay above efficient self-production."
  }),
  biomass: Object.freeze({
    tier: 1,
    rarity: "common",
    marketCategory: "drug_material",
    riskLevel: "low",
    supplyLevel: "stable",
    demandLevel: "normal",
    priceBand: "street",
    recommendedMinPrice: 480,
    recommendedMaxPrice: 940,
    serverReadyNotes: "Early material with broad production demand and low PvP impact."
  }),
  "stim-pack": Object.freeze({
    tier: 3,
    rarity: "uncommon",
    marketCategory: "tactical_supply",
    riskLevel: "medium",
    supplyLevel: "tight",
    demandLevel: "high",
    priceBand: "mid",
    recommendedMinPrice: 1250,
    recommendedMaxPrice: 2400,
    serverReadyNotes: "Standalone tactical supply; price must protect pharmacy production value."
  }),
  "metal-parts": Object.freeze({
    tier: 2,
    rarity: "common",
    marketCategory: "combat_material",
    riskLevel: "low",
    supplyLevel: "stable",
    demandLevel: "high",
    priceBand: "street",
    recommendedMinPrice: 220,
    recommendedMaxPrice: 460,
    serverReadyNotes: "Combat and factory backbone; official market should be useful but not better than production loops."
  }),
  "tech-core": Object.freeze({
    tier: 4,
    rarity: "rare",
    marketCategory: "advanced_component",
    riskLevel: "medium",
    supplyLevel: "tight",
    demandLevel: "high",
    priceBand: "premium",
    recommendedMinPrice: 620,
    recommendedMaxPrice: 1200,
    serverReadyNotes: "Late component for weapons, defense and upgrades; needs scarcity pressure."
  }),
  "neon-dust": Object.freeze({
    tier: 3,
    rarity: "uncommon",
    marketCategory: "lab_trade_material",
    riskLevel: "medium",
    supplyLevel: "moving",
    demandLevel: "high",
    priceBand: "black",
    recommendedMinPrice: 700,
    recommendedMaxPrice: 1350,
    isBlackMarketOnly: true,
    serverReadyNotes: "Tradeable laboratory material and input for advanced lab recipes."
  }),
  "pulse-shot": Object.freeze({
    tier: 3,
    rarity: "uncommon",
    marketCategory: "lab_trade_material",
    riskLevel: "medium",
    supplyLevel: "tight",
    demandLevel: "high",
    priceBand: "black",
    recommendedMinPrice: 900,
    recommendedMaxPrice: 1750,
    isBlackMarketOnly: true,
    serverReadyNotes: "Tradeable laboratory material used by advanced lab recipes and Ghost Network."
  }),
  "velvet-smoke": Object.freeze({
    tier: 3,
    rarity: "uncommon",
    marketCategory: "lab_trade_material",
    riskLevel: "medium",
    supplyLevel: "moving",
    demandLevel: "normal",
    priceBand: "black",
    recommendedMinPrice: 1000,
    recommendedMaxPrice: 2000,
    isBlackMarketOnly: true,
    serverReadyNotes: "Tradeable laboratory material and input for advanced lab recipes."
  }),
  "ghost-serum": Object.freeze({
    tier: 4,
    rarity: "rare",
    marketCategory: "boost_component",
    riskLevel: "high",
    supplyLevel: "scarce",
    demandLevel: "high",
    priceBand: "premium",
    recommendedMinPrice: 1900,
    recommendedMaxPrice: 3400,
    isBlackMarketOnly: true,
    serverReadyNotes: "Strategic component consumed by Ghost Network and Tactical Grid; it has no direct use effect."
  }),
  "overdrive-x": Object.freeze({
    tier: 5,
    rarity: "rare",
    marketCategory: "boost_component",
    riskLevel: "critical",
    supplyLevel: "scarce",
    demandLevel: "spiking",
    priceBand: "contraband",
    recommendedMinPrice: 3600,
    recommendedMaxPrice: 6200,
    isBlackMarketOnly: true,
    serverReadyNotes: "Rare strategic component consumed by Industrial Overdrive and Tactical Grid; it has no direct use effect."
  }),
  pistol: Object.freeze({
    tier: 3,
    rarity: "uncommon",
    marketCategory: "weapon",
    riskLevel: "medium",
    supplyLevel: "tight",
    demandLevel: "normal",
    priceBand: "black",
    recommendedMinPrice: 1100,
    recommendedMaxPrice: 2100,
    isBlackMarketOnly: true,
    serverReadyNotes: "Entry firearm; priced above craft path to keep armory meaningful."
  }),
  smg: Object.freeze({
    tier: 4,
    rarity: "rare",
    marketCategory: "weapon",
    riskLevel: "high",
    supplyLevel: "scarce",
    demandLevel: "high",
    priceBand: "premium",
    recommendedMinPrice: 3200,
    recommendedMaxPrice: 5600,
    isBlackMarketOnly: true,
    serverReadyNotes: "Strong PvP weapon; high premium and heat pressure are intentional."
  }),
  bazooka: Object.freeze({
    tier: 5,
    rarity: "rare",
    marketCategory: "heavy_weapon",
    riskLevel: "critical",
    supplyLevel: "scarce",
    demandLevel: "spiking",
    priceBand: "contraband",
    recommendedMinPrice: 9500,
    recommendedMaxPrice: 14500,
    isBlackMarketOnly: true,
    serverReadyNotes: "Top destructive PvP item; must stay late-game and black-market expensive."
  })
});

const DEFAULT_MARKET_METADATA = Object.freeze({
  tier: 1,
  rarity: "common",
  marketCategory: "street_goods",
  riskLevel: "low",
  supplyLevel: "stable",
  demandLevel: "normal",
  priceBand: "street",
  recommendedMinPrice: 1,
  recommendedMaxPrice: 1,
  isBlackMarketOnly: false,
  isPreviewOnly: false,
  serverReadyNotes: ""
});

const DEMAND_LABELS = Object.freeze({
  normal: "běžná poptávka",
  high: "město má hlad",
  spiking: "horké zboží"
});

const SUPPLY_LABELS = Object.freeze({
  stable: "stabilní supply",
  moving: "rychlý pohyb",
  tight: "napjatý sklad",
  scarce: "nedostatkové"
});

const RISK_LABELS = Object.freeze({
  low: "nízké riziko",
  medium: "rizikové",
  high: "horké zboží",
  critical: "policie blízko"
});

const RARITY_LABELS = Object.freeze({
  common: "běžné",
  uncommon: "vzácnější",
  rare: "vzácné"
});

const PRICE_BAND_LABELS = Object.freeze({
  street: "uliční cena",
  mid: "střední cena",
  black: "černý trh",
  premium: "premium",
  contraband: "kontraband"
});

function createBadge(label, tone = "neutral") {
  return Object.freeze({ label, tone });
}

export function resolveMarketItemMetadata(item = {}, activeTab = "market") {
  const itemId = String(item.itemId || item.resourceId || "");
  const configured = MARKET_ITEM_METADATA[itemId] || DEFAULT_MARKET_METADATA;
  const provided = item.marketMetadata && typeof item.marketMetadata === "object" ? item.marketMetadata : {};
  const inlineMetadata = {
    ...(item.marketCategory ? { marketCategory: item.marketCategory } : {}),
    ...(item.rarity ? { rarity: item.rarity } : {}),
    ...(item.riskLevel ? { riskLevel: item.riskLevel } : {}),
    ...(item.supplyLevel ? { supplyLevel: item.supplyLevel } : {}),
    ...(item.demandLevel ? { demandLevel: item.demandLevel } : {}),
    ...(item.priceBand ? { priceBand: item.priceBand } : {})
  };
  const isBlackMarket = activeTab === "black-market" || item.rowMode === "black";

  return {
    ...DEFAULT_MARKET_METADATA,
    ...configured,
    ...inlineMetadata,
    ...provided,
    isBlackMarketOnly: Boolean(provided.isBlackMarketOnly ?? configured.isBlackMarketOnly ?? isBlackMarket),
    isPreviewOnly: Boolean(provided.isPreviewOnly ?? configured.isPreviewOnly)
  };
}

export function createMarketItemAtmosphere({
  item = {},
  activeTab = "market",
  trendDirection = "flat",
  stockPercent = 100,
  heatRisk = 0
} = {}) {
  const metadata = resolveMarketItemMetadata(item, activeTab);
  const safeTier = Math.max(1, Math.min(5, Math.floor(Number(metadata.tier || 1))));
  const safeStockPercent = Number.isFinite(Number(stockPercent)) ? Number(stockPercent) : 100;
  const safeHeatRisk = Math.max(0, Math.floor(Number(heatRisk || 0) || 0));
  const badges = [
    createBadge(`T${safeTier}`, safeTier >= 5 ? "contraband" : safeTier >= 4 ? "rare" : "tier")
  ];

  if (activeTab === "black-market" && item.canSell !== false) {
    badges.push(createBadge("nouzový výkup", "risk"));
  }

  if (metadata.rarity !== "common") {
    badges.push(createBadge(RARITY_LABELS[metadata.rarity] || "vzácné", "rare"));
  }

  if (metadata.demandLevel === "high" || metadata.demandLevel === "spiking") {
    badges.push(createBadge(DEMAND_LABELS[metadata.demandLevel], "hot"));
  }

  if (metadata.supplyLevel === "scarce" || safeStockPercent <= 28) {
    badges.push(createBadge("nedostatkové", "shortage"));
  } else if (metadata.supplyLevel === "tight") {
    badges.push(createBadge("napjatý sklad", "supply"));
  }

  if (metadata.riskLevel === "high" || metadata.riskLevel === "critical" || safeHeatRisk >= 6) {
    badges.push(createBadge(RISK_LABELS[metadata.riskLevel] || "rizikové", "risk"));
  } else if (metadata.riskLevel === "medium" || safeHeatRisk > 0) {
    badges.push(createBadge("rizikové", "risk"));
  }

  if (trendDirection === "down") {
    badges.push(createBadge("výhodná nabídka", "deal"));
  } else if (trendDirection === "up") {
    badges.push(createBadge("cena roste", "hot"));
  }

  if (metadata.isBlackMarketOnly) {
    badges.push(createBadge("pod pultem", "contraband"));
  }

  const dealerLine = activeTab === "black-market"
    ? safeHeatRisk >= 6 || metadata.riskLevel === "critical"
      ? "Policie je moc blízko. Kontakt chce rychlý obchod."
      : "Špinavé peníze tady mluví hlasitěji."
    : metadata.supplyLevel === "scarce" || safeStockPercent <= 28
      ? "Tohle zboží dlouho nezůstane na stole."
      : "Město má hlad po zásobách.";

  return {
    badges: badges.slice(0, 4),
    dealerLine,
    demandLabel: DEMAND_LABELS[metadata.demandLevel] || DEMAND_LABELS.normal,
    marketCategoryLabel: metadata.marketCategory,
    marketMetadata: metadata,
    priceBandLabel: PRICE_BAND_LABELS[metadata.priceBand] || metadata.priceBand,
    rarityLabel: RARITY_LABELS[metadata.rarity] || metadata.rarity,
    riskLabel: RISK_LABELS[metadata.riskLevel] || metadata.riskLevel,
    supplyLabel: SUPPLY_LABELS[metadata.supplyLevel] || metadata.supplyLevel
  };
}

function createMarketMood(activeTab = "market", tabLabel = "Market") {
  const safeTabLabel = String(tabLabel || "Market");
  if (activeTab === "black-market") {
    return { label: safeTabLabel, value: "policie blízko", tone: "danger" };
  }

  if (activeTab === "player-market") {
    return { label: safeTabLabel, value: "čeká na obchodníky", tone: "stock" };
  }

  return { label: safeTabLabel, value: "hlad po zásobách", tone: "stock" };
}

export function createMarketTabStateViewModel({
  activeTab = "market",
  source = "unavailable",
  status = "ready",
  emptyMessage = "",
  unavailableMessage = "",
  isAuthoritative = false,
  isFallback = false,
  isPreview = false,
  reason = "",
  warnings = []
} = {}) {
  const fallbackEmptyMessage = activeTab === "player-market"
    ? "Hráčský bazar čeká na první obchodníky."
    : activeTab === "black-market"
      ? "Černý trh dnes drží nízký profil."
      : "Sklad je prázdný. Nejdřív získej zásoby.";
  const fallbackUnavailableMessage = activeTab === "player-market"
    ? "Tahle část ekonomiky se otevře v alpha provozu."
    : "Kontakt mlčí. Zkus to později.";

  return {
    activeTab,
    emptyMessage: String(emptyMessage || fallbackEmptyMessage),
    errorMessage: "Obchod neprošel. Zkus to znovu.",
    isAuthoritative: Boolean(isAuthoritative),
    isFallback: Boolean(isFallback),
    isPreview: Boolean(isPreview),
    loadingMessage: "Sháním poslední ceny z ulice.",
    reason: String(reason || ""),
    source: String(source || "unavailable"),
    status: String(status || "ready"),
    unavailableMessage: String(unavailableMessage || fallbackUnavailableMessage),
    warnings: Array.isArray(warnings) ? warnings : []
  };
}

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
  const mood = createMarketMood(activeTab, tabLabel);
  return {
    chips: [
      { label: mood.label, value: mood.value, tone: mood.tone },
      { label: "Čisté", value: formatPrice(economy.cleanMoney), tone: "clean" },
      { label: "Špinavé", value: formatPrice(economy.dirtyMoney), tone: "dirty" },
      { label: "Heat", value: String(gangState.heat || 0), tone: isDangerMode ? "danger" : "neutral" },
      { label: "Obnova", value: `${Math.max(0, Math.floor(Number(refreshCountdownSeconds) || 0))} s`, tone: "timer" },
      { label: "Zásoba", value: stockSummary, tone: isDangerMode ? "danger" : "stock" }
    ],
    recentTransactions: safeRecentTransactions.slice(0, 1),
    allRecentTransactions: safeRecentTransactions
  };
}

export function createMarketCopy(activeTab = "market", tabConfig = {}) {
  const copy = String(tabConfig.copy || "");
  if (activeTab === "player-market") {
    return `${copy} Nabídku můžeš bezpečně stáhnout; dirty platby zvyšují Heat.`;
  }

  if (activeTab === "black-market") {
    return `${copy} Nabídka je omezená a nákup zvyšuje Heat; zaplatit lze dirty nebo dražší clean cash.`;
  }

  return `${copy} Nákup snižuje zásobu trhu, prodej ji vrací a ceny se průběžně obnovují.`;
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
    const trendDirection = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
    const stockPercent = getStockPercent(priceState, activeTab, item.itemId);
    const atmosphere = createMarketItemAtmosphere({
      item,
      activeTab,
      trendDirection,
      stockPercent
    });
    const priceLabel = activeTab === "black-market"
      ? `Nákup ${formatPrice(buyPrice)} · nouzový výkup ${formatPrice(sellPrice)} · pod cenou`
      : safeDiscount.discountPct > 0
        ? `Základ ${formatPrice(baseBuyPrice)} · sleva OC -${safeDiscount.discountPct.toFixed(1)} % · nákup ${formatPrice(buyPrice)} · fee -${safeDiscount.feeReductionPct.toFixed(0)} % · výkup ${formatPrice(sellPrice)}`
        : `Nákup ${formatPrice(buyPrice)} · výkup ${formatPrice(sellPrice)}`;

    return {
      ...item,
      ...atmosphere,
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
      priceLabel,
      sellActionLabel: activeTab === "black-market" ? "Likvidovat" : "Prodat",
      trendDirection,
      trendLabel: delta > 0
        ? `▲ +${formatPrice(delta)}`
        : delta < 0
          ? `▼ -${formatPrice(Math.abs(delta))}`
          : "• beze změny",
      stockPercent,
      stockLabel: getStockLabel(priceState, activeTab, item.itemId)
    };
  });
}

export function createPlayerMarketViewModel({
  listings = [],
  sellableItems = [],
  economy = {},
  emptyMessage = "Hráčský bazar čeká na první obchodníky.",
  isAuthoritative = false,
  isFallback = true,
  isPreview = true,
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
    emptyMessage,
    isAuthoritative,
    isFallback,
    isPreview,
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
          ? "Trh nemá dost zboží."
          : `Chybí ${formatPrice(buyTotal - availableMoney)}.`)
      : activeTab === "black-market" && blackHeatRisk
        ? `Rizikový obchod: +${blackHeatRisk.heat} heat (${blackHeatRisk.label}).`
        : "Koupit z trhu.",
    sellTitle: sellDisabled
      ? (Number(currentAmount || 0) < quantity
          ? "Nemáš dost kusů ve skladu."
          : "Trh je přesycený.")
      : activeTab === "black-market"
        ? "Kontakt to vezme z ruky, ale za směšnou cenu."
        : "Prodat do trhu.",
    totalLabel: activeTab === "black-market"
      ? `Celkem ${formatPrice(buyTotal)} · likvidace ${formatPrice(sellTotal)} · tvrdá ztráta${blackHeatRisk ? ` · +${blackHeatRisk.heat} heat` : ""}`
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
