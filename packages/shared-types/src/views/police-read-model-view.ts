import type { DistrictId, PlayerId } from "../ids/entity-id";
import type { PendingRaid, PoliceEvent } from "../entities/police-state";

export type PoliceRiskTier = "low" | "medium" | "high" | "extreme";

export interface PoliceReadModel {
  playerId: PlayerId;
  policeStateId: string | null;
  heat: number;
  wantedLevel: number;
  wantedLabel: string;
  riskTier: PoliceRiskTier;
  aggregatePressure: number;
  playerHeatPressure: number;
  districtHeatPressure: number;
  hottestDistrictId: DistrictId | null;
  hottestDistrictHeat: number;
  pendingRaid: PendingRaid | null;
  lastPoliceEvent: PoliceEvent | null;
  policeFeed: PoliceEvent[];
  recommendedAction: string;
  updatedAtTick: number;
  updatedAt?: string;
}
