const MATERIAL_IDS = new Set(["chemicals", "biomass", "metal-parts", "stim-pack", "tech-core", "combat-module"]);
const DRUG_IDS = new Set(["neon-dust", "pulse-shot", "velvet-smoke", "ghost-serum", "overdrive-x"]);

const resolveInventory = (resourceId) => MATERIAL_IDS.has(resourceId)
  ? "materials"
  : DRUG_IDS.has(resourceId)
    ? "drugs"
    : "weapons";

const toRuntimeCurrency = (paymentType) => paymentType === "dirtyCash" ? "dirtyMoney" : "cleanMoney";

const getPlayerBalance = (playerView, resourceId) => Math.max(0, Math.floor(Number(
  playerView?.resourceBalances?.[resourceId]
  ?? playerView?.economy?.resources?.[resourceId]
  ?? 0
) || 0));

export function createServerPlayerMarketPanelPayload({
  serverMarket = {},
  playerView = {},
  formatPrice = (value) => String(value)
} = {}) {
  const resourceById = new Map((serverMarket.resources || []).map((resource) => [resource.id, resource]));
  const sellableItems = Array.from(resourceById.values())
    .map((resource) => ({
      inventory: resolveInventory(resource.id),
      itemId: resource.id,
      resourceId: resource.id,
      name: resource.name || resource.id,
      category: resource.category || "Trade",
      amount: getPlayerBalance(playerView, resource.id),
      suggestedUnitPrice: Math.max(1, Math.floor(Number(
        resource.normalMarket?.price || resource.blackMarket?.price || 1
      )))
    }))
    .filter((item) => item.amount > 0);

  const listings = (serverMarket.playerMarket?.listings || []).map((listing) => {
    const resource = resourceById.get(listing.resourceId) || {};
    return {
      id: listing.id,
      sellerId: listing.sellerPlayerId,
      sellerName: listing.isOwn ? "Tvoje nabídka" : (listing.sellerName || "Hráč"),
      inventory: resolveInventory(listing.resourceId),
      itemId: listing.resourceId,
      itemName: resource.name || listing.resourceId,
      category: resource.category || "Trade",
      amount: listing.amount,
      unitPrice: listing.unitPrice,
      currency: toRuntimeCurrency(listing.paymentType),
      createdAt: listing.createdAt,
      expiresAt: listing.expiresAt,
      total: listing.totalPrice,
      isOwn: Boolean(listing.isOwn),
      disabled: !listing.isOwn && listing.canBuy !== true,
      title: listing.isOwn
        ? "Stáhnout nabídku a vrátit položku do SKLADU."
        : listing.canBuy
          ? "Koupit nabídku přes serverový escrow převod."
          : "Na tento obchod nemáš dost prostředků nebo místa ve SKLADU."
    };
  });

  return {
    listings,
    sellableItems,
    ownListingCount: Math.max(0, Number(serverMarket.playerMarket?.ownListingCount || 0)),
    ownListingLimit: Math.max(0, Number(serverMarket.playerMarket?.listingLimitPerSeller || 0)),
    emptyMessage: "Na serverovém bazaru teď nejsou žádné aktivní nabídky.",
    isAuthoritative: true,
    isFallback: false,
    isPreview: false,
    formatPrice
  };
}

export function createServerPlayerMarketCallbacks({
  submitServerMarketCommand,
  setMarketFeedback = () => {},
  refreshMarketTab = () => {}
} = {}) {
  const submit = async (payload, pendingMessage, successMessage) => {
    if (typeof submitServerMarketCommand !== "function") {
      setMarketFeedback("warning", "Serverový bazar teď není dostupný.");
      return;
    }
    setMarketFeedback("info", pendingMessage);
    const response = await submitServerMarketCommand(payload);
    if (!response?.accepted) {
      setMarketFeedback("warning", response?.errors?.[0]?.message || "Obchod se nepodařilo dokončit.");
      refreshMarketTab();
      return;
    }
    setMarketFeedback("success", successMessage);
    refreshMarketTab();
  };

  return {
    getSuggestedUnitPrice: (item) => item?.suggestedUnitPrice || 1,
    onCreateListing: ({ item, requestedAmount, unitPrice, currency } = {}) => submit({
      action: "create-listing",
      resourceId: item?.resourceId || item?.itemId,
      amount: requestedAmount,
      unitPrice,
      paymentType: currency === "dirtyMoney" ? "dirtyCash" : "cleanCash"
    }, "Vystavuji nabídku do escrow...", "Nabídka byla vystavena."),
    onBuyListing: (listing) => submit({
      action: "buy-listing",
      listingId: listing?.id
    }, "Ověřuji obchod...", "Nákup byl dokončen."),
    onCancelListing: (listing) => submit({
      action: "cancel-listing",
      listingId: listing?.id
    }, "Stahuji nabídku...", "Nabídka byla vrácena do SKLADU.")
  };
}
