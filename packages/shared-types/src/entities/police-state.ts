import type { DistrictId, PlayerId } from "../ids/entity-id";

export type PoliceRaidSeverity = "low" | "medium" | "high" | "extreme";
export type PendingRaidStatus = "pending" | "acknowledged" | "resolved" | "expired";

export interface PoliceRaidMitigationPreview {
  source: "courthouse";
  ownedCount: number;
  reductionPct: number;
  message: string;
  originalConsequences: {
    seizedDirtyCash: number;
    seizedResources: Record<string, number>;
    lockdownTicks: number;
    buildingDisruptionTicks: number;
    heatReducedBy: number;
  };
}

export interface PoliceRaidPreviewConsequences {
  seizedDirtyCash: number;
  seizedResources: Record<string, number>;
  lockedDistrictId: DistrictId | null;
  lockdownUntilTick: number | null;
  disruptedBuildingIds: string[];
  buildingDisruptionUntilTick?: number | null;
  heatReducedBy: number;
  courthouseMitigation?: PoliceRaidMitigationPreview | null;
}

export interface PendingRaid {
  raidId: string;
  playerId: PlayerId;
  targetDistrictId?: DistrictId;
  severity: PoliceRaidSeverity;
  reason: string;
  createdAtTick: number;
  expiresAtTick: number;
  status: PendingRaidStatus;
  previewConsequences: PoliceRaidPreviewConsequences;
  sourcePressure: number;
  resolvedAtTick?: number;
  acknowledgedAtTick?: number;
}

export interface PoliceEvent {
  id: string;
  type: string;
  playerId: PlayerId;
  districtId?: DistrictId;
  severity: PoliceRaidSeverity;
  message: string;
  createdAtTick: number;
  payload?: Record<string, unknown>;
}

/**
 * Responsibility: Shared contract for police and heat status tied to one player.
 * Belongs here: persistent heat values, visible enforcement flags, and raid lifecycle state.
 * Does not belong here: UI-only formatting or browser-side police calculations.
 */
export interface PoliceState {
  id: string;
  ownerPlayerId: PlayerId;
  heat: number;
  wantedLevel: number;
  lastDecayTick: number;
  activeFlags: string[];
  pendingRaids?: PendingRaid[];
  policeEvents?: PoliceEvent[];
  lastRaidCreatedAtTick?: number;
  lastRaidResolvedAtTick?: number;
  lastWarningAtTick?: number;
  version: number;
}
