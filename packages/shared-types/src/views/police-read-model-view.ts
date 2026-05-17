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
  wantedLevelLabel: string;
  wantedLabel: string;
  riskTier: PoliceRiskTier;
  aggregatePressure: number;
  raidPressure?: number;
  playerHeatPressure: number;
  districtHeatPressure: number;
  raidPressureExplanation?: string;
  heatBreakdown?: PoliceHeatBreakdownView[];
  selectedDistrictId?: DistrictId | null;
  selectedDistrictHeat?: number;
  hottestDistrictId: DistrictId | null;
  hottestDistrictHeat: number;
  pendingRaid: PolicePendingRaidView | null;
  activeRaid: PoliceRaidInfoView | null;
  recentRaid: PoliceRaidInfoView | null;
  activeConsequences: PoliceConsequenceView[];
  raidConsequenceStatus: "none" | "pending" | "active" | "recent";
  lastPoliceEvent: PoliceEvent | null;
  policeFeed: PoliceEvent[];
  mitigations?: PoliceMitigationView[];
  protection: PoliceProtectionView;
  recommendedAction: string;
  updatedAtTick: number;
  updatedAt?: string;
}

export interface PolicePendingRaidView extends Omit<PendingRaid, "targetDistrictId" | "expiresAtTick"> {
  id: string;
  triggerTick: number;
  expiresAtTick: number | null;
  targetDistrictId: DistrictId | null;
}

export interface PoliceRaidInfoView {
  id: string;
  type: string;
  severity: string;
  status: string;
  districtId: DistrictId | null;
  tick: number;
  message: string;
}

export interface PoliceConsequenceView {
  id: string;
  type: string;
  severity: string;
  districtId: DistrictId | null;
  expiresAtTick: number | null;
}

export interface PoliceProtectionView {
  raidConsequenceMultiplier: number;
  sources: string[];
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
