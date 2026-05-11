import type { BuildingActionBalanceConfig } from "../contracts";
export type AirportImportCategory = "materials" | "rareComponents" | "weapons" | "defenseItems";

export interface PendingAirportImport {
  importId: string;
  category: AirportImportCategory;
  startedAtTick: number;
  completesAtTick: number;
  shipment: Record<string, number>;
}

export interface AirportCustomsEvent {
  type: string;
  tick: number;
  label: string;
  riskPct: number;
  rumorText?: string;
}

export interface AirportMetadata {
  pendingImports: PendingAirportImport[];
  blackCharterExpiresAtTick?: number;
  blackCharterOffer?: {
    items: string[];
    discountPct: number;
    purchaseCustomsRiskPct: number;
  };
  evacuationCorridorExpiresAtTick?: number;
  discountDisabledUntilTick?: number;
  nextImportCostPenaltyPct?: number;
  lastCustomsInspectionTick?: number;
  lastImportShipment?: {
    tick: number;
    category: AirportImportCategory;
    requestedItems: Record<string, number>;
    acceptedItems: Record<string, number>;
    lostItems: Record<string, number>;
    customsTriggered: boolean;
  };
  customsEvents: AirportCustomsEvent[];
}

export interface AirportActionResolution {
  balances: Record<string, number>;
  buildingMetadata: Record<string, unknown>;
  heatGain: number;
  influenceChange: number;
  outputGain: Record<string, number>;
  inputCost: Record<string, number>;
  effectModifiers?: BuildingActionBalanceConfig["effectModifiers"];
  reportText: string;
  airportResult: Record<string, unknown>;
}
