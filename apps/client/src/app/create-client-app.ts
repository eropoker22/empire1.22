import type { GameCommand } from "@empire/shared-types";
import { createClientStore, createInitialClientUiState } from "../state";
import { createCommandDispatcher, type ClientTransport } from "../transport";
import { createClientAppShell, type ClientAppShell } from "./client-app-shell";
import { createInitialClientRenderState, type ClientRenderState } from "./client-render-state";
import { createClientResponseCommitter } from "./client-response-committer";
import { renderClientShell } from "./client-shell-renderer";
import { hasCurrentMapManifestMismatch } from "./map-manifest-guard";

/**
 * Responsibility: Client composition root that wires store, transport, and UI shell boundaries.
 * Belongs here: top-level bootstrap for the player-facing application.
 * Does not belong here: gameplay logic or server authority decisions.
 */
export interface CreateClientAppOptions { transport: ClientTransport; onStateRecompute?(reason: string): void; }
export const createClientApp = ({ transport, onStateRecompute }: CreateClientAppOptions): ClientAppShell => {
  const store = createClientStore(createInitialClientUiState());
  const dispatcher = createCommandDispatcher(transport);
  let renderState = createInitialClientRenderState();
  const recomputeRenderState = (reason: string): ClientRenderState => {
    onStateRecompute?.(reason);
    renderState = renderClientShell(store);
    return renderState;
  };
  const responseCommitter = createClientResponseCommitter({
    store,
    getRenderState: () => renderState,
    recomputeRenderState
  });
  recomputeRenderState("initial-client-shell");

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
      const operationSequence = responseCommitter.issueOperation();
      store.setConnectionState({
        status: "connecting",
        lastErrorMessage: null,
        staleData: false
      });

      try {
        const response = await transport.load(request);
        return responseCommitter.commitResponse(response, request.districtId, undefined, operationSequence);
      } catch (error) {
        return responseCommitter.commitTransportFailure(
          createTransportFailureMessage("Unable to load gameplay slice from server.", error),
          undefined,
          operationSequence
        );
      }
    },
    clearDistrictSelection: () => {
      store.patchUiState({
        activeSidePanel: null,
        selectedBuildingId: null,
        selectedDistrictId: null
      });
      return recomputeRenderState("ui-clear-district-selection");
    },
    selectDistrict: async (districtId: string) => {
      const operationSequence = responseCommitter.issueOperation();
      const request = createLoadRequestForSelectedDistrict(districtId);

      if (!request) {
        return responseCommitter.commitTransportFailure(
          "Cannot select a district before the gameplay slice is loaded.",
          undefined,
          operationSequence
        );
      }

      store.setConnectionState({
        status: "connecting",
        lastErrorMessage: null,
        staleData: false
      });
      store.patchUiState({
        selectedBuildingId: null
      });
      recomputeRenderState("ui-select-district-pending");

      try {
        const response = await transport.load(request);
        return responseCommitter.commitResponse(response, districtId, undefined, operationSequence);
      } catch (error) {
        return responseCommitter.commitTransportFailure(
          createTransportFailureMessage("Unable to load selected district from server.", error),
          undefined,
          operationSequence
        );
      }
    },
    selectBuilding: async (buildingId: string | null) => {
      store.patchUiState({
        selectedBuildingId: buildingId
      });
      return recomputeRenderState("ui-select-building");
    },
    dispatch: async (command: GameCommand) => {
      const operationSequence = responseCommitter.issueOperation();
      const uiState = store.getUiState();
      const currentSlice = store.getReadModel().gameplaySlice;

      if (hasCurrentMapManifestMismatch(currentSlice)) {
        return responseCommitter.commitTransportFailure(
          "Client map manifest does not match the server map manifest. Map actions are disabled.",
          command.id,
          operationSequence
        );
      }

      if (!uiState.selectedDistrictId && command.type !== "select-spawn-district") {
        return responseCommitter.commitTransportFailure(
          "No district is selected for the district panel slice.",
          command.id,
          operationSequence
        );
      }

      store.patchUiState({
        pendingCommandIds: [...uiState.pendingCommandIds, command.id]
      });
      recomputeRenderState("ui-command-pending");
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

        return responseCommitter.commitResponse(response, uiState.selectedDistrictId, command.id, operationSequence);
      } catch (_error) {
        store.patchUiState({
          pendingCommandIds: store
            .getUiState()
            .pendingCommandIds
            .filter((pendingCommandId) => pendingCommandId !== command.id)
        });

        return responseCommitter.commitTransportFailure(
          createTransportFailureMessage("Unable to submit gameplay command to server.", _error),
          command.id,
          operationSequence
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
