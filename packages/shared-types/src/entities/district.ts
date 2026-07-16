import type {
  AllianceId,
  BuildingId,
  DistrictId,
  PlayerId,
  ServerInstanceId
} from "../ids/entity-id";
import type { DefenseWeaponId } from "./weapon";

export interface NeutralDistrictLootPool {
  initialSeed: string;
  initialCash: number;
  initialDirtyCash: number;
  initialResources: Record<string, number>;
  cash: number;
  dirtyCash: number;
  resources: Record<string, number>;
  lastRegenerationCityDay: number;
  version: number;
}

/**
 * Responsibility: Stable district contract representing one map territory.
 * Belongs here: ownership, zone pressure, fixed building references, and legacy slot capacity.
 * Does not belong here: combat resolution, occupancy locks, or UI formatting.
 */
export interface District {
  id: DistrictId;
  serverInstanceId: ServerInstanceId;
  templateId: string;
  name: string;
  zone: string;
  adjacentDistrictIds: DistrictId[];
  ownerPlayerId: PlayerId | null;
  controllerAllianceId: AllianceId | null;
  heat: number;
  lastHeatDecayTick?: number;
  influence: number;
  lockdownUntilTick?: number | null;
  policeLockdownReason?: string | null;
  previousStatusBeforeLockdown?: DistrictStatus | null;
  buildingIds: BuildingId[];
  defenseLoadout: Partial<Record<DefenseWeaponId, number>>;
  slotCount: number;
  status: DistrictStatus;
  resourceModifiers: Record<string, number>;
  neutralLootPool?: NeutralDistrictLootPool | null;
  heistProtectedUntilTick?: number | null;
  attackProtectedUntilTick?: number | null;
  stabilizingUntilTick?: number | null;
  ownershipStartedAtTick?: number | null;
  securityRevision: number;
  conflictRevision: number;
  version: number;
}

export type DistrictStatus = "neutral" | "claimed" | "contested" | "locked" | "destroyed";
