import type {
  BuildingId,
  DistrictId
} from "../ids/entity-id";
import type { ActionCommand } from "./action-command";

/**
 * Responsibility: Typed payload for one server-authoritative building processing start action.
 * Belongs here: explicit district/building/recipe references for the write command contract.
 * Does not belong here: recipe timing, validation, or inventory mutation rules.
 */
export interface CraftItemPayload {
  districtId: DistrictId;
  buildingId: BuildingId;
  recipeId: string;
  quantity?: number;
}

export type CraftItemCommand = ActionCommand<"craft-item", CraftItemPayload>;
