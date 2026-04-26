import type {
  DomainError,
  GameSnapshotView,
  GameplaySliceView,
  PlayerView
} from "@empire/shared-types";
import type { ConnectionState } from "../transport";

/**
 * Responsibility: Holds server-fed client read models and connection status.
 * Belongs here: snapshots and projections received from the authoritative server.
 * Does not belong here: local UI-only toggles or gameplay resolution logic.
 */
export interface ClientReadModel {
  playerView: PlayerView | null;
  gameSnapshot: GameSnapshotView | null;
  gameplaySlice: GameplaySliceView | null;
  lastErrors: DomainError[];
  connection: ConnectionState;
}

export const createInitialClientReadModel = (): ClientReadModel => ({
  playerView: null,
  gameSnapshot: null,
  gameplaySlice: null,
  lastErrors: [],
  connection: {
    status: "idle",
    lastErrorMessage: null,
    staleData: false
  }
});
