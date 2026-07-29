import type {
  DistrictPanelBuildingViewModel,
  DistrictPanelSlotViewModel
} from "./district-panel-building-view-model-types";
import type {
  DistrictPanelAttackTargetViewModel,
  DistrictPanelDefenseActionViewModel,
  DistrictPanelHeistTargetViewModel,
  DistrictPanelOccupyTargetViewModel,
  DistrictPanelRobTargetViewModel,
  DistrictPanelSpyTargetViewModel,
  DistrictPanelTrapViewModel
} from "./district-panel-action-view-model-types";

export * from "./district-panel-action-view-model-types";
export * from "./district-panel-building-view-model-types";

export interface DistrictPanelViewModel {
  districtId: string;
  intelKnown: boolean;
  selectedBuildingId: string | null;
  title: string;
  ownershipLabel: string;
  zoneLabel: string;
  statusLabel: string;
  heatLabel: string;
  influenceLabel: string;
  buildingSummary: string;
  attackSummary: string;
  hasPendingCommand: boolean;
  trap: DistrictPanelTrapViewModel | null;
  spyTargets: DistrictPanelSpyTargetViewModel[];
  occupyTargets: DistrictPanelOccupyTargetViewModel[];
  robTargets: DistrictPanelRobTargetViewModel[];
  heistTargets: DistrictPanelHeistTargetViewModel[];
  placeDefense: DistrictPanelDefenseActionViewModel | null;
  removeDefense: DistrictPanelDefenseActionViewModel | null;
  attackTargets: DistrictPanelAttackTargetViewModel[];
  buildings: DistrictPanelBuildingViewModel[];
  slots: DistrictPanelSlotViewModel[];
}
