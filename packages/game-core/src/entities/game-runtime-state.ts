import type { PlayerId } from "@empire/shared-types";
import type { PlayerRuntimeState } from "./player-runtime-state";
import type { ServerInstanceRuntimeState } from "./server-instance-runtime-state";

/**
 * Responsibility: Runtime-only container stored beside the persistent write model.
 * Belongs here: process-local queues, presence, and dirty markers.
 * Does not belong here: authoritative persistent values or client-visible views.
 */
export interface GameRuntimeState {
  instance: ServerInstanceRuntimeState;
  playersById: Record<PlayerId, PlayerRuntimeState>;
}

