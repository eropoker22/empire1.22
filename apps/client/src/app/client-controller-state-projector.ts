import { createDistrictPanelViewModel } from "../selectors/district-panel-view-model";
import { createMapDistrictViewModels } from "../selectors/map-view-model";
import { createPlayerViewModel } from "../selectors/player-view-model";
import { createReportViewModels } from "../selectors/report-view-model";
import type { ClientStore } from "../state/client-store";
import type { ClientRenderState } from "./client-render-state";

export const projectClientControllerState = (store: ClientStore): ClientRenderState => {
  const readModel = store.getReadModel();
  const uiState = store.getUiState();
  const player = createPlayerViewModel(
    readModel.playerView,
    readModel.gameplaySlice?.mode.label
  );

  return {
    topBarHtml: "",
    mapHtml: "",
    sidePanelHtml: "",
    player,
    mapDistricts: createMapDistrictViewModels(
      readModel.gameplaySlice?.districts ?? [],
      uiState.selectedDistrictId,
      readModel.gameplaySlice?.district?.attackTargets ?? []
    ),
    districtPanel: createDistrictPanelViewModel(readModel.gameplaySlice, uiState),
    reports: createReportViewModels(readModel.gameplaySlice?.reports ?? []),
    errors: readModel.lastErrors,
    connection: readModel.connection,
    lastCommandStatus: uiState.lastCommandStatus
  };
};
