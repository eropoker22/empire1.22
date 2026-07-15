import type { ActionCommand } from "./action-command";

export type MarketResourceId =
  | "chemicals" | "biomass" | "metal-parts" | "neon-dust" | "baseball-bat" | "barricades"
  | "stim-pack" | "pulse-shot" | "velvet-smoke" | "tech-core" | "pistol" | "grenade"
  | "vest" | "cameras" | "alarm" | "combat-module" | "ghost-serum" | "overdrive-x"
  | "smg" | "bazooka" | "defense-tower";
export type MarketType = "normal" | "black";
export type MarketPaymentType = "cleanCash" | "dirtyCash";

export interface BuyMarketResourcePayload {
  resourceId: MarketResourceId;
  amount: number;
  marketType: MarketType;
  paymentType: MarketPaymentType;
}

export interface SellMarketResourcePayload {
  resourceId: MarketResourceId;
  amount: number;
}

export interface CreatePlayerMarketListingPayload {
  resourceId: MarketResourceId;
  amount: number;
  unitPrice: number;
  paymentType: MarketPaymentType;
}

export interface BuyPlayerMarketListingPayload {
  listingId: string;
}

export interface CancelPlayerMarketListingPayload {
  listingId: string;
}

export type BuyMarketResourceCommand = ActionCommand<"buy-market-resource", BuyMarketResourcePayload>;
export type SellMarketResourceCommand = ActionCommand<"sell-market-resource", SellMarketResourcePayload>;
export type CreatePlayerMarketListingCommand = ActionCommand<"create-player-market-listing", CreatePlayerMarketListingPayload>;
export type BuyPlayerMarketListingCommand = ActionCommand<"buy-player-market-listing", BuyPlayerMarketListingPayload>;
export type CancelPlayerMarketListingCommand = ActionCommand<"cancel-player-market-listing", CancelPlayerMarketListingPayload>;
export type MarketCommand =
  | BuyMarketResourceCommand
  | SellMarketResourceCommand
  | CreatePlayerMarketListingCommand
  | BuyPlayerMarketListingCommand
  | CancelPlayerMarketListingCommand;

