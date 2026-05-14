import type { DistrictId, PlayerId } from "../ids/entity-id";
import type { PendingRaid, PoliceEvent } from "../entities/police-state";

export type PoliceRiskTier = "low" | "medium" | "high" | "extreme";

export interface PoliceReadModel {
  playerId: PlayerId;
  policeStateId: string | null;
  heat: number;
  playerHeat?: number;
  ownedDistrictHeat?: number;
  wantedLevel: number;
  wantedLabel: string;
  riskTier: PoliceRiskTier;
  aggregatePressure: number;
  raidPressure?: number;
  playerHeatPressure: number;
  districtHeatPressure: number;
  raidPressureExplanation?: string;
  heatBreakdown?: PoliceHeatBreakdownView[];
  hottestDistrictId: DistrictId | null;
  hottestDistrictHeat: number;
  pendingRaid: PendingRaid | null;
  lastPoliceEvent: PoliceEvent | null;
  policeFeed: PoliceEvent[];
  mitigations?: PoliceMitigationView[];
  recommendedAction: string;
  updatedAtTick: number;
  updatedAt?: string;
}

export interface PoliceMitigationView {
  source: string;
  label: string;
  districtId: DistrictId | null;
  coveredDistrictIds?: DistrictId[];
  effectiveReductionPct: number;
  triggerChancePct?: number;
}

export interface PoliceHeatBreakdownView {
  key: "wantedLevel" | "playerHeat" | "districtHeat" | "raidPressure";
  label: string;
  value: string;
  description: string;
}
