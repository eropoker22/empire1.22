import type { DistrictId } from "../ids/entity-id";
import type { ActionCommand } from "./action-command";

/**
 * Responsibility: Typed payload for claiming a neutral district after successful intel.
 * Belongs here: transport-safe occupy target and optional source context.
 * Does not belong here: adjacency rules, intel checks, or state mutation.
 */
export interface OccupyDistrictPayload {
  districtId: DistrictId;
  sourceDistrictId: DistrictId | null;
  expectedConflictRevision: number;
  routeDistrictId?: DistrictId;
  expectedRouteVersion?: number;
  encirclementConfirmationToken?: string;
}

export type OccupyDistrictCommand = ActionCommand<"occupy-district", OccupyDistrictPayload>;
