import type { CoreEvent } from "./core-event";

/**
 * Responsibility: Small factory for core events.
 * Belongs here: consistent creation of authoritative event envelopes.
 * Does not belong here: publishing or transport delivery.
 */
export const createEvent = <TType extends string, TPayload>(
  type: TType,
  payload: TPayload
): CoreEvent => ({
  type,
  payload,
  occurredAt: new Date(0).toISOString()
});
