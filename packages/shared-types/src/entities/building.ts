import type {
  BuildingId,
  DistrictId,
  PlayerId,
  ServerInstanceId
} from "../ids/entity-id";

/**
 * Responsibility: Stable building contract for one placed structure.
 * Belongs here: identity, owner, district, lifecycle status, action cooldowns, and timestamps.
 * Does not belong here: production calculation or hidden resolver metadata.
 */
export interface BuildingProcessingJob {
  recipeId: string;
  startedAtTick: number;
  completesAtTick: number;
}

export interface Building {
  id: BuildingId;
  serverInstanceId: ServerInstanceId;
  districtId: DistrictId;
  ownerPlayerId: PlayerId;
  buildingTypeId: string;
  displayName?: string | null;
  level: number;
  status: BuildingStatus;
  processing: BuildingProcessingJob | null;
  actionCooldowns: Record<string, number>;
  startedAt: string | null;
  completedAt: string | null;
  version: number;
}

export type BuildingStatus = "constructing" | "active" | "disabled" | "destroyed";
