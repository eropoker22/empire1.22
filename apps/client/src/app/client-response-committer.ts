import type { DomainError, GameplaySliceResponse } from "@empire/shared-types";
import { districtPanelFeature } from "../features";
import type { ClientStore } from "../state";
import type { ClientRenderState } from "./client-render-state";
import { getMapManifestMismatch } from "./map-manifest-guard";
import { canReuseServerSliceRender, createServerSliceRenderFingerprint } from "./server-slice-render-reuse";

const spawnSelectionFeature = "spawn-selection";

export const createClientResponseCommitter = (options: {
  store: ClientStore;
  getRenderState(): ClientRenderState;
  recomputeRenderState(reason: string): ClientRenderState;
}) => {
  let lastCommittedSliceFingerprint = "";
  let nextOperationSequence = 0;
  let lastCommittedOperationSequence = 0;
  const canCommit = (operationSequence: number) => operationSequence >= lastCommittedOperationSequence;
  const markCommitted = (operationSequence: number) => {
    lastCommittedOperationSequence = Math.max(lastCommittedOperationSequence, operationSequence);
  };

  return {
    issueOperation: () => ++nextOperationSequence,
    commitResponse: (
      response: GameplaySliceResponse,
      selectedDistrictId: string | null | undefined,
      commandId: string | undefined,
      operationSequence: number
    ): ClientRenderState => {
      if (!canCommit(operationSequence)) return options.getRenderState();
      const hasAuthoritativeReadModel = Boolean(response.readModel);
      const mapManifestMismatch = getMapManifestMismatch(response);
      const responseErrors = mapManifestMismatch ? [...response.errors, mapManifestMismatch] : response.errors;
      const nextSliceFingerprint = createServerSliceRenderFingerprint(response.readModel, selectedDistrictId);
      if (canReuseServerSliceRender(
        nextSliceFingerprint,
        lastCommittedSliceFingerprint,
        commandId,
        responseErrors.length
      )) {
        options.store.setConnectionState({ status: "ready", lastErrorMessage: null, staleData: false });
        markCommitted(operationSequence);
        return options.getRenderState();
      }

      if (response.readModel) {
        const serverSelectedDistrictId = response.readModel.district?.districtId
          ?? response.readModel.player.homeDistrictId
          ?? selectedDistrictId
          ?? null;
        options.store.setGameplaySlice(response.readModel);
        options.store.patchUiState({
          selectedDistrictId: serverSelectedDistrictId,
          activeSidePanel: response.readModel.spawnSelection?.status === "awaiting_spawn_selection"
            ? spawnSelectionFeature
            : districtPanelFeature
        });
      }
      if (commandId) {
        options.store.patchUiState({
          lastCommandStatus: { commandId, accepted: response.accepted }
        });
      }
      options.store.setGameplaySliceMetadata(response.metadata ?? (
        response.readModel
          ? {
              serverTick: response.readModel.server.currentTick,
              stateVersion: response.readModel.server.stateVersion
            }
          : null
      ));
      options.store.setErrors(responseErrors);
      options.store.setConnectionState({
        status: hasAuthoritativeReadModel && !mapManifestMismatch ? "ready" : "error",
        lastErrorMessage: responseErrors[0]?.message
          ?? (hasAuthoritativeReadModel ? null : "Gameplay slice response did not include an authoritative read model."),
        staleData: responseErrors.length > 0 || !hasAuthoritativeReadModel
      });
      if (nextSliceFingerprint) lastCommittedSliceFingerprint = nextSliceFingerprint;
      markCommitted(operationSequence);
      return options.recomputeRenderState(commandId ? "server-command-response" : "server-slice-response");
    },
    commitTransportFailure: (
      message: string,
      commandId: string | undefined,
      operationSequence: number
    ): ClientRenderState => {
      if (!canCommit(operationSequence)) return options.getRenderState();
      const errors: DomainError[] = [{ code: "client.transport_error", message }];
      options.store.setErrors(errors);
      options.store.setConnectionState({
        status: "error",
        lastErrorMessage: message,
        staleData: true
      });
      if (commandId) {
        options.store.patchUiState({
          lastCommandStatus: { commandId, accepted: false }
        });
      }
      markCommitted(operationSequence);
      return options.recomputeRenderState("transport-failure");
    }
  };
};
