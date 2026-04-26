import type { ServerInstanceId } from "@empire/shared-types";
import type { EventRecord } from "../dto";

/**
 * Responsibility: Storage boundary for domain event history.
 * Belongs here: append/read contract for replay and audit event records.
 * Does not belong here: event creation or websocket fanout.
 */
export interface EventLogRepository {
  append(record: EventRecord): Promise<void>;
  listByInstance(instanceId: ServerInstanceId): Promise<EventRecord[]>;
}

export const createNullEventLogRepository = (): EventLogRepository => ({
  append: async (_record) => {
    return;
  },
  listByInstance: async (_instanceId) => []
});

