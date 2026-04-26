import type { ClientReadModel, ClientUiState } from "../state";

/**
 * Responsibility: Small selectors combining server-fed read state with UI-only state for rendering.
 * Belongs here: read-only view selectors for shells, panels, and modals.
 * Does not belong here: gameplay rules or server state mutation.
 */
export const selectIsLoading = (readModel: ClientReadModel): boolean =>
  readModel.connection.status === "connecting" || readModel.gameplaySlice === null;

export const selectSelectedDistrictId = (uiState: ClientUiState): string | null =>
  uiState.selectedDistrictId;
