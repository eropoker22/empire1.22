import type { DomainError, GameCommand, GameplaySliceResponse } from "@empire/shared-types";
import { districtPanelFeature } from "../features";
import { createClientStore, createInitialClientUiState } from "../state";
import { createCommandDispatcher, type ClientTransport } from "../transport";
import { createClientAppShell, type ClientAppShell } from "./client-app-shell";
import { createInitialClientRenderState, type ClientRenderState } from "./client-render-state";
import { renderClientShell } from "./client-shell-renderer";
import { getMapManifestMismatch, hasCurrentMapManifestMismatch } from "./map-manifest-guard";

/**
 * Responsibility: Client composition root that wires store, transport, and UI shell boundaries.
 * Belongs here: top-level bootstrap for the player-facing application.
 * Does not belong here: gameplay logic or server authority decisions.
 */
export interface CreateClientAppOptions {
  transport: ClientTransport;
}

const spawnSelectionFeature = "spawn-selection";

export const createClientApp = ({ transport }: CreateClientAppOptions): ClientAppShell => {
  const store = createClientStore(createInitialClientUiState());
  const dispatcher = createCommandDispatcher(transport);
  let renderState = createInitialClientRenderState();

  const commitResponse = (
    response: GameplaySliceResponse,
    selectedDistrictId?: string | null,
    commandId?: string
  ): ClientRenderState => {
    const hasAuthoritativeReadModel = Boolean(response.readModel);
    const missingReadModelMessage = "Gameplay slice response did not include an authoritative read model.";
    const mapManifestMismatch = getMapManifestMismatch(response);
    const responseErrors = mapManifestMismatch
      ? [...response.errors, mapManifestMismatch]
      : response.errors;
    const firstErrorMessage = responseErrors[0]?.message ?? null;

    if (response.readModel) {
      const serverSelectedDistrictId = response.readModel.district?.districtId ??
        response.readModel.player.homeDistrictId ??
        selectedDistrictId ??
        null;
      const activeSidePanel = response.readModel.spawnSelection?.status === "awaiting_spawn_selection"
        ? spawnSelectionFeature
        : districtPanelFeature;
      store.setGameplaySlice(response.readModel);
      store.patchUiState({
        selectedDistrictId: serverSelectedDistrictId,
        activeSidePanel
      });
    }

    if (commandId) {
      store.patchUiState({
        lastCommandStatus: {
          commandId,
          accepted: response.accepted
        }
      });
    }

    store.setGameplaySliceMetadata(response.metadata ?? (
      response.readModel
        ? {
            serverTick: response.readModel.server.currentTick,
            stateVersion: response.readModel.server.stateVersion
          }
        : null
    ));
    store.setErrors(responseErrors);
    store.setConnectionState({
      status: hasAuthoritativeReadModel && !mapManifestMismatch ? "ready" : "error",
      lastErrorMessage: firstErrorMessage ?? (hasAuthoritativeReadModel ? null : missingReadModelMessage),
      staleData: responseErrors.length > 0 || !hasAuthoritativeReadModel
    });
    renderState = renderClientShell(store);
    return renderState;
  };

  const commitTransportFailure = (message: string, commandId?: string): ClientRenderState => {
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
    if (commandId) {
      store.patchUiState({
        lastCommandStatus: {
          commandId,
          accepted: false
        }
      });
    }
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
      districtId,
      factionId: playerView.factionId
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
      } catch (error) {
        return commitTransportFailure(
          createTransportFailureMessage("Unable to load gameplay slice from server.", error)
        );
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
      } catch (error) {
        return commitTransportFailure(
          createTransportFailureMessage("Unable to load selected district from server.", error)
        );
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
      const currentSlice = store.getReadModel().gameplaySlice;

      if (hasCurrentMapManifestMismatch(currentSlice)) {
        return commitTransportFailure("Client map manifest does not match the server map manifest. Map actions are disabled.", command.id);
      }

      if (!uiState.selectedDistrictId && command.type !== "select-spawn-district") {
        return commitTransportFailure("No district is selected for the district panel slice.", command.id);
      }

      store.patchUiState({
        pendingCommandIds: [...uiState.pendingCommandIds, command.id]
      });
      renderState = renderClientShell(store);
      const focusDistrictId = command.type === "select-spawn-district"
        ? command.payload.districtId
        : uiState.selectedDistrictId!;

      try {
        const response = await dispatcher.dispatch({
          command,
          focusDistrictId,
          expectedStateVersion: store.getReadModel().gameplaySliceMetadata?.stateVersion ?? null
        });
        store.patchUiState({
          pendingCommandIds: store
            .getUiState()
            .pendingCommandIds
            .filter((pendingCommandId) => pendingCommandId !== command.id)
        });

        return commitResponse(response, uiState.selectedDistrictId, command.id);
      } catch (_error) {
        store.patchUiState({
          pendingCommandIds: store
            .getUiState()
            .pendingCommandIds
            .filter((pendingCommandId) => pendingCommandId !== command.id)
        });

        return commitTransportFailure(
          createTransportFailureMessage("Unable to submit gameplay command to server.", _error),
          command.id
        );
      }
    },
    getRenderState: () => renderState,
    getGameplaySlice: () => store.getReadModel().gameplaySlice
  });
};

const createTransportFailureMessage = (fallback: string, error: unknown): string => {
  const detail = error instanceof Error ? error.message.trim() : "";
  return detail ? `${fallback} ${detail}` : fallback;
};
