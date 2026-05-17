import type { ServerInstanceId } from "@empire/shared-types";
import type { EventRecord } from "../dto";
import type { EventLogRepository } from "./event-log-repository";

export interface InMemoryEventLogRepositoryOptions {
  maxRecords?: number;
}

/**
 * Responsibility: Development/test event audit log kept in process memory.
 * Belongs here: append-only event records and instance-scoped reads.
 * Does not belong here: websocket delivery or event creation.
 */
export const createInMemoryEventLogRepository = (
  options: InMemoryEventLogRepositoryOptions = {}
): EventLogRepository => {
  const records: EventRecord[] = [];

  return {
    append: async (record) => {
      records.push(record);
      trimToLimit(records, options.maxRecords);
    },
    listByInstance: async (instanceId: ServerInstanceId) =>
      records.filter((record) => record.instanceId === instanceId)
  };
};

const trimToLimit = <TRecord>(records: TRecord[], maxRecords: number | undefined): void => {
  if (!maxRecords || records.length <= maxRecords) {
    return;
  }

  records.splice(0, records.length - maxRecords);
};
