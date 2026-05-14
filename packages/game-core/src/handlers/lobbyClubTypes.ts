import type { BuildingActionBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";

export interface LobbyClubRiskEvent {
  actionId: string;
  riskPct: number;
  expiresAtTick: number;
  tick: number;
}

export interface LobbyClubScandalEvent {
  type: string;
  tick: number;
  label: string;
  riskPct: number;
  rumorText?: string;
}

export interface LobbyClubMetadata {
  backroomPressureExpiresAtTick?: number;
  mediaScreenExpiresAtTick?: number;
  riskReductionExpiresAtTick?: number;
  nextInfluenceDiscountPct?: number;
  nextInfluenceDiscountExpiresAtTick?: number;
  incomePenaltyUntilTick?: number;
  influenceCostReductionDisabledUntilTick?: number;
  lastScandalCheckTick?: number;
  riskEvents: LobbyClubRiskEvent[];
  scandalEvents: LobbyClubScandalEvent[];
}

export interface LobbyClubActionResolution {
  balances: Record<string, number>;
  buildingMetadata: Record<string, unknown>;
  heatGain: number;
  influenceChange: number;
  outputGain: Record<string, number>;
  inputCost: Record<string, number>;
  effectModifiers?: BuildingActionBalanceConfig["effectModifiers"];
  reportText: string;
  buildingPatchesById?: Record<string, CoreGameState["buildingsById"][string]>;
  lobbyClubResult: Record<string, unknown>;
}
