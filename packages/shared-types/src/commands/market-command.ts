import type { ActionCommand } from "./action-command";

export type MarketResourceId = "metalParts" | "techCore" | "chemicals" | "biomass";
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

export type BuyMarketResourceCommand = ActionCommand<"buy-market-resource", BuyMarketResourcePayload>;
export type SellMarketResourceCommand = ActionCommand<"sell-market-resource", SellMarketResourcePayload>;
export type MarketCommand = BuyMarketResourceCommand | SellMarketResourceCommand;

