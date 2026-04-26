import type { DistrictId } from "../ids/entity-id";
import type { ActionCommand } from "./action-command";

/**
 * Responsibility: Typed payload for attacking one target district.
 * Belongs here: explicit attack target and optional client-selected source context.
 * Does not belong here: combat math or result calculation.
 */
export interface AttackDistrictPayload {
  districtId: DistrictId;
  sourceDistrictId: DistrictId | null;
}

export type AttackDistrictCommand = ActionCommand<"attack-district", AttackDistrictPayload>;
