import type { DistrictId } from "../ids/entity-id";
import type { ActionCommand } from "./action-command";

/**
 * Responsibility: Typed payload for robbing one neutral neighboring district.
 * Belongs here: transport-safe target and optional source context.
 * Does not belong here: loot, heat, or outcome calculation.
 */
export interface RobDistrictPayload {
  targetDistrictId: DistrictId;
  sourceDistrictId?: DistrictId;
  expectedTargetVersion?: number;
  expectedSourceVersion?: number;
  routeDistrictId?: DistrictId;
  expectedRouteVersion?: number;
}

export type RobDistrictCommand = ActionCommand<"rob-district", RobDistrictPayload>;
