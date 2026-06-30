import type { ActionCommand } from "./action-command";
import type { BuildingId, DistrictId } from "../ids/entity-id";

/**
 * Responsibility: Server-authoritative intent to upgrade one owned fixed building.
 * Belongs here: command payload contract.
 * Does not belong here: upgrade cost, next level, or effect values.
 */
export interface UpgradeBuildingPayload {
  districtId: DistrictId;
  buildingId: BuildingId;
}

export type UpgradeBuildingCommand = ActionCommand<"upgrade-building", UpgradeBuildingPayload>;
