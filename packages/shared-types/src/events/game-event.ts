/**
 * Responsibility: Transport contract for server-emitted domain events.
 * Belongs here: event metadata and event payload typing.
 * Does not belong here: event persistence, replay orchestration, or subscriptions.
 */
export interface GameEvent<TType extends string = string, TPayload = unknown> {
  type: TType;
  payload: TPayload;
  occurredAt: string;
}

