import type { ServerInstanceId } from "@empire/shared-types";
import type { DiagnosticRecord } from "../dto";
import type { DiagnosticLogRepository } from "./diagnostic-log-repository";

export interface InMemoryDiagnosticLogRepositoryOptions {
  maxRecords?: number;
}

/**
 * Responsibility: Development/test diagnostic log kept in process memory.
 * Belongs here: operational diagnostic records and instance-scoped reads.
 * Does not belong here: log shipping, gameplay state, or player-facing messages.
 */
export const createInMemoryDiagnosticLogRepository = (
  options: InMemoryDiagnosticLogRepositoryOptions = {}
): DiagnosticLogRepository => {
  const records: DiagnosticRecord[] = [];

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
