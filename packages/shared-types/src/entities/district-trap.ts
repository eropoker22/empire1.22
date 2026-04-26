import type {
  DistrictId,
  PlayerId,
  ServerInstanceId,
  TrapId
} from "../ids/entity-id";

/**
 * Responsibility: Authoritative hidden trap state owned by one player on one district.
 * Belongs here: persisted trap ownership, arming status, and trigger timing.
 * Does not belong here: projection visibility rules or trap resolution math.
 */
export interface DistrictTrap {
  id: TrapId;
  serverInstanceId: ServerInstanceId;
  districtId: DistrictId;
  ownerPlayerId: PlayerId;
  status: DistrictTrapStatus;
  placedAtTick: number;
  triggeredAtTick: number | null;
  version: number;
}

export type DistrictTrapStatus = "active" | "triggered" | "disarmed";
