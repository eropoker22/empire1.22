import type { DistrictId } from "../ids/entity-id";
import type { ActionCommand } from "./action-command";

/**
 * Responsibility: Deprecated compatibility command for early dev/test building slices.
 * Belongs here: typed payload for requesting a new structure in a district.
 * Does not belong here: validation, cost calculation, or build resolution logic.
 *
 * @deprecated Main gameplay uses fixed district buildings from district.buildingIds.
 * Keep this command only for dev tooling and compatibility tests until those flows migrate.
 */
export interface BuildStructurePayload {
  districtId: DistrictId;
  buildingTypeId: string;
  slotIndex: number;
}

/**
 * @deprecated Dev-only compatibility command. Do not dispatch from the main client gameplay surface.
 */
export type BuildStructureCommand = ActionCommand<"build-structure", BuildStructurePayload>;
