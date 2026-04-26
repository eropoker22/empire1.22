import type { DistrictId } from "../ids/entity-id";
import type { ActionCommand } from "./action-command";

/**
 * Responsibility: Typed command for one authoritative district spy action.
 * Belongs here: transport-safe spy payload shape only.
 * Does not belong here: outcome calculation or visibility rules.
 */
export interface SpyDistrictPayload {
  districtId: DistrictId;
  sourceDistrictId: DistrictId;
}

export type SpyDistrictCommand = ActionCommand<"spy-district", SpyDistrictPayload>;
