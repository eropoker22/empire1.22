import type { ServerInstanceId } from "@empire/shared-types";
import type { CommandRecord } from "../dto";
import type { CommandLogRepository } from "./command-log-repository";

export interface InMemoryCommandLogRepositoryOptions {
  maxRecords?: number;
}

/**
 * Responsibility: Development/test command audit log kept in process memory.
 * Belongs here: append-only command records and instance-scoped reads.
 * Does not belong here: database IO, gameplay validation, or admin formatting.
 */
export const createInMemoryCommandLogRepository = (
  options: InMemoryCommandLogRepositoryOptions = {}
): CommandLogRepository => {
  const records: CommandRecord[] = [];

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
