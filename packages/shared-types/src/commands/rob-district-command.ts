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
  /** Competitive robberies resolve against the current pool, even after this preview is stale. */
  expectedLootPoolRevision?: number;
  expectedTargetVersion?: number;
  expectedSourceVersion?: number;
  expectedConflictRevision: number;
  routeDistrictId?: DistrictId;
  expectedRouteVersion?: number;
}

export type RobDistrictCommand = ActionCommand<"rob-district", RobDistrictPayload>;
