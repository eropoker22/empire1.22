import type {
  BuildingId,
  DistrictId
} from "../ids/entity-id";
import type { ActionCommand } from "./action-command";

export interface CancelDrugLabProductionPayload {
  districtId: DistrictId;
  buildingId: BuildingId;
  recipeId: string;
}

export type CancelDrugLabProductionCommand = ActionCommand<
  "cancel-drug-lab-production",
  CancelDrugLabProductionPayload
>;
