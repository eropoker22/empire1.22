import type { DomainError, GameplaySliceResponse } from "@empire/shared-types";
import type { ClientStore } from "../state";
import type { ClientRenderState } from "./client-render-state";
import { getMapManifestMismatch } from "./map-manifest-guard";
import { canReuseServerSliceRender, createServerSliceRenderFingerprint } from "./server-slice-render-reuse";
import { mergeAuthoritativeGameplaySlice } from "../../../../packages/shared-types/src/views/authoritative-gameplay-slice.js";

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
      const currentSlice = options.store.getReadModel().gameplaySlice;
      const mergedSlice = response.readModel
        ? mergeAuthoritativeGameplaySlice(currentSlice, response.readModel, {
            allowScopeChange: !commandId
          })
        : null;
      if (response.readModel && (!mergedSlice?.accepted || !mergedSlice.model)) {
        markCommitted(operationSequence);
        return options.getRenderState();
      }
      const authoritativeReadModel = mergedSlice?.model ?? null;
      const hasAuthoritativeReadModel = Boolean(authoritativeReadModel);
      const mapManifestMismatch = getMapManifestMismatch(response);
      const responseErrors = mapManifestMismatch ? [...response.errors, mapManifestMismatch] : response.errors;
      const nextSliceFingerprint = createServerSliceRenderFingerprint(authoritativeReadModel, selectedDistrictId);
      if (canReuseServerSliceRender(
        nextSliceFingerprint,
        lastCommittedSliceFingerprint,
        commandId,
        responseErrors.length
      )) {
        const currentRenderState = options.getRenderState();
        options.store.setConnectionState({ status: "ready", lastErrorMessage: null, staleData: false });
        markCommitted(operationSequence);
        return currentRenderState.connection.status === "ready"
          && currentRenderState.connection.lastErrorMessage === null
          && currentRenderState.connection.staleData === false
          ? currentRenderState
          : options.recomputeRenderState("server-slice-connection-restored");
      }

      if (authoritativeReadModel) {
        const serverSelectedDistrictId = authoritativeReadModel.district?.districtId
          ?? authoritativeReadModel.player.homeDistrictId
          ?? selectedDistrictId
          ?? null;
        options.store.setGameplaySlice(authoritativeReadModel);
        options.store.patchUiState({
          selectedDistrictId: serverSelectedDistrictId,
          activeSidePanel: authoritativeReadModel.spawnSelection?.status === "awaiting_spawn_selection"
            ? spawnSelectionFeature
            : "district-panel"
        });
      }
      if (commandId) {
        options.store.patchUiState({
          lastCommandStatus: { commandId, accepted: response.accepted }
        });
      }
      options.store.setGameplaySliceMetadata(response.metadata ?? (
        authoritativeReadModel
          ? {
              serverTick: authoritativeReadModel.server.currentTick,
              stateVersion: authoritativeReadModel.server.stateVersion
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
