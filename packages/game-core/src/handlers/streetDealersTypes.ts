import type { BuildingActionBalanceConfig } from "../contracts";
export type StreetDealerIncidentType =
  | "loose_talk"
  | "dealer_under_watch"
  | "fake_customer"
  | "street_conflict"
  | "lost_package"
  | "overloaded_route"
  | "courier_vanished"
  | "police_whisper"
  | "hot_package"
  | "side_skim";

export interface StreetDealerSaleSlot {
  slotId: string;
  saleId?: string;
  itemId?: string;
  itemLabel?: string;
  amount?: number;
  startedAtTick?: number;
  completesAtTick?: number;
  rewardDirtyCash?: number;
  heatGain?: number;
  streetRiskPct?: number;
  originDistrictId?: string;
  originBuildingId?: string;
  cooldownUntilTick?: number;
}

export interface StreetDealersPlayerMetadata {
  slots: StreetDealerSaleSlot[];
  saleHistory: Array<Record<string, unknown>>;
}

export interface StreetDealerNetworkMultipliers {
  passiveDirtyIncomeMultiplier: number;
  saleSpeedMultiplier: number;
  heatMultiplier: number;
}

export interface StreetDealersActionResolution {
  balances: Record<string, number>;
  buildingMetadata?: Record<string, unknown>;
  playerMetadata: Record<string, unknown>;
  heatGain: number;
  influenceChange: number;
  outputGain: Record<string, number>;
  inputCost: Record<string, number>;
  effectModifiers?: BuildingActionBalanceConfig["effectModifiers"];
  reportText: string;
  streetDealerResult: Record<string, unknown>;
}
