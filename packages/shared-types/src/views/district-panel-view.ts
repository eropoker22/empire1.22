import type { DistrictStatus } from "../entities/district";
import type { DistrictId, PlayerId } from "../ids/entity-id";
import type {
  DistrictPanelBuildingView,
  DistrictPanelSlotView
} from "./district-panel-building-view";
import type { DistrictCapabilitiesView } from "./map-capabilities-view";
import type {
  DistrictAttackTargetView,
  DistrictDefenseActionView,
  DistrictHeistTargetView,
  DistrictOccupyTargetView,
  DistrictRobTargetView,
  DistrictSpyTargetView,
  DistrictTrapView
} from "./district-panel-target-view";

export * from "./district-panel-building-view";
export * from "./district-panel-target-view";

export interface DistrictPanelView {
  districtId: DistrictId;
  name: string;
  zone: string;
  status: DistrictStatus;
  ownerPlayerId: PlayerId | null;
  isOwnedByPlayer: boolean;
  heat: number;
  influence: number;
  securityRevision?: number;
  conflictRevision: number;
  stabilizingUntilTick?: number | null;
  slotCount: number;
  filledSlotCount: number;
  intelKnown: boolean;
  buildings: DistrictPanelBuildingView[];
  slots: DistrictPanelSlotView[];
  targetActions?: {
    attackTargets: DistrictAttackTargetView[];
    spyTargets: DistrictSpyTargetView[];
    occupyTargets: DistrictOccupyTargetView[];
    robTargets: DistrictRobTargetView[];
    heistTargets: DistrictHeistTargetView[];
  };
  attackTargets: DistrictAttackTargetView[];
  spyTargets: DistrictSpyTargetView[];
  occupyTargets: DistrictOccupyTargetView[];
  robTargets?: DistrictRobTargetView[];
  heistTargets?: DistrictHeistTargetView[];
  placeDefense?: DistrictDefenseActionView | null;
  removeDefense?: DistrictDefenseActionView | null;
  trap: DistrictTrapView | null;
  capabilities?: DistrictCapabilitiesView;
}
