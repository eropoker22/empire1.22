import type {
  BuildingId,
  DistrictId
} from "../ids/entity-id";
import type { ActionCommand } from "./action-command";

export interface CancelPharmacyProductionPayload {
  districtId: DistrictId;
  buildingId: BuildingId;
  recipeId: string;
}

export type CancelPharmacyProductionCommand = ActionCommand<
  "cancel-pharmacy-production",
  CancelPharmacyProductionPayload
>;
