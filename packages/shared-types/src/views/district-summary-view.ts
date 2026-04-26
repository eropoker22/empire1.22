import type { DistrictStatus } from "../entities/district";
import type { PlayerColorHex } from "../entities/player-color";
import type {
  DistrictId,
  PlayerId
} from "../ids/entity-id";

/**
 * Responsibility: Lightweight district summary projection used by map/list UIs.
 * Belongs here: ownership and capacity data safe to expose to the client.
 * Does not belong here: hidden combat values or authoritative rule results.
 */
export interface DistrictSummaryView {
  districtId: DistrictId;
  name: string;
  zone: string;
  ownerPlayerId: PlayerId | null;
  ownerColor: PlayerColorHex | null;
  isOwnedByPlayer: boolean;
  status: DistrictStatus;
  adjacentDistrictIds: DistrictId[];
  heat: number;
  influence: number;
  filledSlotCount: number;
  slotCount: number;
}
