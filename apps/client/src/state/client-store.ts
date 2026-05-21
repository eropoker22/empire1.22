import type {
  DomainError,
  GameSnapshotView,
  GameplaySliceResponseMetadata,
  GameplaySliceView,
  PlayerView
} from "@empire/shared-types";
import type { ClientReadModel } from "./client-read-model";
import { createInitialClientReadModel } from "./client-read-model";
import type { ClientUiState } from "./client-ui-state";
import type { ConnectionState } from "../transport";

/**
 * Responsibility: Minimal client-side container separating server-fed state from UI-only state.
 * Belongs here: local storage of projections and UI flags for rendering.
 * Does not belong here: gameplay logic or server authority decisions.
 */
export interface ClientStore {
  getReadModel(): ClientReadModel;
  getUiState(): ClientUiState;
  setServerView(view: PlayerView): void;
  setGameSnapshot(snapshot: GameSnapshotView): void;
  setGameplaySlice(view: GameplaySliceView): void;
  setGameplaySliceMetadata(metadata: GameplaySliceResponseMetadata | null): void;
  setErrors(errors: DomainError[]): void;
  setConnectionState(connection: ConnectionState): void;
  patchUiState(patch: Partial<ClientUiState>): void;
}

export const createClientStore = (initialUiState: ClientUiState): ClientStore => {
  let readModel = createInitialClientReadModel();
  let uiState = initialUiState;

  return {
    getReadModel: () => readModel,
    getUiState: () => uiState,
    setServerView: (view) => {
      readModel = {
        ...readModel,
        playerView: view
      };
    },
    setGameSnapshot: (snapshot) => {
      readModel = {
        ...readModel,
        gameSnapshot: snapshot
      };
    },
    setGameplaySlice: (view) => {
      readModel = {
        ...readModel,
        gameplaySlice: view,
        playerView: view.player
      };
    },
    setGameplaySliceMetadata: (metadata) => {
      readModel = {
        ...readModel,
        gameplaySliceMetadata: metadata
      };
    },
    setErrors: (errors) => {
      readModel = {
        ...readModel,
        lastErrors: errors
      };
    },
    setConnectionState: (connection) => {
      readModel = {
        ...readModel,
        connection
      };
    },
    patchUiState: (patch) => {
      uiState = {
        ...uiState,
        ...patch
      };
    }
  };
};
