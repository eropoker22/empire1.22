import type { DistrictId } from "../ids/entity-id";
import type { AttackWeaponId } from "../entities/weapon";
import type { ActionCommand } from "./action-command";

/**
 * Responsibility: Typed payload for attacking one target district.
 * Belongs here: explicit attack target and optional client-selected source context.
 * Does not belong here: combat math or result calculation.
 */
export interface AttackDistrictPayload {
  districtId: DistrictId;
  sourceDistrictId: DistrictId | null;
  weapons: Partial<Record<AttackWeaponId, number>>;
  expectedSourceVersion?: number;
  expectedTargetVersion?: number;
  expectedConflictRevision: number;
  routeDistrictId?: DistrictId;
  expectedRouteVersion?: number;
}

export type AttackDistrictCommand = ActionCommand<"attack-district", AttackDistrictPayload>;
