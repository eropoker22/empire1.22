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
import { escapeAttribute, escapeHtml } from "../shared-ui";

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
  const sidePanelContent = [
    renderSpawnSelectionPanel(readModel.gameplaySlice),
    districtPanel ? renderDistrictPanel(districtPanel) : "",
    renderReportLayer(reports, {
      errors: readModel.lastErrors,
      lastCommandStatus: uiState.lastCommandStatus
    })
  ].join("");

  return {
    topBarHtml: renderTopBarShell({
      player
    }),
    mapHtml: renderMap({
      districts: mapDistricts,
      selectedDistrictId: uiState.selectedDistrictId,
      phaseId: player?.dayNight?.phaseId ?? player?.dayNight?.uiThemeHint ?? null
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
    connection: readModel.connection,
    lastCommandStatus: uiState.lastCommandStatus
  };
};

const renderSpawnSelectionPanel = (
  slice: ReturnType<ClientStore["getReadModel"]>["gameplaySlice"]
): string => {
  if (!slice?.spawnSelection || slice.spawnSelection.status !== "awaiting_spawn_selection") {
    return "";
  }

  return [
    `<section class="spawn-selection-panel" data-feature="spawn-selection">`,
    `<header><p>Lobby</p><h2>Vyber startovní district</h2></header>`,
    `<p>Každý hráč začíná s jedním districtem. Výběr je po potvrzení závazný.</p>`,
    `<div class="spawn-selection-panel__list">`,
    ...slice.spawnSelection.districts.map((district) => [
      `<article class="spawn-selection-panel__item" data-spawn-status="${escapeAttribute(district.status)}">`,
      `<h3>${escapeHtml(district.districtName)}</h3>`,
      `<p>Typ: ${escapeHtml(district.districtType)} · Budova: ${escapeHtml(district.buildingType ?? "Neznámá")} · Sousedé: ${district.neighborCount}</p>`,
      `<p>Spawn zóna: ${escapeHtml((district.spawnZones ?? []).join(", ") || "-")}</p>`,
      district.ownerPublicName
        ? `<p>Obsazeno: ${escapeHtml(district.ownerPublicName)}</p>`
        : "",
      district.status === "available"
        ? `<button type="button" data-select-spawn-district-id="${escapeAttribute(district.districtId)}">POTVRDIT A ZABRAT</button>`
        : `<button type="button" disabled>${escapeHtml(formatSpawnStatus(district.status))}</button>`,
      `</article>`
    ].join("")),
    `</div>`,
    `</section>`
  ].join("");
};

const formatSpawnStatus = (status: string): string => {
  switch (status) {
    case "occupied":
      return "Obsazeno";
    case "locked":
      return "Zamčeno";
    case "disabled":
      return "Nedostupné";
    case "selected_by_me":
      return "Vybráno";
    case "reserved_by_other":
      return "Právě vybírá jiný hráč";
    default:
      return "Nedostupné";
  }
};
