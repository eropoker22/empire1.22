import { renderMap } from "../map";
import { renderDistrictPanel } from "../features";
import {
  createDistrictPanelViewModel,
  createMapDistrictViewModels,
  createPlayerViewModel,
  createReportViewModels
} from "../selectors";
import { renderReportLayer } from "../reports";
import type { ClientStore } from "../state";
import { renderSidePanelShell, renderTopBarShell } from "../ui";
import type { ClientRenderState } from "./client-render-state";

/**
 * Responsibility: Composes selectors and presentation shells into the current client render snapshot.
 * Belongs here: client-only rendering orchestration from already-fetched read models.
 * Does not belong here: transport calls or gameplay rules.
 */
export const renderClientShell = (store: ClientStore): ClientRenderState => {
  const readModel = store.getReadModel();
  const uiState = store.getUiState();
  const player = createPlayerViewModel(
    readModel.playerView,
    readModel.gameplaySlice?.mode.label
  );
  const mapDistricts = createMapDistrictViewModels(
    readModel.gameplaySlice?.districts ?? [],
    uiState.selectedDistrictId,
    readModel.gameplaySlice?.district?.attackTargets ?? []
  );
  const districtPanel = createDistrictPanelViewModel(readModel.gameplaySlice, uiState);
  const reports = createReportViewModels(readModel.gameplaySlice?.reports ?? []);
  const sidePanelContent = [districtPanel ? renderDistrictPanel(districtPanel) : "", renderReportLayer(reports)].join("");

  return {
    topBarHtml: renderTopBarShell({
      player
    }),
    mapHtml: renderMap({
      districts: mapDistricts,
      selectedDistrictId: uiState.selectedDistrictId
    }),
    sidePanelHtml: renderSidePanelShell({
      activePanel: uiState.activeSidePanel,
      contentHtml: sidePanelContent
    }),
    player,
    mapDistricts,
    districtPanel,
    reports,
    errors: readModel.lastErrors,
    connection: readModel.connection
  };
};
