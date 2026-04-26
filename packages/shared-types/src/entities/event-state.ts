import type { EventId, ServerInstanceId } from "../ids/entity-id";

/**
 * Responsibility: Shared contract for active or scheduled instance events.
 * Belongs here: timing, scope, target references, and public payload shape.
 * Does not belong here: scheduler handles, hidden unrevealed outcomes, or delivery queues.
 */
export interface EventState {
  id: EventId;
  serverInstanceId: ServerInstanceId;
  eventTypeId: string;
  status: EventStatus;
  scope: EventScope;
  targetIds: string[];
  startTick: number;
  endTick: number | null;
  payload: Record<string, unknown>;
  version: number;
}

export type EventStatus = "scheduled" | "active" | "resolved" | "cancelled";
export type EventScope = "global" | "alliance" | "district" | "player";

