import type { DomainError } from "@empire/shared-types";
import type {
  DistrictPanelViewModel,
  MapDistrictViewModel,
  PlayerViewModel
} from "../selectors";
import type { ReportViewModel } from "../reports";
import type { ConnectionState } from "../transport";

/**
 * Responsibility: Headless render snapshot produced by the client shell.
 * Belongs here: UI-ready strings and view models derived from client state.
 * Does not belong here: authoritative game logic or transport side effects.
 */
export interface ClientRenderState {
  topBarHtml: string;
  mapHtml: string;
  sidePanelHtml: string;
  player: PlayerViewModel | null;
  mapDistricts: MapDistrictViewModel[];
  districtPanel: DistrictPanelViewModel | null;
  reports: ReportViewModel[];
  errors: DomainError[];
  connection: ConnectionState;
}

export const createInitialClientRenderState = (): ClientRenderState => ({
  topBarHtml: "",
  mapHtml: "",
  sidePanelHtml: "",
  player: null,
  mapDistricts: [],
  districtPanel: null,
  reports: [],
  errors: [],
  connection: {
    status: "idle",
    lastErrorMessage: null,
    staleData: false
  }
});
