import type { DistrictId } from "../ids/entity-id";
import type { ActionCommand } from "./action-command";

export type HeistDistrictStyle = "stealth" | "balanced" | "all_in";

/**
 * Responsibility: Typed payload for a server-authored heist against one enemy district.
 * Belongs here: target, optional source, style, and committed manpower.
 * Does not belong here: rolls, loot, detection, or defender private state.
 */
export interface HeistDistrictPayload {
  targetDistrictId: DistrictId;
  sourceDistrictId?: DistrictId;
  style: HeistDistrictStyle;
  gangMembersSent: number;
  expectedTargetVersion?: number;
  expectedSourceVersion?: number;
  expectedConflictRevision: number;
  routeDistrictId?: DistrictId;
  expectedRouteVersion?: number;
}

export type HeistDistrictCommand = ActionCommand<"heist-district", HeistDistrictPayload>;
