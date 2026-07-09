export type MarketReadModel = Record<string, unknown> & {
  mode?: "free" | "war";
  resources?: Array<Record<string, unknown>>;
  inflation?: Record<string, unknown>;
  playerMarket?: {
    listings?: Array<Record<string, unknown>>;
    ownListingCount?: number;
    listingLimitPerSeller?: number;
    preview?: boolean;
    disabledReason?: string | null;
  };
  priceHistory?: Record<string, Array<Record<string, unknown>>>;
  recentTransactions?: Array<Record<string, unknown>>;
  activeMarketEvents?: Array<Record<string, unknown>>;
};

