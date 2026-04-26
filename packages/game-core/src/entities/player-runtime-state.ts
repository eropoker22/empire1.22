import type { PlayerId } from "@empire/shared-types";

/**
 * Responsibility: Runtime-only player process state held only by the server runtime.
 * Belongs here: live presence, queued commands, and session-local counters.
 * Does not belong here: persistent player truth or client projections.
 */
export interface PlayerRuntimeState {
  playerId: PlayerId;
  connectionIds: string[];
  queuedCommandIds: string[];
  rateLimitWindowKey: string | null;
  isOnline: boolean;
}

