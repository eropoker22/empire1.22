import type { DistrictPanelBuildingView } from "./district-panel-building-view";
import type { DistrictSummaryView } from "./district-summary-view";

/**
 * Lightweight identity needed to list an owned building before its district is selected.
 * Action, mechanics, and slot data belong to the selected district panel only.
 */
export type OwnedDistrictBuildingIndexEntryView = Pick<
  DistrictPanelBuildingView,
  | "buildingId"
  | "buildingTypeId"
  | "label"
  | "displayName"
  | "variantName"
  | "level"
  | "status"
>;

/**
 * Compact owned-district index used by the cross-district Buildings UI.
 * The client selects a district before requesting its actionable full panel.
 */
export interface OwnedDistrictBuildingIndexView extends DistrictSummaryView {
  buildings: OwnedDistrictBuildingIndexEntryView[];
}
