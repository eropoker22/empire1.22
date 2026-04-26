import type { DistrictId } from "../ids/entity-id";
import type { ActionCommand } from "./action-command";

/**
 * Responsibility: Typed command for arming one hidden district trap.
 * Belongs here: transport-safe trap placement payload only.
 * Does not belong here: hidden-state validation or trigger resolution.
 */
export interface PlaceTrapPayload {
  districtId: DistrictId;
}

export type PlaceTrapCommand = ActionCommand<"place-trap", PlaceTrapPayload>;
