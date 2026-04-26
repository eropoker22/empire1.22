import type { GameEvent } from "@empire/shared-types/events/game-event";

/**
 * Responsibility: Core-local event contract emitted by state transitions.
 * Belongs here: event typing for command application and tick processing.
 * Does not belong here: event bus infrastructure or websocket broadcasting.
 */
export type CoreEvent = GameEvent;

