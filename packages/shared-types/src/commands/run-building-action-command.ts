import type {
  BuildingId,
  DistrictId
} from "../ids/entity-id";
import type { ActionCommand } from "./action-command";

/**
 * Responsibility: Typed payload for a fixed-building gameplay action.
 * Belongs here: explicit district/building/action references crossing client/server.
 * Does not belong here: resource math, cooldown resolution, or UI labels.
 */
export interface RunBuildingActionPayload {
  districtId: DistrictId;
  buildingId: BuildingId;
  actionId: string;
  dealerSlotId?: string;
  slotId?: string;
  itemId?: string;
  amount?: number;
  targetCategory?: string;
  category?: string;
  mode?: "pump" | "dump" | string;
  investmentCleanCash?: number;
  investment?: number;
  targetDistrictId?: DistrictId;
  targetZone?: string;
}

export type RunBuildingActionCommand = ActionCommand<"run-building-action", RunBuildingActionPayload>;
