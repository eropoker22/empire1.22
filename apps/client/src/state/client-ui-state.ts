/**
 * Responsibility: Local UI-only state owned by the client and never treated as game truth.
 * Belongs here: selection, modal visibility, panel state, and transient UI flags.
 * Does not belong here: authoritative game outcomes or domain calculations.
 */
export interface ClientUiState {
  selectedDistrictId: string | null;
  selectedBuildingId: string | null;
  activeSidePanel: string | null;
  activeModal: string | null;
  isMapFocused: boolean;
  pendingCommandIds: string[];
  lastCommandStatus: ClientCommandStatus | null;
}

export interface ClientCommandStatus {
  commandId: string;
  accepted: boolean;
}

export const createInitialClientUiState = (): ClientUiState => ({
  selectedDistrictId: null,
  selectedBuildingId: null,
  activeSidePanel: null,
  activeModal: null,
  isMapFocused: false,
  pendingCommandIds: [],
  lastCommandStatus: null
});
