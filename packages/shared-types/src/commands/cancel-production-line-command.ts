import type { BuildingId, DistrictId } from "../ids/entity-id";
import type { ActionCommand } from "./action-command";

export interface CancelProductionLinePayload {
  districtId: DistrictId;
  buildingId: BuildingId;
  recipeId: string;
}

export type CancelProductionLineCommand = ActionCommand<
  "cancel-production-line",
  CancelProductionLinePayload
>;
