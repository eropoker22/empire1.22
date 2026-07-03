export const MARKET_DATA_SOURCE = Object.freeze({
  LOCAL_FALLBACK: "local-fallback",
  PLAYER_BAZAAR_PREVIEW: "player-bazaar-preview",
  SERVER: "server",
  UNAVAILABLE: "unavailable"
});

const MARKET_SOURCE_METADATA = Object.freeze({
  [MARKET_DATA_SOURCE.SERVER]: Object.freeze({
    availability: "ready",
    emptyMessage: "Kontakt mlčí. Zkus to později.",
    isAuthoritative: true,
    isFallback: false,
    isPreview: false,
    reason: "server_market_read_model",
    unavailableMessage: "Kontakt mlčí. Zkus to později.",
    warnings: []
  }),
  [MARKET_DATA_SOURCE.LOCAL_FALLBACK]: Object.freeze({
    availability: "ready",
    emptyMessage: "Sklad je prázdný. Nejdřív získej zásoby.",
    isAuthoritative: false,
    isFallback: true,
    isPreview: true,
    reason: "local_market_fallback",
    unavailableMessage: "Kontakt mlčí. Zkus to později.",
    warnings: ["local_market_fallback"]
  }),
  [MARKET_DATA_SOURCE.PLAYER_BAZAAR_PREVIEW]: Object.freeze({
    availability: "ready",
    emptyMessage: "Hráčský bazar čeká na první obchodníky.",
    isAuthoritative: false,
    isFallback: true,
    isPreview: true,
    reason: "player_bazaar_preview",
    unavailableMessage: "Tahle část ekonomiky se otevře v alpha provozu.",
    warnings: ["player_bazaar_preview"]
  }),
  [MARKET_DATA_SOURCE.UNAVAILABLE]: Object.freeze({
    availability: "unavailable",
    emptyMessage: "Kontakt mlčí. Zkus to později.",
    isAuthoritative: false,
    isFallback: false,
    isPreview: false,
    reason: "market_payload_missing",
    unavailableMessage: "Kontakt mlčí. Zkus to později.",
    warnings: ["market_payload_missing"]
  })
});

function isObject(value) {
  return Boolean(value && typeof value === "object");
}

function hasRenderableLocalMarketState(value) {
  return isObject(value) && (isObject(value.items) || isObject(value.stock) || Array.isArray(value.playerListings));
}

function hasServerResources(value) {
  return Array.isArray(value?.resources) && value.resources.length > 0;
}

function createSnapshot(input) {
  const metadata = MARKET_SOURCE_METADATA[input.source] || MARKET_SOURCE_METADATA[MARKET_DATA_SOURCE.UNAVAILABLE];
  const descriptiveAvailability = ["empty", "error", "loading", "unavailable"].includes(input.status)
    ? input.status
    : metadata.availability;
  return {
    availability: descriptiveAvailability,
    emptyMessage: metadata.emptyMessage,
    isAuthoritative: metadata.isAuthoritative,
    isFallback: metadata.isFallback,
    isPreview: metadata.isPreview,
    reason: metadata.reason,
    unavailableMessage: metadata.unavailableMessage,
    warnings: [...metadata.warnings],
    ...input
  };
}

export function createMarketDataSourceSnapshot({
  activeTab = "market",
  playerTabId = "player-market",
  serverMarket = null,
  localMarketState = null
} = {}) {
  const isPlayerBazaar = activeTab === playerTabId;
  const hasServerMarket = isObject(serverMarket) && !isPlayerBazaar;
  const hasLocalFallback = hasRenderableLocalMarketState(localMarketState);

  if (hasServerMarket) {
    return createSnapshot({
      activeTab,
      isPlayerBazaar: false,
      marketState: serverMarket,
      serverMarket,
      localMarketState,
      source: MARKET_DATA_SOURCE.SERVER,
      status: hasServerResources(serverMarket) ? "ready" : "empty",
      useServerMarket: true
    });
  }

  if (isPlayerBazaar) {
    return createSnapshot({
      activeTab,
      isPlayerBazaar: true,
      marketState: hasLocalFallback ? localMarketState : {},
      serverMarket,
      localMarketState,
      source: MARKET_DATA_SOURCE.PLAYER_BAZAAR_PREVIEW,
      status: hasLocalFallback ? "ready" : "empty",
      useServerMarket: false
    });
  }

  if (hasLocalFallback) {
    return createSnapshot({
      activeTab,
      isPlayerBazaar: false,
      marketState: localMarketState,
      serverMarket,
      localMarketState,
      source: MARKET_DATA_SOURCE.LOCAL_FALLBACK,
      status: "ready",
      useServerMarket: false
    });
  }

  return createSnapshot({
    activeTab,
    isPlayerBazaar: false,
    marketState: {},
    serverMarket,
    localMarketState,
    source: MARKET_DATA_SOURCE.UNAVAILABLE,
    status: "unavailable",
    useServerMarket: false
  });
}
