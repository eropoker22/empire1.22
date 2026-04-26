import type { GameSnapshotView, InstanceRuntimeEvent, PlayerView } from "@empire/shared-types";

/**
 * Responsibility: Boundary for future websocket/subscription updates from the server.
 * Belongs here: client-side handling seams for server-fed incremental updates.
 * Does not belong here: gameplay resolution or state authority.
 */
export interface LiveUpdateClient {
  onPlayerView(view: PlayerView): void;
  onGameSnapshot(snapshot: GameSnapshotView): void;
  onRuntimeEvent(event: InstanceRuntimeEvent): void;
}

export const createNullLiveUpdateClient = (): LiveUpdateClient => ({
  onPlayerView: (_view) => {
    return;
  },
  onGameSnapshot: (_snapshot) => {
    return;
  },
  onRuntimeEvent: (_event) => {
    return;
  }
});

