export type MarketReadModel = Record<string, unknown> & {
  mode?: "free" | "war";
  resources?: Array<Record<string, unknown>>;
  recentTransactions?: Array<Record<string, unknown>>;
  activeMarketEvents?: Array<Record<string, unknown>>;
};

