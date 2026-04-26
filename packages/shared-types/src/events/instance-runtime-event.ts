import type { GameEvent } from "./game-event";

/**
 * Responsibility: Shared runtime event envelope for instance-level live update boundaries.
 * Belongs here: event channel types safe to pass to websocket or monitoring publishers.
 * Does not belong here: delivery subscriptions or websocket connection state.
 */
export type InstanceRuntimeEvent =
  | GameEvent<"command-applied", { commandId: string; eventCount: number }>
  | GameEvent<"projection-updated", { playerId: string }>
  | GameEvent<"tick-completed", { tick: number }>
  | GameEvent<"instance-status-changed", { status: string }>;

