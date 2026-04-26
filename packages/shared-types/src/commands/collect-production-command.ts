import type {
  BuildingId,
  DistrictId
} from "../ids/entity-id";
import type { ActionCommand } from "./action-command";

/**
 * Responsibility: Typed payload for collecting ready output from one production building.
 * Belongs here: explicit building/district references for the authoritative collect action.
 * Does not belong here: production timing or inventory mutation logic.
 */
export interface CollectProductionPayload {
  districtId: DistrictId;
  buildingId: BuildingId;
}

export type CollectProductionCommand = ActionCommand<"collect-production", CollectProductionPayload>;
