import type { PlayerSalvagePoolEntry } from "@empire/shared-types";
import type { BuildingActionBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";

export interface RecyclingCenterNetworkMultipliers {
  incomeMultiplier: number;
  heatMultiplier: number;
}

export interface RecyclingCenterSalvageStats {
  ownedCount: number;
  salvageRatePct: number;
  freshPool: PlayerSalvagePoolEntry[];
  expiredPool: PlayerSalvagePoolEntry[];
}

export interface RecyclingCenterActionResolution {
  balances: Record<string, number>;
  playerSalvagePool: PlayerSalvagePoolEntry[];
  buildingMetadata?: CoreGameState["buildingsById"][string]["metadata"];
  effectModifiers?: BuildingActionBalanceConfig["effectModifiers"];
  heatGain: number;
  influenceChange: number;
  inputCost: Record<string, number>;
  outputGain: Record<string, number>;
  reportText: string;
  recyclingResult: Record<string, unknown>;
}
