export type AnyRecord = Record<string, any>;

export type MarketResourceId =
  | "chemicals"
  | "biomass"
  | "metal-parts"
  | "neon-dust"
  | "baseball-bat"
  | "barricades"
  | "stim-pack"
  | "pulse-shot"
  | "velvet-smoke"
  | "tech-core"
  | "pistol"
  | "grenade"
  | "vest"
  | "cameras"
  | "alarm"
  | "combat-module"
  | "ghost-serum"
  | "overdrive-x"
  | "smg"
  | "bazooka"
  | "defense-tower";
export type MarketType = "normal" | "black";
export type MarketPaymentType = "cleanCash" | "dirtyCash";
export type MarketModeId = "free" | "war";
export type MarketTrend = "down" | "stable" | "up" | "spike";
export type PlayerMarketListingStatus = "active" | "sold" | "cancelled" | "expired";
export type MarketEventId = "police_crackdown" | "supply_drop" | "gang_war" | "lab_shortage";

export interface MarketPriceResult {
  resourceId: MarketResourceId;
  marketType: MarketType;
  basePrice: number;
  finalPrice: number;
  factors: {
    demandFactor: number;
    scarcityFactor: number;
    chaosFactor: number;
    inflationFactor: number;
    eventFactor: number;
    marketTypeFactor: number;
  };
}

export interface MarketTransaction {
  id: string;
  timestamp: number;
  playerId: string;
  resourceId: MarketResourceId;
  marketType: MarketType | "player";
  type: "buy" | "sell";
  amount: number;
  unitPrice: number;
  totalPrice: number;
  paymentType: MarketPaymentType;
  auditTriggered?: boolean;
}

export interface PlayerMarketListing {
  id: string;
  createdAt: number;
  expiresAt: number;
  sellerPlayerId: string;
  sellerName?: string;
  resourceId: MarketResourceId;
  amount: number;
  unitPrice: number;
  paymentType: MarketPaymentType;
  status: PlayerMarketListingStatus;
}

export interface ServerMarketState {
  mode: MarketModeId;
  stock: Record<MarketResourceId, number>;
  rollingVolume: Record<MarketResourceId, { buy: number; sell: number }>;
  volumeEvents: Array<{
    timestamp: number;
    resourceId: MarketResourceId;
    type: "buy" | "sell";
    amount: number;
  }>;
  priceHistory: Record<MarketResourceId, Array<{
    timestamp: number;
    normalPrice: number;
    blackMarketPrice: number;
    stock: number;
    inflationFactor: number;
  }>>;
  transactions: MarketTransaction[];
  playerListings: PlayerMarketListing[];
  activeMarketEvents: Array<{
    id: string;
    eventType: MarketEventId;
    startedAt: number;
    expiresAt: number;
  }>;
  lastStockRegenAt: number;
  lastPriceSnapshotAt: number;
  warningFlags: Record<string, number>;
}

export interface MarketActionResult {
  success: boolean;
  reason?: string;
  message: string;
  nextState?: AnyRecord;
  playerState?: AnyRecord;
  resourceId?: MarketResourceId;
  amount?: number;
  marketType?: MarketType | "player";
  paymentType?: MarketPaymentType;
  unitPrice?: number;
  baseUnitPrice?: number;
  totalPrice?: number;
  shoppingMallDiscountPct?: number;
  shoppingMallDiscountAmount?: number;
  marketFeeReductionPct?: number;
  heatAdded?: number;
  policeSuspicionAdded?: number;
  auditTriggered?: boolean;
  transactionId?: string;
  listingId?: string;
}
