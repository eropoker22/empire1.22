import type { DomainError, GameCommand, GameplaySliceResponse } from "@empire/shared-types";
import { districtPanelFeature } from "../features";
import { createClientStore, createInitialClientUiState } from "../state";
import { createCommandDispatcher, type ClientTransport } from "../transport";
import { createClientAppShell, type ClientAppShell } from "./client-app-shell";
import { createInitialClientRenderState, type ClientRenderState } from "./client-render-state";
import { renderClientShell } from "./client-shell-renderer";

/**
 * Responsibility: Client composition root that wires store, transport, and UI shell boundaries.
 * Belongs here: top-level bootstrap for the player-facing application.
 * Does not belong here: gameplay logic or server authority decisions.
 */
export interface CreateClientAppOptions {
  transport: ClientTransport;
}

export const createClientApp = ({ transport }: CreateClientAppOptions): ClientAppShell => {
  const store = createClientStore(createInitialClientUiState());
  const dispatcher = createCommandDispatcher(transport);
  let renderState = createInitialClientRenderState();

  const commitResponse = (
    response: GameplaySliceResponse,
    selectedDistrictId: string
  ): ClientRenderState => {
    if (response.readModel) {
      store.setGameplaySlice(response.readModel);
      store.patchUiState({
        selectedDistrictId,
        activeSidePanel: districtPanelFeature
      });
    }

    store.setErrors(response.errors);
    store.setConnectionState({
      status: "ready",
      lastErrorMessage: response.errors[0]?.message ?? null,
      staleData: response.errors.length > 0
    });
    renderState = renderClientShell(store);
    return renderState;
  };

  const commitTransportFailure = (message: string): ClientRenderState => {
    const errors: DomainError[] = [
      {
        code: "client.transport_error",
        message
      }
    ];

    store.setErrors(errors);
    store.setConnectionState({
      status: "error",
      lastErrorMessage: message,
      staleData: true
    });
    renderState = renderClientShell(store);
    return renderState;
  };

  renderState = renderClientShell(store);

  const createLoadRequestForSelectedDistrict = (districtId: string) => {
    const playerView = store.getReadModel().playerView;

    if (!playerView) {
      return null;
    }

    return {
      serverInstanceId: playerView.instanceId,
      playerId: playerView.playerId,
      districtId
    };
  };

  return createClientAppShell({
    load: async (request) => {
      store.setConnectionState({
        status: "connecting",
        lastErrorMessage: null,
        staleData: false
      });

      try {
        const response = await transport.load(request);
        return commitResponse(response, request.districtId);
      } catch (_error) {
        return commitTransportFailure("Unable to load gameplay slice from server.");
      }
    },
    selectDistrict: async (districtId: string) => {
      const request = createLoadRequestForSelectedDistrict(districtId);

      if (!request) {
        return commitTransportFailure("Cannot select a district before the gameplay slice is loaded.");
      }

      store.setConnectionState({
        status: "connecting",
        lastErrorMessage: null,
        staleData: false
      });
      store.patchUiState({
        selectedBuildingId: null
      });
      renderState = renderClientShell(store);

      try {
        const response = await transport.load(request);
        return commitResponse(response, districtId);
      } catch (_error) {
        return commitTransportFailure("Unable to load selected district from server.");
      }
    },
    selectBuilding: async (buildingId: string | null) => {
      store.patchUiState({
        selectedBuildingId: buildingId
      });
      renderState = renderClientShell(store);
      return renderState;
    },
    dispatch: async (command: GameCommand) => {
      const uiState = store.getUiState();

      if (!uiState.selectedDistrictId) {
        return commitTransportFailure("No district is selected for the district panel slice.");
      }

      store.patchUiState({
        pendingCommandIds: [...uiState.pendingCommandIds, command.id]
      });
      renderState = renderClientShell(store);

      try {
        const response = await dispatcher.dispatch({
          command,
          focusDistrictId: uiState.selectedDistrictId
        });
        store.patchUiState({
          pendingCommandIds: store
            .getUiState()
            .pendingCommandIds
            .filter((pendingCommandId) => pendingCommandId !== command.id)
        });

        return commitResponse(response, uiState.selectedDistrictId);
      } catch (_error) {
        store.patchUiState({
          pendingCommandIds: store
            .getUiState()
            .pendingCommandIds
            .filter((pendingCommandId) => pendingCommandId !== command.id)
        });

        return commitTransportFailure("Unable to submit gameplay command to server.");
      }
    },
    getRenderState: () => renderState,
    getGameplaySlice: () => store.getReadModel().gameplaySlice
  });
};
