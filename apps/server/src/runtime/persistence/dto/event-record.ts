import type { CoreEvent } from "@empire/game-core";
import type { ServerInstanceId } from "@empire/shared-types";

/**
 * Responsibility: Persistent audit record for one emitted domain event.
 * Belongs here: domain event payloads with causal metadata tied to an instance.
 * Does not belong here: transport delivery attempts or UI read-state.
 */
export interface EventRecord {
  id: string;
  instanceId: ServerInstanceId;
  event: CoreEvent;
  causedByCommandId: string | null;
  recordedAt: string;
  tickAtEmit: number;
}

